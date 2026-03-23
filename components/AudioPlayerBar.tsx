import React, { useEffect, useRef } from 'react';
import {
    Animated,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useMediaPlayer } from '@/context/MediaPlayerContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors, BorderRadius, FontSize } from '@/constants/theme';

function formatTime(millis: number) {
    if (!millis || isNaN(millis)) return '0:00';
    const totalSeconds = Math.floor(millis / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

export default function AudioPlayerBar() {
    const theme = useColorScheme();
    const c = Colors[theme];
    const isDark = theme === 'dark';

    const {
        track,
        isPlaying,
        isLoaded,
        positionMillis,
        durationMillis,
        isBuffering,
        togglePlay,
        stopPlayback,
        seekTo,
    } = useMediaPlayer();

    const slideAnim = useRef(new Animated.Value(120)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;

    const visible = track?.type === 'audio' && (isLoaded || isBuffering);

    // Slide in / out
    useEffect(() => {
        Animated.parallel([
            Animated.spring(slideAnim, {
                toValue: visible ? 0 : 120,
                useNativeDriver: true,
                tension: 80,
                friction: 12,
            }),
            Animated.timing(opacityAnim, {
                toValue: visible ? 1 : 0,
                duration: 250,
                useNativeDriver: true,
            }),
        ]).start();
    }, [visible]);

    // Pulse animation when playing
    useEffect(() => {
        if (isPlaying) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.12,
                        duration: 700,
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 700,
                        useNativeDriver: true,
                    }),
                ])
            ).start();
        } else {
            pulseAnim.stopAnimation();
            pulseAnim.setValue(1);
        }
    }, [isPlaying]);

    const progress = durationMillis > 0 ? positionMillis / durationMillis : 0;

    // Seekable progress bar via touch
    const progressBarWidth = useRef(0);
    const handleSeek = (x: number) => {
        if (!progressBarWidth.current || !durationMillis) return;
        const ratio = Math.max(0, Math.min(1, x / progressBarWidth.current));
        seekTo(ratio * durationMillis);
    };

    if (!visible) return null;

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    transform: [{ translateY: slideAnim }],
                    opacity: opacityAnim,
                    bottom: Platform.select({ ios: 98, default: 72 }),
                },
            ]}
            pointerEvents="box-none"
        >
            {/* Glassmorphism background */}
            {isDark ? (
                <LinearGradient
                    colors={['rgba(15,19,24,0.97)', 'rgba(21,25,33,0.99)']}
                    style={StyleSheet.absoluteFill}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                />
            ) : (
                Platform.OS !== 'web' ? (
                    <BlurView
                        intensity={85}
                        tint="light"
                        style={StyleSheet.absoluteFill}
                    />
                ) : (
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.95)' }]} />
                )
            )}

            {/* Top Accent Border */}
            <LinearGradient
                colors={[Colors.brand.primary, Colors.brand.secondary, Colors.brand.accent]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.topBorder}
            />

            {/* Progress Bar — seekable */}
            <View
                style={styles.progressTrack}
                onLayout={(e) => { progressBarWidth.current = e.nativeEvent.layout.width; }}
                onStartShouldSetResponder={() => true}
                onResponderGrant={(e) => handleSeek(e.nativeEvent.locationX)}
                onResponderMove={(e) => handleSeek(e.nativeEvent.locationX)}
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
                <View
                    style={[
                        styles.scrubberKnob,
                        { left: `${progress * 100}%` as any },
                    ]}
                />
            </View>

            {/* Main Row */}
            <View style={styles.row}>
                {/* Animated icon */}
                <Animated.View
                    style={[
                        styles.iconWrap,
                        {
                            backgroundColor: Colors.brand.primary + '20',
                            transform: [{ scale: pulseAnim }],
                        },
                    ]}
                >
                    <Ionicons
                        name={isBuffering ? 'radio-outline' : 'headset'}
                        size={18}
                        color={Colors.brand.primary}
                    />
                </Animated.View>

                {/* Track info */}
                <View style={styles.info}>
                    <Text
                        style={[styles.trackTitle, { color: c.text }]}
                        numberOfLines={1}
                    >
                        {track?.title ?? 'Audio Summary'}
                    </Text>
                    <View style={styles.timeRow}>
                        <Text style={[styles.timeText, { color: c.textTertiary }]}>
                            {formatTime(positionMillis)}
                        </Text>
                        <Text style={[styles.timeSep, { color: c.textTertiary }]}> / </Text>
                        <Text style={[styles.timeText, { color: c.textTertiary }]}>
                            {formatTime(durationMillis)}
                        </Text>
                        {isBuffering && (
                            <Text style={[styles.bufferingBadge, { color: Colors.brand.accent }]}>
                              · Loading…
                            </Text>
                        )}
                    </View>
                </View>

                {/* Play/Pause */}
                <TouchableOpacity
                    onPress={togglePlay}
                    style={styles.playBtn}
                    activeOpacity={0.8}
                >
                    <LinearGradient
                        colors={[Colors.brand.primary, Colors.brand.secondary]}
                        style={styles.playBtnGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    >
                        <Ionicons
                            name={isPlaying ? 'pause' : 'play'}
                            size={18}
                            color="#fff"
                            style={{ marginLeft: isPlaying ? 0 : 2 }}
                        />
                    </LinearGradient>
                </TouchableOpacity>

                {/* Stop / close */}
                <TouchableOpacity
                    onPress={stopPlayback}
                    style={[styles.stopBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)' }]}
                    activeOpacity={0.7}
                >
                    <Ionicons name="close" size={16} color={c.textSecondary} />
                </TouchableOpacity>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        left: 12,
        right: 12,
        borderRadius: BorderRadius['2xl'],
        overflow: 'hidden',
        // Shadow
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.18,
        shadowRadius: 20,
        elevation: 16,
        zIndex: 999,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    topBorder: {
        height: 2,
        width: '100%',
    },
    progressTrack: {
        height: 3,
        backgroundColor: 'rgba(128,128,128,0.18)',
        marginHorizontal: 16,
        marginTop: 8,
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
        top: -4,
        width: 11,
        height: 11,
        borderRadius: 6,
        backgroundColor: Colors.brand.primary,
        marginLeft: -5.5,
        shadowColor: Colors.brand.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 4,
        elevation: 4,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 12,
        paddingBottom: 14,
        gap: 10,
    },
    iconWrap: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    info: {
        flex: 1,
    },
    trackTitle: {
        fontSize: FontSize.sm,
        fontWeight: '700',
        letterSpacing: -0.2,
        marginBottom: 2,
    },
    timeRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    timeText: {
        fontSize: 11,
        fontWeight: '600',
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    timeSep: {
        fontSize: 11,
    },
    bufferingBadge: {
        fontSize: 11,
        fontWeight: '600',
        fontStyle: 'italic',
    },
    playBtn: {
        borderRadius: 14,
        overflow: 'hidden',
    },
    playBtnGradient: {
        width: 44,
        height: 44,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    stopBtn: {
        width: 34,
        height: 34,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
