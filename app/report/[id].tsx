import PdfViewer from '@/components/PdfViewer';
import ReportAIChat from '@/components/ReportAIChat';
import { RecommendationBadge, ResponsiveScrollView } from '@/components/ui';
import VideoPlayerModal from '@/components/VideoPlayerModal';
import { BorderRadius, Colors, FontSize, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useMediaPlayer } from '@/context/MediaPlayerContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import type { ResearchReport } from '@/lib/types';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useAlert } from '@/context/AlertContext';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator, Linking, Modal, Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

type TabType = 'report' | 'audio' | 'video';

const getEmbedUrl = (url: string | null | undefined) => {
    if (!url) return '';
    if (url.includes('drive.google.com')) {
        return url.replace(/\/(view|edit)([?#]|$)/, '/preview$2');
    }
    // Attempt to hide PDF toolbar to prevent unauthorized downloads on web
    if (url.includes('.pdf') || url.includes('supabase')) {
        return url.includes('#') ? `${url}&toolbar=0&navpanes=0` : `${url}#toolbar=0&navpanes=0`;
    }
    return url;
};

const getDirectDownloadUrl = (url: string | null | undefined) => {
    if (!url) return '';
    const fileIdMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (fileIdMatch && fileIdMatch[1]) {
        return `https://drive.google.com/uc?export=download&id=${fileIdMatch[1]}`;
    }
    return url;
};

export default function ReportDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const theme = useColorScheme();
    const c = Colors[theme];
    const isDark = theme === 'dark';
    const { showAlert } = useAlert();
    const { subscription, user, getToken } = useAuth();
    const insets = useSafeAreaInsets();

    const [activeTab, setActiveTab] = useState<TabType>('report');
    const [showAIChat, setShowAIChat] = useState(false);
    const [videoModalVisible, setVideoModalVisible] = useState(false);
    const [showPdf, setShowPdf] = useState(false);
    const [pendingPlay, setPendingPlay] = useState(false);

    const {
        track,
        isPlaying,
        isLoaded,
        positionMillis,
        durationMillis,
        isBuffering,
        playTrack,
        togglePlay,
        stopPlayback,
        handleScreenBlur,
        handleScreenFocus,
        setAudioScreenActive,
    } = useMediaPlayer();

    const progress = durationMillis > 0 ? positionMillis / durationMillis : 0;

    const formatTime = (millis: number) => {
        if (!millis || isNaN(millis)) return '0:00';
        const totalSeconds = Math.floor(millis / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    };

    // Pause when switching away from audio tab or leaving the screen
    useEffect(() => {
        if (activeTab === 'audio') {
            setAudioScreenActive(true);
        } else {
            setAudioScreenActive(false);
        }

        // Cleanup on unmount
        return () => setAudioScreenActive(false);
    }, [activeTab, setAudioScreenActive]);

    // Handle screen focus/blur for auto-pause/resume
    useEffect(() => {
        return () => {
            // Called when screen unmounts — don't stop, keep mini player
        };
    }, []);

    const [securePdfUrl, setSecurePdfUrl] = useState<string | null>(null);
    const [secureVideoUrl, setSecureVideoUrl] = useState<string | null>(null);
    const [secureAudioUrl, setSecureAudioUrl] = useState<string | null>(null);
    const playedAudioUriRef = React.useRef<string | null>(null);

    // Reset secure URLs when the report ID changes
    useEffect(() => {
        setSecurePdfUrl(null);
        setSecureVideoUrl(null);
        setSecureAudioUrl(null);
        playedAudioUriRef.current = null;
    }, [id]);

    const userEmail = user?.primaryEmailAddress?.emailAddress;

    const { data: report, isLoading } = useQuery({
        queryKey: ['report_detail', id],
        queryFn: async (): Promise<ResearchReport | null> => {
            if (!id) return null;

            // Use supabase client directly — session is persisted, no token juggling needed.
            const { data } = await supabase
                .from('research_reports')
                .select('report_id, company_name, nse_symbol, recommendation, target_price, recommendation_rationale, company_background, business_model, management_analysis, industry_overview, industry_tailwinds, demand_drivers, industry_risks, pdf_file_url, audio_file_url, video_file_url, published_at')
                .or(`report_id.eq.${id},session_id.eq.${id}`)
                .eq('is_published', true)
                .maybeSingle();

            return data;
        },
        enabled: !!id,
    });

    useEffect(() => {
        let isMounted = true;
        async function fetchSecureUrls() {
            try {
                // Fetch PDF signed URL
                if (report?.pdf_file_url && !securePdfUrl) {
                    if (report.pdf_file_url.startsWith('http')) {
                        if (isMounted) setSecurePdfUrl(report.pdf_file_url);
                    } else {
                        const { data } = await supabase.storage.from('secure_reports').createSignedUrl(report.pdf_file_url, 120);
                        if (isMounted) setSecurePdfUrl(data?.signedUrl || report.pdf_file_url);
                    }
                }

                // Fetch Video signed URL (long TTL for streaming)
                if (report?.video_file_url && !secureVideoUrl) {
                    if (report.video_file_url.startsWith('http')) {
                        if (isMounted) setSecureVideoUrl(report.video_file_url);
                    } else {
                        const { data } = await supabase.storage.from('secure_video').createSignedUrl(report.video_file_url, 14400);
                        if (isMounted) setSecureVideoUrl(data?.signedUrl || report.video_file_url);
                    }
                }
                // Fetch Audio signed URL (long TTL for streaming)
                if (report?.audio_file_url && !secureAudioUrl) {
                    if (report.audio_file_url.startsWith('http')) {
                        if (isMounted) setSecureAudioUrl(report.audio_file_url);
                    } else {
                        const { data, error: storageError } = await supabase.storage.from('media-assets').createSignedUrl(report.audio_file_url, 14400);
                        if (storageError) {
                            logger.warn('Podcast Storage Error:', storageError);
                            if (isMounted) setSecureAudioUrl(null);
                        } else if (isMounted) {
                            setSecureAudioUrl(data?.signedUrl || null);
                        }
                    }
                }
            } catch (err) {
                logger.warn('Error generating signed URLs:', err);
            }
        }

        if (report) fetchSecureUrls();
        return () => { isMounted = false; };
    }, [report?.pdf_file_url, report?.video_file_url, report?.audio_file_url, getToken, id]);

    // Auto-play as soon as the signed URL arrives if user tapped early
    // NOTE: Must stay above early returns to satisfy Rules of Hooks
    useEffect(() => {
        if (pendingPlay && secureAudioUrl) {
            setPendingPlay(false);
            playedAudioUriRef.current = secureAudioUrl;
            playTrack({
                uri: secureAudioUrl,
                type: 'audio',
                title: `${report?.company_name ?? ''} – Podcast Summary`,
                subtitle: report?.nse_symbol ?? '',
            });
        }
    }, [pendingPlay, secureAudioUrl]);


    if (isLoading) {
        return (
            <View style={[styles.loadingWrap, { backgroundColor: c.background }]}>
                <ActivityIndicator size="large" color={Colors.brand.secondary} />
            </View>
        );
    }

    if (!report) {
        return (
            <View style={[styles.loadingWrap, { backgroundColor: c.background }]}>
                <Ionicons name="document-text-outline" size={48} color={c.textTertiary} />
                <Text style={[styles.emptyTitle, { color: c.text }]}>Report Not Found</Text>
                <TouchableOpacity onPress={() => router.back()}>
                    <Text style={{ color: Colors.brand.secondary, fontWeight: '600' }}>Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    if (!subscription?.is_active) {
        return (
            <View style={[styles.loadingWrap, { backgroundColor: c.background, padding: Spacing['2xl'] }]}>
                <Ionicons name="diamond" size={64} color={Colors.brand.gold} style={{ marginBottom: Spacing.lg }} />
                <Text style={{ fontSize: FontSize.xl, fontWeight: '800', color: c.text, marginBottom: Spacing.sm, textAlign: 'center' }}>
                    Subscription Required
                </Text>
                <Text style={{ fontSize: FontSize.base, color: c.textSecondary, textAlign: 'center', marginBottom: Spacing.xl }}>
                    Subscribe to a plan to read this research report.
                </Text>
                <TouchableOpacity
                    style={{ backgroundColor: Colors.brand.primary, paddingHorizontal: Spacing.xl, paddingVertical: 14, borderRadius: BorderRadius.md, flexDirection: 'row', alignItems: 'center', gap: 8 }}
                    onPress={() => router.push('/subscription')}
                >
                    <Text style={{ color: '#fff', fontSize: FontSize.md, fontWeight: '700' }}>View Plans</Text>
                    <Ionicons name="arrow-forward" size={18} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => router.back()} style={{ marginTop: Spacing.xl }}>
                    <Text style={{ color: Colors.brand.secondary, fontWeight: '600', fontSize: FontSize.md }}>Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const hasPdf = !!report.pdf_file_url;
    const hasAudio = !!report.audio_file_url;
    const hasVideo = !!report.video_file_url;

    const hasActiveSubscription = !!subscription?.is_active;
    const canAudio = hasActiveSubscription;
    const canVideo = hasActiveSubscription;

    const tabs: { key: TabType; label: string; icon: keyof typeof Ionicons.glyphMap; available: boolean; locked: boolean }[] = [
        { key: 'report', label: 'Report', icon: 'document-text', available: hasPdf, locked: false },
        { key: 'audio', label: 'Podcast', icon: 'headset', available: hasAudio, locked: !canAudio },
        { key: 'video', label: 'Video', icon: 'videocam', available: hasVideo, locked: !canVideo },
    ];

    const isCurrentTrack = !!playedAudioUriRef.current && track?.uri === playedAudioUriRef.current;
    const audioReady = isCurrentTrack && isLoaded;

    const openPdf = async () => {
        if (report.pdf_file_url) {
            setShowPdf(true);
        } else {
            showAlert('Error', 'No PDF available for this report.');
        }
    };

    const handlePlayAudio = () => {
        if (!report?.audio_file_url) {
            showAlert('Podcast Unavailable', 'No audio summary was found for this report.');
            return;
        }
        if (!secureAudioUrl) {
            // URL still being fetched — queue it up and auto-play when ready
            setPendingPlay(true);
            return;
        }
        playedAudioUriRef.current = secureAudioUrl;
        playTrack({
            uri: secureAudioUrl,
            type: 'audio',
            title: `${report.company_name} – Podcast Summary`,
            subtitle: report.nse_symbol,
        });
    };

    const renderTextSection = (title: string, content: string | null | undefined) => {
        if (!content) return null;
        return (
            <View style={styles.textSection}>
                <Text style={[styles.sectionHeading, { color: c.text }]} selectable={false}>{title}</Text>
                <Text style={[styles.sectionBody, { color: c.textSecondary }]} selectable={false}>{content}</Text>
            </View>
        );
    };

    // ─── Premium Audio Player UI ───
    const renderAudioPlayer = () => {
        if (!hasAudio || !canAudio) return null;

        return (
            <View style={[styles.audioCard, { backgroundColor: isDark ? '#111827' : '#fff', borderColor: c.border }]}>
                {/* Gradient top accent */}
                <LinearGradient
                    colors={[Colors.brand.primary, Colors.brand.secondary]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.audioCardAccent}
                />

                {/* Header */}
                <View style={styles.audioHeader}>
                    <View style={[styles.audioIconWrap, { backgroundColor: Colors.brand.primary + '18' }]}>
                        <Ionicons name="headset" size={24} color={Colors.brand.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.audioTitle, { color: c.text }]}>Podcast Summary</Text>
                        <Text style={[styles.audioSub, { color: c.textTertiary }]}>AI-narrated research brief</Text>
                    </View>
                    {/* Status chip — show during connecting and playback */}
                    {isCurrentTrack && (
                        <View style={[styles.liveChip, { backgroundColor: Colors.brand.primary + '15' }]}>
                            {!isLoaded ? (
                                <ActivityIndicator size={10} color={Colors.brand.primary} style={{ marginRight: 4 }} />
                            ) : (
                                <View style={[styles.liveDot, { backgroundColor: isPlaying ? '#22c55e' : Colors.brand.primary }]} />
                            )}
                            <Text style={[styles.liveChipText, { color: isPlaying && isLoaded ? '#22c55e' : Colors.brand.primary }]}>
                                {!isLoaded ? 'Connecting…' : isPlaying ? 'Playing' : 'Paused'}
                            </Text>
                        </View>
                    )}
                </View>

                {/* Buffering skeleton bar — visible while connecting */}
                {isCurrentTrack && !isLoaded && (
                    <View style={[styles.progressSection, { opacity: 0.4 }]}>
                        <View style={[styles.progressTrack, { backgroundColor: c.border }]}>
                            <LinearGradient
                                colors={[Colors.brand.primary + '60', Colors.brand.secondary + '60']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={[StyleSheet.absoluteFill, { borderRadius: 3 }]}
                            />
                        </View>
                        <View style={styles.timeRow}>
                            <Text style={[styles.timeText, { color: c.textTertiary }]}>0:00</Text>
                            <Text style={[styles.timeText, { color: c.textTertiary }]}>–:––</Text>
                        </View>
                    </View>
                )}

                {/* Real progress bar — only when fully loaded */}
                {audioReady && (
                    <View style={styles.progressSection}>
                        <View style={[styles.progressTrack, { backgroundColor: c.border }]}>
                            <View style={[styles.progressFill, { width: `${progress * 100}%` as any }]}>
                                <LinearGradient
                                    colors={[Colors.brand.primary, Colors.brand.accent]}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={StyleSheet.absoluteFill}
                                />
                            </View>
                            <View style={[styles.progressKnob, { left: `${progress * 100}%` as any }]} />
                        </View>
                        <View style={styles.timeRow}>
                            <Text style={[styles.timeText, { color: c.textTertiary }]}>{formatTime(positionMillis)}</Text>
                            <Text style={[styles.timeText, { color: c.textTertiary }]}>{formatTime(durationMillis)}</Text>
                        </View>
                    </View>
                )}

                {/* Controls — 3 clear states */}
                <View style={styles.audioControls}>
                    {/* STATE 1: Not started yet */}
                    {!isCurrentTrack && (
                        <TouchableOpacity
                            style={[styles.playAudioBtn, !secureAudioUrl && { opacity: 0.65 }]}
                            onPress={handlePlayAudio}
                            activeOpacity={secureAudioUrl ? 0.85 : 1}
                            disabled={!secureAudioUrl && !pendingPlay}
                        >
                            <LinearGradient
                                colors={[Colors.brand.primary, Colors.brand.secondary]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.playAudioBtnInner}
                            >
                                {!secureAudioUrl ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Ionicons name="play" size={20} color="#fff" style={{ marginLeft: 3 }} />
                                )}
                                <Text style={styles.playAudioBtnText}>
                                    {!secureAudioUrl
                                        ? (pendingPlay ? 'Starting soon…' : 'Loading Podcast…')
                                        : 'Play Podcast'}
                                </Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    )}

                    {/* STATE 2: Track selected — connecting / buffering */}
                    {isCurrentTrack && !isLoaded && (
                        <View style={styles.bufferingRow}>
                            <View style={[styles.mainCtrlBtn, { backgroundColor: Colors.brand.primary + '20', justifyContent: 'center', alignItems: 'center' }]}>
                                <ActivityIndicator size="small" color={Colors.brand.primary} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.nowPlayingLabel, { color: c.textTertiary }]}>Connecting to stream…</Text>
                                <Text style={[styles.nowPlayingTitle, { color: c.text }]} numberOfLines={1}>
                                    {report.company_name} – Podcast Summary
                                </Text>
                            </View>
                        </View>
                    )}

                    {/* STATE 3: Loaded — full controls */}
                    {audioReady && (
                        <View style={styles.playerControls}>
                            <TouchableOpacity onPress={togglePlay} style={styles.mainCtrlBtn} activeOpacity={0.85}>
                                <LinearGradient
                                    colors={[Colors.brand.primary, Colors.brand.secondary]}
                                    style={styles.mainCtrlBtnGradient}
                                >
                                    <Ionicons
                                        name={isPlaying ? 'pause' : 'play'}
                                        size={22}
                                        color="#fff"
                                        style={{ marginLeft: isPlaying ? 0 : 3 }}
                                    />
                                </LinearGradient>
                            </TouchableOpacity>

                            <View style={{ flex: 1 }}>
                                <Text style={[styles.nowPlayingLabel, { color: c.textTertiary }]}>
                                    {isBuffering ? 'Buffering…' : isPlaying ? 'Now Playing' : 'Paused'}
                                </Text>
                                <Text style={[styles.nowPlayingTitle, { color: c.text }]} numberOfLines={1}>
                                    {report.company_name} – Podcast Summary
                                </Text>
                            </View>

                            <TouchableOpacity
                                onPress={() => { playedAudioUriRef.current = null; stopPlayback(); }}
                                style={[styles.stopBtn, { backgroundColor: c.border }]}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="stop" size={16} color={c.textSecondary} />
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

            </View>
        );
    };

    // ─── Premium Video Player UI ───
    const renderVideoPlayer = () => {
        if (!hasVideo || !canVideo) return null;

        return (
            <>
                <TouchableOpacity
                    style={[styles.videoCard, { backgroundColor: isDark ? '#0d0d18' : '#0d0d18', borderColor: 'rgba(124,58,237,0.25)' }]}
                    onPress={() => setVideoModalVisible(true)}
                    activeOpacity={0.92}
                >
                    {/* Full-card cinematic thumbnail */}
                    <View style={styles.videoThumb}>
                        <LinearGradient
                            colors={['#180d2e', '#0d0820', '#1a0a35']}
                            style={StyleSheet.absoluteFill}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        />
                        {/* Film grain overlay lines */}
                        {[0.15, 0.35, 0.55, 0.75, 0.90].map((top, i) => (
                            <View
                                key={i}
                                style={{
                                    position: 'absolute',
                                    left: 0, right: 0,
                                    top: `${top * 100}%` as any,
                                    height: 1,
                                    backgroundColor: 'rgba(255,255,255,0.03)',
                                }}
                            />
                        ))}
                        {/* Glow behind button */}
                        <View style={styles.videoGlow} />
                        {/* Big play button */}
                        <View style={styles.videoPlayBtn}>
                            <LinearGradient
                                colors={['#9333ea', '#6d28d9']}
                                style={styles.videoPlayBtnGrad}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                            >
                                <Ionicons name="play" size={30} color="#fff" style={{ marginLeft: 5 }} />
                            </LinearGradient>
                        </View>
                        {/* HD badge */}
                        <View style={styles.hdBadge}>
                            <Text style={styles.hdText}>HD</Text>
                        </View>
                        {/* Duration placeholder */}
                        <View style={styles.durationBadge}>
                            <Ionicons name="time-outline" size={10} color="rgba(255,255,255,0.6)" />
                            <Text style={styles.durationText}>Watch Now</Text>
                        </View>
                    </View>

                    {/* Bottom info strip */}
                    <View style={[styles.videoInfoStrip, { backgroundColor: isDark ? '#110e1f' : '#110e1f' }]}>
                        <View style={[styles.videoIconSmall, { backgroundColor: 'rgba(124,58,237,0.18)' }]}>
                            <Ionicons name="videocam" size={18} color="#9333ea" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.videoCardTitle}>Video Research Brief</Text>
                            <Text style={styles.videoCardSub}>Tap to watch in full screen</Text>
                        </View>
                        <View style={styles.videoPlayChip}>
                            <Ionicons name="play-circle" size={14} color="#9333ea" />
                            <Text style={styles.videoPlayChipText}>Play</Text>
                        </View>
                    </View>
                </TouchableOpacity>

                {/* Video Modal */}
                <VideoPlayerModal
                    visible={videoModalVisible}
                    uri={secureVideoUrl || report.video_file_url!}
                    title={report.company_name}
                    subtitle="Video Research Brief"
                    onClose={() => setVideoModalVisible(false)}
                />
            </>
        );
    };


    return (
        <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={22} color={c.text} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.companyName, { color: c.text }]} numberOfLines={1}>{report.company_name}</Text>
                    <View style={styles.metaRow}>
                        <Text style={[styles.symbol, { color: c.textTertiary }]}>{report.nse_symbol}</Text>
                        {report.recommendation && <RecommendationBadge recommendation={report.recommendation} theme={theme} />}
                        {report.target_price && (
                            <Text style={[styles.targetText, { color: c.textSecondary }]}>
                                Target ₹{report.target_price.toLocaleString('en-IN')}
                            </Text>
                        )}
                    </View>
                </View>
            </View>

            {/* Tab Switcher */}
            <View style={[styles.tabRow, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
                {tabs.map((tab) => (
                    <TouchableOpacity
                        key={tab.key}
                        style={[
                            styles.tab,
                            activeTab === tab.key && { borderBottomColor: Colors.brand.primary, borderBottomWidth: 2 },
                            !tab.available && { opacity: 0.3 },
                        ]}
                        onPress={() => {
                            if (tab.locked) {
                                router.push('/subscription');
                            } else if (tab.available) {
                                setActiveTab(tab.key);
                            }
                        }}
                        disabled={!tab.available && !tab.locked}
                    >
                        <Ionicons name={tab.icon} size={16} color={activeTab === tab.key ? Colors.brand.primary : c.textTertiary} />
                        <Text style={[styles.tabLabel, { color: activeTab === tab.key ? Colors.brand.primary : c.textTertiary }]}>{tab.label}</Text>
                        {tab.locked && <Ionicons name="lock-closed" size={10} color={Colors.brand.gold} />}
                    </TouchableOpacity>
                ))}
                {/* Ask AI Tab */}
                <TouchableOpacity
                    style={[styles.tab, { borderBottomColor: 'transparent' }]}
                    onPress={() => setShowAIChat(true)}
                >
                    <Ionicons name="sparkles" size={16} color={Colors.brand.accent} />
                    <Text style={[styles.tabLabel, { color: Colors.brand.accent, fontWeight: '700' }]}>Ask AI</Text>
                </TouchableOpacity>
            </View>

            {/* Content */}
            <ResponsiveScrollView style={{ flex: 1 }} contentContainerStyle={styles.contentContainer}>
                {/* Full-Screen PDF Modal */}
                <Modal visible={showPdf} animationType="slide" onRequestClose={() => setShowPdf(false)}>
                    <SafeAreaView style={{ flex: 1, backgroundColor: '#1a1a2e' }}>
                        {/* Modal Header */}
                        <View style={styles.pdfModalHeader}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.pdfModalTitle} numberOfLines={1}>{report.company_name} – Report</Text>
                                <Text style={styles.pdfModalSub}>
                                    Confidential • PDF
                                </Text>
                            </View>
                            <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                                <TouchableOpacity
                                    style={styles.pdfModalCloseBtn}
                                    onPress={() => setShowPdf(false)}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name="close" size={20} color="#fff" />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {securePdfUrl ? (
                            // Loaded — show the PDF
                            Platform.OS === 'web' ? (
                                <iframe
                                    src={getEmbedUrl(securePdfUrl)}
                                    style={{ flex: 1, width: '100%', height: '100%', border: 'none', backgroundColor: '#fff' } as any}
                                    title={`${report.company_name} Report PDF`}
                                />
                            ) : (
                                <PdfViewer
                                    source={{ uri: securePdfUrl }}
                                    style={{ flex: 1, backgroundColor: '#fff' }}
                                    activityIndicatorColor={Colors.brand.primary}
                                />
                            )
                        ) : !securePdfUrl && report.pdf_file_url ? (
                            // Loading state
                            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' }}>
                                <ActivityIndicator size="large" color={Colors.brand.primary} />
                                <Text style={{ color: '#fff', fontWeight: '600', fontSize: 16, marginTop: 12 }}>Decrypting File...</Text>
                            </View>
                        ) : (
                            // Error state
                            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, backgroundColor: '#0f172a' }}>
                                <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
                                <Text style={{ color: '#fff', fontWeight: '600', fontSize: 16 }}>Failed to load PDF</Text>
                                <TouchableOpacity
                                    style={{ backgroundColor: Colors.brand.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 }}
                                    onPress={() => setShowPdf(false)}
                                >
                                    <Text style={{ color: '#fff', fontWeight: '700' }}>Close</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </SafeAreaView>
                </Modal>

                {activeTab === 'report' && (
                    <>
                        {hasPdf && (
                            <TouchableOpacity
                                style={[styles.pdfBtn, { backgroundColor: Colors.brand.primary }]}
                                onPress={openPdf}
                            >
                                <Ionicons name="document-text" size={18} color="#fff" />
                                <Text style={styles.pdfBtnText}>
                                    View Full Report PDF
                                </Text>
                            </TouchableOpacity>
                        )}
                        <>
                            {renderTextSection('Company Background', report.company_background)}
                            {renderTextSection('Business Model', report.business_model)}
                            {renderTextSection('Management Analysis', report.management_analysis)}
                            {renderTextSection('Industry Overview', report.industry_overview)}
                            {renderTextSection('Industry Tailwinds', report.industry_tailwinds)}
                            {renderTextSection('Demand Drivers', report.demand_drivers)}
                            {renderTextSection('Industry Risks', report.industry_risks)}
                            {report.recommendation_rationale && renderTextSection('Recommendation Rationale', report.recommendation_rationale)}
                        </>

                        {/* SEBI Disclaimer */}
                        <View style={[styles.sebiDisclaimer, { backgroundColor: c.surface, borderColor: c.border }]}>
                            <View style={styles.sebiDisclaimerHeader}>
                                <Ionicons name="information-circle" size={16} color={c.textTertiary} />
                                <Text style={[styles.sebiDisclaimerTitle, { color: c.textTertiary }]}>Important Disclaimer</Text>
                            </View>
                            <Text style={[styles.sebiDisclaimerText, { color: c.textTertiary }]}>
                                Investment in securities market is subject to market risks. Read all the related documents carefully before investing. Registration granted by SEBI and certification from NISM in no way guarantee performance of the intermediary or provide any assurance of returns to investors.{'\n\n'}
                                This report is prepared for informational purposes only and does not constitute investment advice, an offer to sell, or a solicitation to buy any securities. Past performance is not indicative of future results. Investors should consult their financial advisor before making any investment decisions.{'\n\n'}
                                SEBI Research Analyst Reg. No.: INH000069807
                            </Text>
                        </View>
                    </>
                )}

                {activeTab === 'audio' && renderAudioPlayer()}

                {activeTab === 'video' && renderVideoPlayer()}
            </ResponsiveScrollView>

            {/* Floating AI Chat Button */}
            <TouchableOpacity
                style={[styles.fab, { backgroundColor: Colors.brand.primary }]}
                onPress={() => setShowAIChat(true)}
                activeOpacity={0.85}
            >
                <Ionicons name="sparkles" size={22} color="#fff" />
            </TouchableOpacity>

            {/* AI Chat Modal */}
            <ReportAIChat
                visible={showAIChat}
                onClose={() => setShowAIChat(false)}
                report={report}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
    emptyTitle: { fontSize: FontSize.md, fontWeight: '600' },
    header: { paddingTop: Platform.select({ ios: 56, web: 16, default: 48 }), paddingBottom: Spacing.md, paddingHorizontal: Spacing.xl, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, borderBottomWidth: 1 },
    backBtn: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    companyName: { fontSize: FontSize.lg, fontWeight: '800' },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
    symbol: { fontSize: FontSize.xs, fontFamily: 'monospace' },
    targetText: { fontSize: FontSize.xs },
    tabRow: { flexDirection: 'row', borderBottomWidth: 1, paddingHorizontal: Spacing.xl },
    tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 12 },
    tabLabel: { fontSize: FontSize.sm, fontWeight: '600' },
    contentContainer: { padding: Spacing.xl, paddingBottom: 120 },
    pdfBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, borderRadius: BorderRadius.md, marginBottom: Spacing.xl },
    pdfBtnText: { color: '#fff', fontSize: FontSize.base, fontWeight: '700' },
    pdfModalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.xl,
        paddingVertical: Spacing.md,
        backgroundColor: '#1a1a2e',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
        gap: Spacing.md,
    },
    pdfModalTitle: { fontSize: FontSize.base, fontWeight: '700', color: '#fff' },
    pdfModalSub: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.55)', marginTop: 2 },
    pdfModalCloseBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.12)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    textSection: { marginBottom: Spacing['2xl'] },
    sectionHeading: { fontSize: FontSize.md, fontWeight: '700', marginBottom: Spacing.sm },
    sectionBody: { fontSize: FontSize.base, lineHeight: 24 },

    // ─── Audio Card ───
    audioCard: {
        borderRadius: BorderRadius['2xl'],
        borderWidth: 1,
        overflow: 'hidden',
        marginBottom: Spacing.xl,
        shadowColor: Colors.brand.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 4,
    },
    audioCardAccent: {
        height: 3,
        width: '100%',
    },
    audioHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: Spacing.xl,
        paddingBottom: Spacing.md,
    },
    audioIconWrap: {
        width: 48,
        height: 48,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    audioTitle: { fontSize: FontSize.md, fontWeight: '800', letterSpacing: -0.3 },
    audioSub: { fontSize: FontSize.xs, marginTop: 2 },
    liveChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: BorderRadius.full,
    },
    liveDot: { width: 6, height: 6, borderRadius: 3 },
    liveChipText: { fontSize: 11, fontWeight: '700' },

    // Progress
    progressSection: { paddingHorizontal: Spacing.xl, paddingTop: 4 },
    progressTrack: {
        height: 5,
        borderRadius: 3,
        overflow: 'visible',
    },
    progressFill: {
        height: '100%',
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressKnob: {
        position: 'absolute',
        top: -4,
        width: 13,
        height: 13,
        borderRadius: 7,
        backgroundColor: Colors.brand.primary,
        marginLeft: -6.5,
        shadowColor: Colors.brand.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.7,
        shadowRadius: 4,
        elevation: 4,
    },
    timeRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 6,
    },
    timeText: { fontSize: 11, fontWeight: '600', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },

    // Audio Controls
    audioControls: { padding: Spacing.xl, paddingTop: Spacing.lg },
    playAudioBtn: {
        borderRadius: BorderRadius.lg,
        overflow: 'hidden',
        alignSelf: 'stretch',
    },
    playAudioBtnInner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 15,
        borderRadius: BorderRadius.lg,
    },
    playAudioBtnText: {
        color: '#fff',
        fontSize: FontSize.md,
        fontWeight: '700',
    },
    playerControls: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
    },
    bufferingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
    },
    mainCtrlBtn: {
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: Colors.brand.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
        elevation: 6,
    },
    mainCtrlBtnGradient: {
        width: 54,
        height: 54,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    nowPlayingLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 2 },
    nowPlayingTitle: { fontSize: FontSize.sm, fontWeight: '700' },
    stopBtn: {
        width: 36,
        height: 36,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Mini player hint
    miniHint: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        borderTopWidth: 1,
        paddingHorizontal: Spacing.xl,
        paddingVertical: 10,
    },
    miniHintText: { fontSize: 11, flex: 1, lineHeight: 16 },

    // ─── Video Card ───
    videoCard: {
        borderRadius: BorderRadius['2xl'],
        borderWidth: 1,
        overflow: 'hidden',
        marginBottom: Spacing.xl,
        shadowColor: '#7c3aed',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
        elevation: 8,
    },
    videoThumb: {
        width: '100%',
        aspectRatio: 16 / 9,
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
    },
    videoGlow: {
        position: 'absolute',
        width: 140,
        height: 140,
        borderRadius: 70,
        backgroundColor: 'rgba(124,58,237,0.25)',
    },
    videoPlayBtn: {
        shadowColor: '#9333ea',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.7,
        shadowRadius: 24,
        elevation: 14,
    },
    videoPlayBtnGrad: {
        width: 76, height: 76, borderRadius: 38,
        justifyContent: 'center', alignItems: 'center',
    },
    hdBadge: {
        position: 'absolute', top: 10, right: 10,
        backgroundColor: 'rgba(0,0,0,0.55)',
        paddingHorizontal: 7, paddingVertical: 3,
        borderRadius: 6,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    },
    hdText: { color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 1 },
    durationBadge: {
        position: 'absolute', bottom: 10, left: 10,
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: 'rgba(0,0,0,0.55)',
        paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
    },
    durationText: { color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '600' },
    videoInfoStrip: {
        flexDirection: 'row', alignItems: 'center',
        gap: 12, paddingHorizontal: 16, paddingVertical: 14,
    },
    videoIconSmall: {
        width: 38, height: 38, borderRadius: 12,
        justifyContent: 'center', alignItems: 'center',
    },
    videoCardTitle: { color: '#fff', fontSize: FontSize.sm, fontWeight: '700' },
    videoCardSub: { color: 'rgba(255,255,255,0.4)', fontSize: FontSize.xs, marginTop: 1 },
    videoPlayChip: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: 'rgba(147,51,234,0.18)',
        paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
    },
    videoPlayChipText: { color: '#9333ea', fontSize: 11, fontWeight: '700' },

    fab: {
        position: 'absolute',
        bottom: Platform.select({ ios: 40, default: 24 }),
        right: 20,
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
        zIndex: 950,
    },
    sebiDisclaimer: { marginTop: Spacing['2xl'], padding: Spacing.lg, borderRadius: BorderRadius.lg, borderWidth: 1 },
    sebiDisclaimerHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.sm },
    sebiDisclaimerTitle: { fontSize: FontSize.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
    sebiDisclaimerText: { fontSize: 11, lineHeight: 16 },
});
