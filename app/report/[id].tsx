import ReportAIChat from '@/components/ReportAIChat';
import { RecommendationBadge, ResponsiveScrollView } from '@/components/ui';
import VideoPlayerModal from '@/components/VideoPlayerModal';
import { BorderRadius, Colors, FontSize, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useMediaPlayer } from '@/context/MediaPlayerContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { supabase } from '@/lib/supabase';
import type { ResearchReport } from '@/lib/types';
import { useUser } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator, Animated, Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

type TabType = 'report' | 'audio' | 'video';

export default function ReportDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const theme = useColorScheme();
    const c = Colors[theme];
    const isDark = theme === 'dark';
    const { subscription, kyc, profile } = useAuth();
    const { user } = useUser();

    const [activeTab, setActiveTab] = useState<TabType>('report');
    const [showAIChat, setShowAIChat] = useState(false);
    const [videoModalVisible, setVideoModalVisible] = useState(false);

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
        if (activeTab !== 'audio') {
            // Don't stop — just leave mini player running
        }
    }, [activeTab]);

    // Handle screen focus/blur for auto-pause/resume
    useEffect(() => {
        return () => {
            // Called when screen unmounts — don't stop, keep mini player
        };
    }, []);

    const { data: report, isLoading } = useQuery({
        queryKey: ['report_detail', id],
        queryFn: async (): Promise<ResearchReport | null> => {
            const { data } = await supabase
                .from('research_reports')
                .select('*')
                .eq('report_id', id!)
                .eq('is_published', true)
                .maybeSingle();
            return data;
        },
        enabled: !!id,
    });

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

    if (!kyc || !profile) {
        const isKycMissing = !kyc;
        const missingText = isKycMissing ? 'KYC' : 'Risk Profiling';
        const route = isKycMissing ? '/(kyc)' : '/(profiling)';
        const btnText = isKycMissing ? 'Complete KYC' : 'Complete Risk Profile';

        return (
            <View style={[styles.loadingWrap, { backgroundColor: c.background, padding: Spacing['2xl'] }]}>
                <Ionicons name="shield-half" size={64} color={c.textTertiary} style={{ marginBottom: Spacing.lg }} />
                <Text style={{ fontSize: FontSize.xl, fontWeight: '800', color: c.text, marginBottom: Spacing.sm, textAlign: 'center' }}>
                    {missingText} Required
                </Text>
                <Text style={{ fontSize: FontSize.base, color: c.textSecondary, textAlign: 'center', marginBottom: Spacing.xl }}>
                    You must complete your {missingText} to access this research report.
                </Text>
                <TouchableOpacity
                    style={{ backgroundColor: Colors.brand.primary, paddingHorizontal: Spacing.xl, paddingVertical: 14, borderRadius: BorderRadius.md, flexDirection: 'row', alignItems: 'center', gap: 8 }}
                    onPress={() => router.push(route)}
                >
                    <Text style={{ color: '#fff', fontSize: FontSize.md, fontWeight: '700' }}>{btnText}</Text>
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
        { key: 'audio', label: 'Audio', icon: 'headset', available: hasAudio, locked: !canAudio },
        { key: 'video', label: 'Video', icon: 'videocam', available: hasVideo, locked: !canVideo },
    ];

    const isCurrentTrack = track?.uri === report.audio_file_url;
    const audioReady = isCurrentTrack && isLoaded;

    const handlePlayAudio = () => {
        if (report.audio_file_url) {
            playTrack({
                uri: report.audio_file_url,
                type: 'audio',
                title: `${report.company_name} – Audio Summary`,
                subtitle: report.nse_symbol,
            });
        }
    };

    const renderTextSection = (title: string, content: string | null) => {
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
                        <Text style={[styles.audioTitle, { color: c.text }]}>Audio Summary</Text>
                        <Text style={[styles.audioSub, { color: c.textTertiary }]}>AI-narrated research brief</Text>
                    </View>
                    {audioReady && (
                        <View style={[styles.liveChip, { backgroundColor: Colors.brand.primary + '15' }]}>
                            <View style={[styles.liveDot, { backgroundColor: isPlaying ? '#22c55e' : Colors.brand.primary }]} />
                            <Text style={[styles.liveChipText, { color: isPlaying ? '#22c55e' : Colors.brand.primary }]}>
                                {isPlaying ? 'Playing' : 'Paused'}
                            </Text>
                        </View>
                    )}
                </View>

                {/* Progress bar (only when loaded) */}
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

                {/* Controls */}
                <View style={styles.audioControls}>
                    {!audioReady ? (
                        // Not yet playing — Show Play button
                        <TouchableOpacity
                            style={styles.playAudioBtn}
                            onPress={handlePlayAudio}
                            activeOpacity={0.85}
                        >
                            <LinearGradient
                                colors={[Colors.brand.primary, Colors.brand.secondary]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.playAudioBtnInner}
                            >
                                <Ionicons name="play" size={20} color="#fff" style={{ marginLeft: 3 }} />
                                <Text style={styles.playAudioBtnText}>Play Audio</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    ) : (
                        // Loaded — show full controls
                        <View style={styles.playerControls}>
                            {/* Main Play/Pause */}
                            <TouchableOpacity
                                onPress={togglePlay}
                                style={styles.mainCtrlBtn}
                                activeOpacity={0.85}
                            >
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
                                    {report.company_name} – Audio Summary
                                </Text>
                            </View>

                            {/* Stop */}
                            <TouchableOpacity
                                onPress={stopPlayback}
                                style={[styles.stopBtn, { backgroundColor: c.border }]}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="stop" size={16} color={c.textSecondary} />
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {/* Mini-player hint */}
                {audioReady && (
                    <View style={[styles.miniHint, { borderTopColor: c.border }]}>
                        <Ionicons name="information-circle-outline" size={12} color={c.textTertiary} />
                        <Text style={[styles.miniHintText, { color: c.textTertiary }]}>
                            Audio continues playing even when you navigate away
                        </Text>
                    </View>
                )}
            </View>
        );
    };

    // ─── Premium Video Player UI ───
    const renderVideoPlayer = () => {
        if (!hasVideo || !canVideo) return null;

        return (
            <>
                <View style={[styles.videoCard, { backgroundColor: isDark ? '#111827' : '#fff', borderColor: c.border }]}>
                    {/* Gradient accent */}
                    <LinearGradient
                        colors={['#7c3aed', '#4f46e5']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.audioCardAccent}
                    />

                    {/* Thumbnail placeholder */}
                    <View style={styles.videoThumbnailWrap}>
                        <LinearGradient
                            colors={[isDark ? '#1a1f2e' : '#eef2ff', isDark ? '#0f1420' : '#e0e7ff']}
                            style={styles.videoThumbnail}
                        >
                            <View style={[styles.videoPlayOverlay]}>
                                <LinearGradient
                                    colors={['#7c3aed', '#4f46e5']}
                                    style={styles.videoPlayBtnGradient}
                                >
                                    <Ionicons name="play" size={28} color="#fff" style={{ marginLeft: 4 }} />
                                </LinearGradient>
                            </View>
                            <View style={styles.hdBadge}>
                                <Text style={styles.hdBadgeText}>HD</Text>
                            </View>
                        </LinearGradient>
                    </View>

                    {/* Info */}
                    <View style={styles.videoInfo}>
                        <View style={styles.videoInfoRow}>
                            <View style={[styles.audioIconWrap, { backgroundColor: '#7c3aed18' }]}>
                                <Ionicons name="videocam" size={22} color="#7c3aed" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.audioTitle, { color: c.text }]}>Video Research Brief</Text>
                                <Text style={[styles.audioSub, { color: c.textTertiary }]}>AI-generated visual summary</Text>
                            </View>
                        </View>

                        <TouchableOpacity
                            style={styles.watchBtn}
                            onPress={() => setVideoModalVisible(true)}
                            activeOpacity={0.85}
                        >
                            <LinearGradient
                                colors={['#7c3aed', '#4f46e5']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.watchBtnInner}
                            >
                                <Ionicons name="play-circle" size={20} color="#fff" />
                                <Text style={styles.watchBtnText}>Watch Video</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Video Modal */}
                <VideoPlayerModal
                    visible={videoModalVisible}
                    uri={report.video_file_url!}
                    title={report.company_name}
                    subtitle="Video Research Brief"
                    onClose={() => setVideoModalVisible(false)}
                />
            </>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: c.background }]}>
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
                {user && (
                    <View style={StyleSheet.absoluteFill} pointerEvents="none">
                        {Array.from({ length: 20 }).map((_, i) => (
                            <Text
                                key={i}
                                style={{
                                    color: c.textTertiary,
                                    opacity: 0.1,
                                    fontSize: 14,
                                    transform: [{ rotate: '-45deg' }],
                                    position: 'absolute',
                                    top: Math.random() * 1000 + (i * 50),
                                    left: Math.random() * 400 - 100,
                                }}
                            >
                                {user.primaryEmailAddress?.emailAddress || user.id}
                            </Text>
                        ))}
                    </View>
                )}

                {activeTab === 'report' && (
                    <>
                        {hasPdf && (
                            <TouchableOpacity
                                style={[styles.pdfBtn, { backgroundColor: Colors.brand.primary }]}
                                onPress={() => WebBrowser.openBrowserAsync(report.pdf_file_url!)}
                            >
                                <Ionicons name="document-text" size={18} color="#fff" />
                                <Text style={styles.pdfBtnText}>View Full Report PDF</Text>
                            </TouchableOpacity>
                        )}
                        {renderTextSection('Company Background', report.company_background)}
                        {renderTextSection('Business Model', report.business_model)}
                        {renderTextSection('Management Analysis', report.management_analysis)}
                        {renderTextSection('Industry Overview', report.industry_overview)}
                        {renderTextSection('Industry Tailwinds', report.industry_tailwinds)}
                        {renderTextSection('Demand Drivers', report.demand_drivers)}
                        {renderTextSection('Industry Risks', report.industry_risks)}
                        {report.recommendation_rationale && renderTextSection('Recommendation Rationale', report.recommendation_rationale)}

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
        </View>
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
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
        elevation: 4,
    },
    videoThumbnailWrap: {
        width: '100%',
        aspectRatio: 16 / 9,
        overflow: 'hidden',
    },
    videoThumbnail: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    videoPlayOverlay: {
        shadowColor: '#7c3aed',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 12,
    },
    videoPlayBtnGradient: {
        width: 72,
        height: 72,
        borderRadius: 36,
        justifyContent: 'center',
        alignItems: 'center',
    },
    hdBadge: {
        position: 'absolute',
        top: 12,
        right: 12,
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    hdBadgeText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 1,
    },
    videoInfo: { padding: Spacing.xl },
    videoInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: Spacing.lg,
    },
    watchBtn: {
        borderRadius: BorderRadius.lg,
        overflow: 'hidden',
    },
    watchBtnInner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 15,
        borderRadius: BorderRadius.lg,
    },
    watchBtnText: {
        color: '#fff',
        fontSize: FontSize.md,
        fontWeight: '700',
    },

    fab: { position: 'absolute', bottom: Platform.select({ ios: 40, default: 24 }), right: 20, width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6 },
    sebiDisclaimer: { marginTop: Spacing['2xl'], padding: Spacing.lg, borderRadius: BorderRadius.lg, borderWidth: 1 },
    sebiDisclaimerHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.sm },
    sebiDisclaimerTitle: { fontSize: FontSize.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
    sebiDisclaimerText: { fontSize: 11, lineHeight: 16 },
});
