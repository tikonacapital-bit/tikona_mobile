import { FontSize } from '@/constants/theme';
import VideoEmbed from '@/components/VideoEmbed';
import { Ionicons } from '@expo/vector-icons';
import { AVPlaybackStatus, ResizeMode, Video } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import * as ScreenOrientation from 'expo-screen-orientation';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Animated,
    Modal,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
    useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface VideoPlayerModalProps {
    visible: boolean;
    uri: string;
    // Set when `uri` is a Google Drive / YouTube page rather than a direct video
    // file — renders via WebView/iframe instead of the custom expo-av player.
    embedUrl?: string | null;
    title?: string;
    subtitle?: string;
    onClose: () => void;
}

function formatTime(millis: number) {
    if (!millis || isNaN(millis)) return '0:00';
    const totalSeconds = Math.floor(millis / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

const SPEEDS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

export default function VideoPlayerModal({
    visible,
    uri,
    embedUrl,
    title = 'Video Summary',
    subtitle,
    onClose,
}: VideoPlayerModalProps) {
    const videoRef = useRef<Video>(null);

    // Playback state
    const [isLoaded, setIsLoaded] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isBuffering, setIsBuffering] = useState(false);
    const [positionMillis, setPositionMillis] = useState(0);
    const [durationMillis, setDurationMillis] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const [speedIdx, setSpeedIdx] = useState(2); // default 1.0x
    const [isLocked, setIsLocked] = useState(false);
    const [showSpeedPicker, setShowSpeedPicker] = useState(false);
    const [didFinish, setDidFinish] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Controls overlay visibility
    const [controlsVisible, setControlsVisible] = useState(true);
    const controlsAnim = useRef(new Animated.Value(1)).current;
    const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const { width: SW, height: SH } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const progressBarWidth = useRef(0);
    const progress = durationMillis > 0 ? positionMillis / durationMillis : 0;
    const progressPct = `${(progress * 100).toFixed(2)}%`;
    const currentSpeed = SPEEDS[speedIdx];

    // Reset on open
    useEffect(() => {
        if (visible) {
            setIsLoaded(false); setIsPlaying(false); setIsBuffering(false);
            setPositionMillis(0); setDurationMillis(0);
            setIsMuted(false); setSpeedIdx(2); setIsLocked(false);
            setShowSpeedPicker(false); setDidFinish(false);
            setControlsVisible(true); controlsAnim.setValue(1);
            setIsFullscreen(false);
            // Allow physical hardware rotation while video modal is open
            if (Platform.OS !== 'web') {
                ScreenOrientation.unlockAsync().catch(() => { });
            }
        } else {
            // Relock to portrait if modal closes
            if (Platform.OS !== 'web') {
                ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => { });
            }
        }
    }, [visible]);

    // Safety cleanup against orphaned native locks
    useEffect(() => {
        return () => {
            if (Platform.OS !== 'web') {
                ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => { });
            }
        };
    }, []);

    const onPlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
        if (!status.isLoaded) return;
        setIsLoaded(true);
        setIsPlaying(status.isPlaying);
        setIsBuffering(status.isBuffering);
        setPositionMillis(status.positionMillis);
        setDurationMillis(status.durationMillis ?? 0);
        if (status.didJustFinish) {
            setDidFinish(true);
            setIsPlaying(false);
            showControlsFn();
        }
    }, []);

    // ── Controls show/hide ──
    const showControlsFn = useCallback(() => {
        if (hideTimer.current) clearTimeout(hideTimer.current);
        setControlsVisible(true);
        Animated.timing(controlsAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
        hideTimer.current = setTimeout(() => {
            if (!showSpeedPicker) {
                Animated.timing(controlsAnim, { toValue: 0, duration: 400, useNativeDriver: true })
                    .start(() => setControlsVisible(false));
            }
        }, 3500);
    }, [controlsAnim, showSpeedPicker]);

    const handleTap = useCallback(() => {
        if (isLocked) return; // locked: don't show controls on content tap
        if (!controlsVisible) {
            showControlsFn();
        } else {
            // Tapping again hides
            if (hideTimer.current) clearTimeout(hideTimer.current);
            Animated.timing(controlsAnim, { toValue: 0, duration: 300, useNativeDriver: true })
                .start(() => setControlsVisible(false));
        }
    }, [isLocked, controlsVisible, showControlsFn, controlsAnim]);

    useEffect(() => {
        if (isPlaying && !showSpeedPicker) showControlsFn();
        return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
    }, [isPlaying]);

    // ── Playback actions ──
    const togglePlay = useCallback(async () => {
        if (!videoRef.current) return;
        if (didFinish) {
            await videoRef.current.setPositionAsync(0);
            await videoRef.current.playAsync();
            setDidFinish(false);
        } else if (isPlaying) {
            await videoRef.current.pauseAsync();
        } else {
            await videoRef.current.playAsync();
        }
        showControlsFn();
    }, [isPlaying, didFinish, showControlsFn]);

    const seek = useCallback(async (deltaMs: number) => {
        if (!videoRef.current || !isLoaded) return;
        await videoRef.current.setPositionAsync(
            Math.max(0, Math.min(positionMillis + deltaMs, durationMillis))
        );
        showControlsFn();
    }, [isLoaded, positionMillis, durationMillis, showControlsFn]);

    const handleProgressSeek = useCallback(async (locationX: number) => {
        if (!progressBarWidth.current || !durationMillis || !videoRef.current) return;
        const ratio = Math.max(0, Math.min(1, locationX / progressBarWidth.current));
        await videoRef.current.setPositionAsync(ratio * durationMillis);
        showControlsFn();
    }, [durationMillis, showControlsFn]);

    const toggleMute = useCallback(async () => {
        if (!videoRef.current) return;
        const next = !isMuted;
        await videoRef.current.setIsMutedAsync(next);
        setIsMuted(next);
    }, [isMuted]);

    const cycleSpeed = useCallback(async (idx: number) => {
        if (!videoRef.current) return;
        await videoRef.current.setRateAsync(SPEEDS[idx], true);
        setSpeedIdx(idx);
        setShowSpeedPicker(false);
        showControlsFn();
    }, [showControlsFn]);

    const replay = useCallback(async () => {
        if (!videoRef.current) return;
        await videoRef.current.setPositionAsync(0);
        await videoRef.current.playAsync();
        setDidFinish(false);
        showControlsFn();
    }, [showControlsFn]);

    const toggleFullscreen = useCallback(() => {
        setIsFullscreen(prev => {
            const next = !prev;
            if (Platform.OS !== 'web') {
                if (next) {
                    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE_RIGHT).catch(() => { });
                } else {
                    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => { });
                    // Re-allow free rotation after manually un-toggling fullscreen
                    setTimeout(() => ScreenOrientation.unlockAsync().catch(() => { }), 500);
                }
            }
            return next;
        });
    }, []);

    const handleClose = useCallback(async () => {
        if (videoRef.current) {
            try { await videoRef.current.pauseAsync(); } catch (_) { }
        }
        onClose();
    }, [onClose]);

    // On web/landscape tablet, we want the video to flex entirely rather than restrict to a small percentage of the huge width.
    const isLandscapeOrWeb = SW > SH;
    const videoFlexStyle = (isFullscreen || isLandscapeOrWeb)
        ? { flex: 1, paddingBottom: 20 }
        : { height: Math.round((SW * 9) / 16) };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="overFullScreen"
            statusBarTranslucent
            onRequestClose={handleClose}
            supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
        >
            <View style={styles.root}>
                {/* Hide status bar in fullscreen */}
                <StatusBar hidden={isFullscreen && visible} />
                {/* Dark background */}
                <LinearGradient colors={['#060310', '#0c0820', '#060310']} style={StyleSheet.absoluteFill} />

                {/* ── Header ── */}
                {!isFullscreen && (
                    <View style={[styles.header, { paddingTop: Math.max(insets.top, 10) }]}>
                        <TouchableOpacity onPress={handleClose} style={styles.closeBtn} activeOpacity={0.8}>
                            <LinearGradient
                                colors={['rgba(255,255,255,0.13)', 'rgba(255,255,255,0.06)']}
                                style={styles.closeBtnInner}
                            >
                                <Ionicons name="chevron-down" size={22} color="#fff" />
                            </LinearGradient>
                        </TouchableOpacity>

                        <View style={styles.headerMid}>
                            <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
                            {subtitle ? <Text style={styles.headerSub} numberOfLines={1}>{subtitle}</Text> : null}
                        </View>

                        {/* Lock button */}
                        <TouchableOpacity
                            onPress={() => { setIsLocked(l => !l); showControlsFn(); }}
                            style={[styles.lockBtn, isLocked && styles.lockBtnActive]}
                            activeOpacity={0.8}
                        >
                            <Ionicons name={isLocked ? 'lock-closed' : 'lock-open'} size={16} color={isLocked ? '#f59e0b' : 'rgba(255,255,255,0.5)'} />
                        </TouchableOpacity>
                    </View>
                )}

                {/* ── Video Area ── */}
                {embedUrl ? (
                    // Google Drive / YouTube page — not a raw video stream, so it's
                    // rendered via WebView (native) / iframe (web) with the source's
                    // own player controls instead of our custom scrubber/speed rig.
                    <View style={[styles.videoBox, videoFlexStyle]}>
                        <VideoEmbed uri={embedUrl} style={styles.video} />
                    </View>
                ) : (
                <TouchableWithoutFeedback onPress={handleTap}>
                    <View style={[styles.videoBox, videoFlexStyle]}>
                        <Video
                            ref={videoRef}
                            style={styles.video}
                            videoStyle={{ width: '100%', height: '100%', display: 'flex', alignSelf: 'center', objectFit: 'contain' } as any}
                            source={{ uri }}
                            resizeMode={ResizeMode.CONTAIN}
                            shouldPlay
                            isLooping={false}
                            isMuted={isMuted}
                            rate={currentSpeed}
                            onPlaybackStatusUpdate={onPlaybackStatusUpdate}
                        />

                        {/* Buffering */}
                        {isBuffering && !isPlaying ? (
                            <View style={styles.overlayCenter} pointerEvents="none">
                                <View style={styles.bufPill}>
                                    <Ionicons name="radio-outline" size={15} color="#fff" />
                                    <Text style={styles.bufText}>Buffering…</Text>
                                </View>
                            </View>
                        ) : null}

                        {/* Lock overlay hint */}
                        {isLocked ? (
                            <View style={styles.lockedHint} pointerEvents="none">
                                <TouchableOpacity
                                    onPress={() => { setIsLocked(false); showControlsFn(); }}
                                    style={styles.unlockPill}
                                >
                                    <Ionicons name="lock-closed" size={13} color="#f59e0b" />
                                    <Text style={styles.unlockText}>Tap to unlock</Text>
                                </TouchableOpacity>
                            </View>
                        ) : null}

                        {/* Controls overlay */}
                        {controlsVisible && !isLocked ? (
                            <Animated.View
                                style={[
                                    styles.overlayCenter,
                                    { opacity: controlsAnim },
                                    isFullscreen && {
                                        paddingHorizontal: Math.max(insets.left, insets.right, 20),
                                        paddingBottom: Math.max(insets.bottom, 10),
                                    }
                                ]}
                                pointerEvents="box-none"
                            >
                                {/* Gradient scrim */}
                                <LinearGradient
                                    colors={['rgba(0,0,0,0.6)', 'transparent', 'rgba(0,0,0,0.75)']}
                                    style={StyleSheet.absoluteFill}
                                    locations={[0, 0.4, 1]}
                                    pointerEvents="none"
                                />

                                {/* Center row: -10 | play/pause/replay | +10 */}
                                <View style={styles.ctrlRow}>
                                    <TouchableOpacity onPress={() => seek(-10000)} style={styles.sideBtn} activeOpacity={0.7}>
                                        <View style={styles.sideCircle}>
                                            <Ionicons name="play-back" size={20} color="#fff" />
                                        </View>
                                        <Text style={styles.sideLabel}>10s</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity onPress={didFinish ? replay : togglePlay} style={styles.mainBtn} activeOpacity={0.85}>
                                        <LinearGradient colors={['#7c3aed', '#4f46e5']} style={styles.mainBtnInner}>
                                            <Ionicons
                                                name={didFinish ? 'refresh' : isPlaying ? 'pause' : 'play'}
                                                size={34} color="#fff"
                                                style={{ marginLeft: (!didFinish && !isPlaying) ? 5 : 0 }}
                                            />
                                        </LinearGradient>
                                    </TouchableOpacity>

                                    <TouchableOpacity onPress={() => seek(10000)} style={styles.sideBtn} activeOpacity={0.7}>
                                        <View style={styles.sideCircle}>
                                            <Ionicons name="play-forward" size={20} color="#fff" />
                                        </View>
                                        <Text style={styles.sideLabel}>10s</Text>
                                    </TouchableOpacity>
                                </View>

                                {/* Scrubber Area in Overlay */}
                                <View
                                    style={[
                                        styles.scrubberContainer,
                                        {
                                            left: Math.max(insets.left, 14),
                                            right: Math.max(insets.right, 14),
                                            bottom: isFullscreen ? Math.max(insets.bottom, 10) + 44 : 54
                                        }
                                    ]}
                                    onLayout={(e) => { progressBarWidth.current = e.nativeEvent.layout.width; }}
                                    onStartShouldSetResponder={() => !isLocked}
                                    onResponderGrant={(e) => handleProgressSeek(e.nativeEvent.locationX)}
                                    onResponderMove={(e) => handleProgressSeek(e.nativeEvent.locationX)}
                                >
                                    <View style={styles.track} pointerEvents="none">
                                        <View style={[styles.fill, { width: progressPct as any }]}>
                                            <LinearGradient
                                                colors={['#7c3aed', '#a855f7']}
                                                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                                                style={StyleSheet.absoluteFill}
                                            />
                                        </View>
                                        {/* Buffered (lighter) */}
                                        <View style={[styles.buffered, { width: progressPct as any }]} />
                                        <View style={[styles.knob, { left: progressPct as any }]} />
                                    </View>
                                </View>

                                {/* Bottom controls: mute | speed | time */}
                                <View style={[
                                    styles.bottomBar,
                                    {
                                        left: Math.max(insets.left, 12),
                                        right: Math.max(insets.right, 12),
                                        bottom: isFullscreen ? Math.max(insets.bottom, 10) : 10
                                    }
                                ]}>
                                    {/* Mute */}
                                    <TouchableOpacity onPress={toggleMute} style={styles.smallCtrl} activeOpacity={0.8}>
                                        <Ionicons name={isMuted ? 'volume-mute' : 'volume-high'} size={18} color="#fff" />
                                    </TouchableOpacity>

                                    {/* Speed */}
                                    <TouchableOpacity
                                        onPress={() => setShowSpeedPicker(s => !s)}
                                        style={styles.speedChip}
                                        activeOpacity={0.8}
                                    >
                                        <Text style={styles.speedText}>{currentSpeed === 1 ? '1×' : `${currentSpeed}×`}</Text>
                                    </TouchableOpacity>

                                    <View style={{ flex: 1 }} />

                                    {/* Time */}
                                    <Text style={styles.timeLabel}>
                                        {formatTime(positionMillis)} / {formatTime(durationMillis)}
                                    </Text>

                                    {/* Fullscreen */}
                                    <TouchableOpacity onPress={toggleFullscreen} style={styles.smallCtrl} activeOpacity={0.8}>
                                        <Ionicons name="expand" size={17} color="#fff" />
                                    </TouchableOpacity>
                                </View>
                            </Animated.View>
                        ) : null}

                        {/* Speed picker panel */}
                        {showSpeedPicker && !isLocked ? (
                            <View style={styles.speedPanel}>
                                <Text style={styles.speedPanelTitle}>Playback Speed</Text>
                                {SPEEDS.map((s, i) => (
                                    <TouchableOpacity
                                        key={s}
                                        onPress={() => cycleSpeed(i)}
                                        style={[styles.speedItem, i === speedIdx && styles.speedItemActive]}
                                        activeOpacity={0.8}
                                    >
                                        <Text style={[styles.speedItemText, i === speedIdx && styles.speedItemTextActive]}>
                                            {s === 1 ? 'Normal (1×)' : `${s}×`}
                                        </Text>
                                        {i === speedIdx ? <Ionicons name="checkmark" size={14} color="#7c3aed" /> : null}
                                    </TouchableOpacity>
                                ))}
                            </View>
                        ) : null}
                    </View>
                </TouchableWithoutFeedback>
                )}

                {/* ── Info Panel ── */}
                {!isFullscreen && (
                    <View style={styles.infoSection}>
                        <View style={styles.badgeRow}>
                            <View style={styles.tagVideo}>
                                <Ionicons name="videocam" size={11} color="#a855f7" />
                                <Text style={styles.tagVideoText}>VIDEO BRIEF</Text>
                            </View>
                            <View style={styles.tagLive}>
                                <View style={styles.greenDot} />
                                <Text style={styles.tagLiveText}>HD Streaming</Text>
                            </View>
                            {/* Speed display */}
                            {currentSpeed !== 1 && (
                                <View style={styles.tagSpeed}>
                                    <Text style={styles.tagSpeedText}>{currentSpeed}× speed</Text>
                                </View>
                            )}
                        </View>
                        <Text style={styles.infoTitle} numberOfLines={1}>{title}</Text>
                        {subtitle ? <Text style={styles.infoSub}>{subtitle}</Text> : null}
                    </View>
                )}
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#060310' },

    /* ── Header ── */
    header: {
        flexDirection: 'row', alignItems: 'center',
        paddingBottom: 12, paddingHorizontal: 18, gap: 10,
    },
    closeBtn: { borderRadius: 12, overflow: 'hidden' },
    closeBtnInner: {
        width: 40, height: 40, borderRadius: 12,
        justifyContent: 'center', alignItems: 'center',
    },
    headerMid: { flex: 1, alignItems: 'center' },
    headerTitle: { color: '#fff', fontSize: FontSize.md, fontWeight: '700', letterSpacing: -0.3 },
    headerSub: { color: 'rgba(255,255,255,0.45)', fontSize: FontSize.xs, marginTop: 2 },
    lockBtn: {
        width: 40, height: 40, borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.07)',
        justifyContent: 'center', alignItems: 'center',
    },
    lockBtnActive: { backgroundColor: 'rgba(245,158,11,0.15)' },

    /* ── Video ── */
    videoBox: { width: '100%', backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
    video: { alignSelf: 'stretch', width: '100%', height: '100%' },

    overlayCenter: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center', alignItems: 'center',
    },

    /* Buffering */
    bufPill: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: 'rgba(0,0,0,0.75)',
        paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    },
    bufText: { color: '#fff', fontSize: FontSize.sm, fontWeight: '600' },

    /* Lock hint */
    lockedHint: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'flex-end', alignItems: 'center',
        paddingBottom: 20,
    },
    unlockPill: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
        borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)',
    },
    unlockText: { color: '#f59e0b', fontSize: 13, fontWeight: '700' },

    /* Center controls */
    ctrlRow: { flexDirection: 'row', alignItems: 'center', gap: 28 },
    sideBtn: { alignItems: 'center', gap: 4 },
    sideCircle: {
        width: 48, height: 48, borderRadius: 24,
        backgroundColor: 'rgba(255,255,255,0.12)',
        justifyContent: 'center', alignItems: 'center',
    },
    sideLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '700' },
    mainBtn: {
        borderRadius: 38, overflow: 'hidden',
        shadowColor: '#7c3aed',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.65, shadowRadius: 20, elevation: 14,
    },
    mainBtnInner: { width: 76, height: 76, borderRadius: 38, justifyContent: 'center', alignItems: 'center' },

    /* Bottom controls bar */
    scrubberContainer: {
        position: 'absolute',
        bottom: 54,
        left: 14,
        right: 14,
        height: 20,
        justifyContent: 'center',
    },
    bottomBar: {
        position: 'absolute', bottom: 10, left: 12, right: 12,
        flexDirection: 'row', alignItems: 'center', gap: 10,
    },
    smallCtrl: {
        width: 36, height: 36, borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.12)',
        justifyContent: 'center', alignItems: 'center',
    },
    speedChip: {
        paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
        backgroundColor: 'rgba(124,58,237,0.3)',
        borderWidth: 1, borderColor: 'rgba(168,85,247,0.4)',
    },
    speedText: { color: '#a855f7', fontSize: 12, fontWeight: '800' },
    timeLabel: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 11, fontWeight: '600',
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },

    /* Speed picker */
    speedPanel: {
        position: 'absolute', bottom: 0, right: 0,
        width: 190,
        backgroundColor: '#1a0d30',
        borderTopLeftRadius: 16, borderTopRightRadius: 16,
        borderWidth: 1, borderColor: 'rgba(124,58,237,0.25)',
        paddingVertical: 12, paddingHorizontal: 4,
    },
    speedPanelTitle: {
        color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '700',
        letterSpacing: 0.5, textAlign: 'center', marginBottom: 8,
    },
    speedItem: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8,
    },
    speedItemActive: { backgroundColor: 'rgba(124,58,237,0.15)' },
    speedItemText: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: '600' },
    speedItemTextActive: { color: '#a855f7', fontWeight: '800' },

    /* Progress */
    track: {
        height: 4, backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 2, overflow: 'visible',
    },
    fill: { height: '100%', borderRadius: 2, overflow: 'hidden' },
    buffered: {
        position: 'absolute', top: 0, left: 0,
        height: '100%', borderRadius: 2,
        backgroundColor: 'rgba(168,85,247,0.2)',
    },
    knob: {
        position: 'absolute', top: -5,
        width: 14, height: 14, borderRadius: 7,
        backgroundColor: '#a855f7', marginLeft: -7,
        shadowColor: '#a855f7',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1, shadowRadius: 6, elevation: 6,
    },


    /* Info */
    infoSection: { paddingHorizontal: 18, paddingTop: 20, gap: 5 },
    badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' },
    tagVideo: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        backgroundColor: 'rgba(168,85,247,0.12)',
        paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
    },
    tagVideoText: { color: '#a855f7', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
    tagLive: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        backgroundColor: 'rgba(34,197,94,0.1)',
        paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
    },
    greenDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22c55e' },
    tagLiveText: { color: '#22c55e', fontSize: 10, fontWeight: '700' },
    tagSpeed: {
        backgroundColor: 'rgba(245,158,11,0.12)',
        paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
    },
    tagSpeedText: { color: '#f59e0b', fontSize: 10, fontWeight: '700' },
    infoTitle: { color: '#fff', fontSize: FontSize.xl, fontWeight: '800', letterSpacing: -0.5 },
    infoSub: { color: 'rgba(255,255,255,0.45)', fontSize: FontSize.sm },
});
