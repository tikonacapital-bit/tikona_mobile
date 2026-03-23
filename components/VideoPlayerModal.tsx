import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Animated,
    Dimensions,
    Modal,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, BorderRadius, FontSize } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';

interface VideoPlayerModalProps {
    visible: boolean;
    uri: string;
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

export default function VideoPlayerModal({
    visible,
    uri,
    title = 'Video Summary',
    subtitle,
    onClose,
}: VideoPlayerModalProps) {
    const theme = useColorScheme();
    const isDark = theme === 'dark';

    const videoRef = useRef<Video>(null);
    const [status, setStatus] = useState<AVPlaybackStatus | null>(null);
    const [controlsVisible, setControlsVisible] = useState(true);
    const controlsAnim = useRef(new Animated.Value(1)).current;
    const hideControlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const isLoaded = status?.isLoaded ?? false;
    const isPlaying = isLoaded && (status as any)?.isPlaying;
    const positionMillis: number = isLoaded ? (status as any).positionMillis : 0;
    const durationMillis: number = isLoaded ? ((status as any).durationMillis ?? 0) : 0;
    const isBuffering: boolean = isLoaded ? (status as any).isBuffering : false;
    const progress = durationMillis > 0 ? positionMillis / durationMillis : 0;

    // Auto-hide controls after 3 seconds
    const scheduleHideControls = useCallback(() => {
        if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
        hideControlsTimer.current = setTimeout(() => {
            Animated.timing(controlsAnim, {
                toValue: 0,
                duration: 400,
                useNativeDriver: true,
            }).start(() => setControlsVisible(false));
        }, 3000);
    }, [controlsAnim]);

    const showControls = useCallback(() => {
        setControlsVisible(true);
        Animated.timing(controlsAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
        }).start();
        scheduleHideControls();
    }, [controlsAnim, scheduleHideControls]);

    useEffect(() => {
        if (isPlaying) scheduleHideControls();
        return () => {
            if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
        };
    }, [isPlaying]);

    const togglePlay = useCallback(async () => {
        if (!videoRef.current) return;
        if (isPlaying) {
            await videoRef.current.pauseAsync();
        } else {
            await videoRef.current.playAsync();
        }
        showControls();
    }, [isPlaying, showControls]);

    // Seek +/- 10s
    const seek = useCallback(async (deltaMs: number) => {
        if (!videoRef.current || !isLoaded) return;
        const next = Math.max(0, Math.min(positionMillis + deltaMs, durationMillis));
        await videoRef.current.setPositionAsync(next);
        showControls();
    }, [videoRef, isLoaded, positionMillis, durationMillis, showControls]);

    // Progress bar width ref for seeking
    const progressBarWidth = useRef(0);

    const handleClose = useCallback(async () => {
        if (videoRef.current) {
            try {
                await videoRef.current.pauseAsync();
            } catch (_) {}
        }
        onClose();
    }, [onClose]);

    const { width: SCREEN_WIDTH } = Dimensions.get('window');
    const videoHeight = (SCREEN_WIDTH * 9) / 16;

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="overFullScreen"
            statusBarTranslucent
            onRequestClose={handleClose}
        >
            <View style={styles.modalRoot}>
                {/* Black BG */}
                <LinearGradient
                    colors={['#0a0a0f', '#0f0f1a', '#0a0a0f']}
                    style={StyleSheet.absoluteFill}
                />

                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={handleClose} style={styles.closeBtn} activeOpacity={0.8}>
                        <LinearGradient
                            colors={['rgba(255,255,255,0.14)', 'rgba(255,255,255,0.08)']}
                            style={styles.closeBtnGradient}
                        >
                            <Ionicons name="chevron-down" size={22} color="#fff" />
                        </LinearGradient>
                    </TouchableOpacity>

                    <View style={styles.headerCenter}>
                        <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
                        {subtitle && (
                            <Text style={styles.headerSubtitle} numberOfLines={1}>{subtitle}</Text>
                        )}
                    </View>

                    {/* Spacer to balance header */}
                    <View style={{ width: 40 }} />
                </View>

                {/* Video Container */}
                <TouchableWithoutFeedback onPress={showControls}>
                    <View style={[styles.videoWrapper, { height: videoHeight }]}>
                        <Video
                            ref={videoRef}
                            style={styles.video}
                            source={{ uri }}
                            resizeMode={ResizeMode.CONTAIN}
                            shouldPlay
                            isLooping={false}
                            onPlaybackStatusUpdate={(s) => setStatus(s)}
                        />

                        {/* Buffering spinner */}
                        {isBuffering && (
                            <View style={styles.bufferingOverlay}>
                                <View style={styles.bufferingBadge}>
                                    <Ionicons name="radio-outline" size={20} color="#fff" />
                                    <Text style={styles.bufferingText}>Buffering…</Text>
                                </View>
                            </View>
                        )}

                        {/* Overlay Controls */}
                        {controlsVisible && (
                            <Animated.View style={[styles.controlsOverlay, { opacity: controlsAnim }]}>
                                {/* Gradient scrim for readability */}
                                <LinearGradient
                                    colors={['rgba(0,0,0,0.5)', 'transparent', 'rgba(0,0,0,0.6)']}
                                    style={StyleSheet.absoluteFill}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 0, y: 1 }}
                                />

                                {/* Center Controls */}
                                <View style={styles.centerControls}>
                                    {/* -10s */}
                                    <TouchableOpacity
                                        onPress={() => seek(-10000)}
                                        style={styles.seekBtn}
                                        activeOpacity={0.7}
                                    >
                                        <Ionicons name="play-back" size={22} color="#fff" />
                                        <Text style={styles.seekLabel}>10</Text>
                                    </TouchableOpacity>

                                    {/* Play/Pause main */}
                                    <TouchableOpacity
                                        onPress={togglePlay}
                                        style={styles.mainPlayBtn}
                                        activeOpacity={0.85}
                                    >
                                        <LinearGradient
                                            colors={[Colors.brand.primary, Colors.brand.secondary]}
                                            style={styles.mainPlayBtnGradient}
                                        >
                                            <Ionicons
                                                name={isPlaying ? 'pause' : 'play'}
                                                size={32}
                                                color="#fff"
                                                style={{ marginLeft: isPlaying ? 0 : 4 }}
                                            />
                                        </LinearGradient>
                                    </TouchableOpacity>

                                    {/* +10s */}
                                    <TouchableOpacity
                                        onPress={() => seek(10000)}
                                        style={styles.seekBtn}
                                        activeOpacity={0.7}
                                    >
                                        <Ionicons name="play-forward" size={22} color="#fff" />
                                        <Text style={styles.seekLabel}>10</Text>
                                    </TouchableOpacity>
                                </View>
                            </Animated.View>
                        )}
                    </View>
                </TouchableWithoutFeedback>

                {/* Progress + Time */}
                <View style={styles.progressSection}>
                    {/* Seekable progress bar */}
                    <View
                        style={styles.progressTrack}
                        onLayout={(e) => { progressBarWidth.current = e.nativeEvent.layout.width; }}
                        onStartShouldSetResponder={() => true}
                        onResponderGrant={(e) => {
                            if (!progressBarWidth.current || !durationMillis || !videoRef.current) return;
                            const ratio = Math.max(0, Math.min(1, e.nativeEvent.locationX / progressBarWidth.current));
                            videoRef.current.setPositionAsync(ratio * durationMillis);
                            showControls();
                        }}
                        onResponderMove={(e) => {
                            if (!progressBarWidth.current || !durationMillis || !videoRef.current) return;
                            const ratio = Math.max(0, Math.min(1, e.nativeEvent.locationX / progressBarWidth.current));
                            videoRef.current.setPositionAsync(ratio * durationMillis);
                        }}
                    >
                        <View style={[styles.progressFill, { width: `${progress * 100}%` as any }]}>
                            <LinearGradient
                                colors={[Colors.brand.primary, Colors.brand.accent]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={StyleSheet.absoluteFill}
                            />
                        </View>
                        {/* Scrubber knob */}
                        <View style={[styles.scrubberKnob, { left: `${progress * 100}%` as any }]} />
                    </View>

                    {/* Time labels */}
                    <View style={styles.timeRow}>
                        <Text style={styles.timeText}>{formatTime(positionMillis)}</Text>
                        <Text style={styles.timeText}>{formatTime(durationMillis)}</Text>
                    </View>
                </View>

                {/* Info Panel */}
                <View style={styles.infoPanel}>
                    <View style={styles.infoBadge}>
                        <Ionicons name="videocam" size={12} color={Colors.brand.accent} />
                        <Text style={styles.infoBadgeText}>Video Research Brief</Text>
                    </View>
                    <Text style={styles.infoTitle}>{title}</Text>
                    {subtitle && <Text style={styles.infoSub}>{subtitle}</Text>}

                    {/* Quality indicator */}
                    <View style={styles.qualityRow}>
                        <View style={styles.qualityDot} />
                        <Text style={styles.qualityLabel}>HD Quality · Streaming</Text>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalRoot: {
        flex: 1,
        backgroundColor: '#0a0a0f',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: Platform.select({ ios: 60, default: 48 }),
        paddingBottom: 16,
        paddingHorizontal: 20,
        gap: 12,
    },
    closeBtn: {
        borderRadius: 12,
        overflow: 'hidden',
    },
    closeBtnGradient: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerCenter: {
        flex: 1,
        alignItems: 'center',
    },
    headerTitle: {
        color: '#fff',
        fontSize: FontSize.md,
        fontWeight: '700',
        letterSpacing: -0.3,
    },
    headerSubtitle: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: FontSize.xs,
        marginTop: 2,
    },
    videoWrapper: {
        width: '100%',
        backgroundColor: '#000',
        position: 'relative',
    },
    video: {
        flex: 1,
        width: '100%',
        height: '100%',
    },
    bufferingOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
    },
    bufferingBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: 'rgba(0,0,0,0.7)',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
    },
    bufferingText: {
        color: '#fff',
        fontSize: FontSize.sm,
        fontWeight: '600',
    },
    controlsOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
    },
    centerControls: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 28,
    },
    seekBtn: {
        alignItems: 'center',
        gap: 2,
        opacity: 0.9,
    },
    seekLabel: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    mainPlayBtn: {
        borderRadius: 28,
        overflow: 'hidden',
        shadowColor: Colors.brand.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.6,
        shadowRadius: 16,
        elevation: 12,
    },
    mainPlayBtnGradient: {
        width: 72,
        height: 72,
        borderRadius: 36,
        justifyContent: 'center',
        alignItems: 'center',
    },
    progressSection: {
        paddingHorizontal: 20,
        paddingTop: 20,
        gap: 8,
    },
    progressTrack: {
        height: 4,
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderRadius: 2,
        overflow: 'visible',
    },
    progressFill: {
        height: '100%',
        borderRadius: 2,
        overflow: 'hidden',
    },
    scrubberKnob: {
        position: 'absolute',
        top: -5,
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: '#fff',
        marginLeft: -7,
        shadowColor: '#fff',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 6,
        elevation: 6,
    },
    timeRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    timeText: {
        color: 'rgba(255,255,255,0.55)',
        fontSize: 12,
        fontWeight: '600',
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    infoPanel: {
        paddingHorizontal: 20,
        paddingTop: 28,
        gap: 6,
    },
    infoBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 2,
    },
    infoBadgeText: {
        color: Colors.brand.accent,
        fontSize: FontSize.xs,
        fontWeight: '700',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    infoTitle: {
        color: '#fff',
        fontSize: FontSize.xl,
        fontWeight: '800',
        letterSpacing: -0.5,
    },
    infoSub: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: FontSize.sm,
    },
    qualityRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 8,
    },
    qualityDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#22c55e',
    },
    qualityLabel: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: FontSize.xs,
        fontWeight: '600',
        letterSpacing: 0.3,
    },
});
