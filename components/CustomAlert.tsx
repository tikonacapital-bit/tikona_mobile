import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    Animated,
    Easing,
    TouchableWithoutFeedback,
    Dimensions,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, BorderRadius, Spacing, FontSize } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export type AlertVariant = 'success' | 'error' | 'warning' | 'danger' | 'info' | 'confirm';

export interface AlertButton {
    text: string;
    onPress?: () => void;
    style?: 'default' | 'cancel' | 'destructive';
}

export interface CustomAlertProps {
    visible: boolean;
    title: string;
    message?: string;
    variant?: AlertVariant;
    buttons?: AlertButton[];
    onDismiss: () => void;
    autoDismissMs?: number;
}

/* ─── Variant Configurations ─── */
const variantConfig = {
    success: {
        icon: 'checkmark-circle' as const,
        lightColors: { bg: '#ECFDF5', border: '#A7F3D0', icon: '#059669', accent: '#10B981', glow: 'rgba(16,185,129,0.15)' },
        darkColors: { bg: '#0D1F17', border: '#1A3A2A', icon: '#34D399', accent: '#10B981', glow: 'rgba(52,211,153,0.12)' },
    },
    error: {
        icon: 'close-circle' as const,
        lightColors: { bg: '#FEF2F2', border: '#FECACA', icon: '#DC2626', accent: '#EF4444', glow: 'rgba(239,68,68,0.12)' },
        darkColors: { bg: '#1F0D0D', border: '#3A1A1A', icon: '#F87171', accent: '#EF4444', glow: 'rgba(248,113,113,0.12)' },
    },
    warning: {
        icon: 'warning' as const,
        lightColors: { bg: '#FFFBEB', border: '#FDE68A', icon: '#D97706', accent: '#F59E0B', glow: 'rgba(245,158,11,0.12)' },
        darkColors: { bg: '#1F1A0D', border: '#3A2F1A', icon: '#FBBF24', accent: '#F59E0B', glow: 'rgba(251,191,36,0.12)' },
    },
    danger: {
        icon: 'alert-circle' as const,
        lightColors: { bg: '#FEF2F2', border: '#FECACA', icon: '#DC2626', accent: '#DC2626', glow: 'rgba(220,38,38,0.12)' },
        darkColors: { bg: '#1F0D0D', border: '#3A1A1A', icon: '#F87171', accent: '#DC2626', glow: 'rgba(248,113,113,0.12)' },
    },
    info: {
        icon: 'information-circle' as const,
        lightColors: { bg: '#EFF6FF', border: '#BFDBFE', icon: '#2563EB', accent: '#3B82F6', glow: 'rgba(59,130,246,0.12)' },
        darkColors: { bg: '#0D1520', border: '#1A2A3A', icon: '#60A5FA', accent: '#3B82F6', glow: 'rgba(96,165,250,0.12)' },
    },
    confirm: {
        icon: 'help-circle' as const,
        lightColors: { bg: '#F0F4FF', border: '#C7D2FE', icon: '#4F46E5', accent: '#6366F1', glow: 'rgba(99,102,241,0.12)' },
        darkColors: { bg: '#12101F', border: '#252240', icon: '#A5B4FC', accent: '#6366F1', glow: 'rgba(165,180,252,0.12)' },
    },
};

export default function CustomAlert({
    visible,
    title,
    message,
    variant = 'confirm',
    buttons = [{ text: 'OK' }],
    onDismiss,
    autoDismissMs,
}: CustomAlertProps) {
    const colorScheme = useColorScheme() ?? 'dark';
    const c = Colors[colorScheme];
    const isDark = colorScheme === 'dark';

    const backdropOpacity = useRef(new Animated.Value(0)).current;
    const cardTranslateY = useRef(new Animated.Value(30)).current;
    const cardOpacity = useRef(new Animated.Value(0)).current;
    const cardScale = useRef(new Animated.Value(0.92)).current;
    const iconScale = useRef(new Animated.Value(0)).current;
    const iconRotate = useRef(new Animated.Value(0)).current;
    const progressAnim = useRef(new Animated.Value(0)).current;

    const vConfig = variantConfig[variant];
    const vColors = isDark ? vConfig.darkColors : vConfig.lightColors;

    useEffect(() => {
        if (visible) {
            // Reset values
            backdropOpacity.setValue(0);
            cardTranslateY.setValue(30);
            cardOpacity.setValue(0);
            cardScale.setValue(0.92);
            iconScale.setValue(0);
            iconRotate.setValue(0);
            progressAnim.setValue(0);

            // Staggered entrance animation
            Animated.sequence([
                // 1. Backdrop fades in
                Animated.timing(backdropOpacity, {
                    toValue: 1,
                    duration: 200,
                    easing: Easing.out(Easing.ease),
                    useNativeDriver: true,
                }),
                // 2. Card slides up + fades in
                Animated.parallel([
                    Animated.spring(cardTranslateY, {
                        toValue: 0,
                        friction: 9,
                        tension: 65,
                        useNativeDriver: true,
                    }),
                    Animated.timing(cardOpacity, {
                        toValue: 1,
                        duration: 250,
                        easing: Easing.out(Easing.ease),
                        useNativeDriver: true,
                    }),
                    Animated.spring(cardScale, {
                        toValue: 1,
                        friction: 8,
                        tension: 70,
                        useNativeDriver: true,
                    }),
                ]),
            ]).start(() => {
                // 3. Icon bounce in
                Animated.parallel([
                    Animated.spring(iconScale, {
                        toValue: 1,
                        friction: 5,
                        tension: 100,
                        useNativeDriver: true,
                    }),
                    variant === 'success'
                        ? Animated.timing(iconRotate, {
                            toValue: 1,
                            duration: 400,
                            easing: Easing.out(Easing.back(1.5)),
                            useNativeDriver: true,
                        })
                        : Animated.timing(iconRotate, { toValue: 0, duration: 0, useNativeDriver: true }),
                ]).start();
            });

            // Auto dismiss progress
            if (autoDismissMs) {
                Animated.timing(progressAnim, {
                    toValue: 1,
                    duration: autoDismissMs,
                    easing: Easing.linear,
                    useNativeDriver: false,
                }).start();

                const timer = setTimeout(() => handleClose(), autoDismissMs);
                return () => clearTimeout(timer);
            }
        }
    }, [visible, autoDismissMs]);

    const handleClose = (callback?: () => void) => {
        Animated.parallel([
            Animated.timing(backdropOpacity, {
                toValue: 0,
                duration: 200,
                easing: Easing.in(Easing.ease),
                useNativeDriver: true,
            }),
            Animated.timing(cardOpacity, {
                toValue: 0,
                duration: 180,
                easing: Easing.in(Easing.ease),
                useNativeDriver: true,
            }),
            Animated.timing(cardScale, {
                toValue: 0.92,
                duration: 180,
                easing: Easing.in(Easing.ease),
                useNativeDriver: true,
            }),
            Animated.timing(cardTranslateY, {
                toValue: 20,
                duration: 180,
                easing: Easing.in(Easing.ease),
                useNativeDriver: true,
            }),
        ]).start(() => {
            onDismiss();
            if (callback) callback();
        });
    };

    if (!visible) return null;

    const iconRotation = iconRotate.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    // Sort buttons: cancel first, primary/destructive last
    const sortedButtons = [...buttons].sort((a, b) => {
        if (a.style === 'cancel') return -1;
        if (b.style === 'cancel') return 1;
        return 0;
    });

    return (
        <Modal transparent visible={visible} animationType="none" onRequestClose={() => handleClose()}>
            <TouchableWithoutFeedback onPress={() => handleClose()}>
                <Animated.View style={[styles.overlay, { opacity: backdropOpacity }]}>
                    {/* Dark backdrop */}
                    <View style={[
                        StyleSheet.absoluteFillObject,
                        { backgroundColor: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.45)' },
                    ]} />

                    <TouchableWithoutFeedback>
                        <Animated.View style={[
                            styles.cardOuter,
                            {
                                opacity: cardOpacity,
                                transform: [
                                    { translateY: cardTranslateY },
                                    { scale: cardScale },
                                ],
                            },
                        ]}>
                            {/* Card */}
                            <View style={[
                                styles.card,
                                {
                                    backgroundColor: isDark ? '#1A1F2E' : '#FFFFFF',
                                    borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                                    ...(Platform.OS === 'ios' ? {
                                        shadowColor: '#000',
                                        shadowOffset: { width: 0, height: 16 },
                                        shadowOpacity: isDark ? 0.6 : 0.2,
                                        shadowRadius: 32,
                                    } : { elevation: 24 }),
                                },
                            ]}>
                                {/* Accent strip at top */}
                                <LinearGradient
                                    colors={[vColors.accent, `${vColors.accent}88`]}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={styles.accentStrip}
                                />

                                {/* Icon badge */}
                                <View style={styles.iconBadgeWrapper}>
                                    <Animated.View style={[
                                        styles.iconBadge,
                                        {
                                            backgroundColor: vColors.glow,
                                            borderColor: `${vColors.accent}30`,
                                            transform: [
                                                { scale: iconScale },
                                                ...(variant === 'success' ? [{ rotate: iconRotation }] : []),
                                            ],
                                        },
                                    ]}>
                                        <View style={[styles.iconInner, { backgroundColor: `${vColors.accent}18` }]}>
                                            <Ionicons
                                                name={vConfig.icon}
                                                size={32}
                                                color={vColors.icon}
                                            />
                                        </View>
                                    </Animated.View>
                                </View>

                                {/* Content */}
                                <View style={styles.content}>
                                    <Text style={[
                                        styles.title,
                                        { color: c.text },
                                    ]}>
                                        {title}
                                    </Text>

                                    {message ? (
                                        <Text style={[
                                            styles.message,
                                            { color: c.textSecondary },
                                        ]}>
                                            {message}
                                        </Text>
                                    ) : null}
                                </View>

                                {/* Divider */}
                                <View style={[
                                    styles.divider,
                                    { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' },
                                ]} />

                                {/* Buttons */}
                                <View style={[
                                    styles.buttonRow,
                                    sortedButtons.length > 2 && styles.buttonColumn,
                                ]}>
                                    {sortedButtons.map((btn, index) => {
                                        const isLast = index === sortedButtons.length - 1;
                                        const isPrimary = btn.style !== 'cancel' && isLast;
                                        const isCancel = btn.style === 'cancel';
                                        const isDestructive = btn.style === 'destructive' || (variant === 'danger' && isPrimary);

                                        // Add separator between buttons (horizontal layout)
                                        const showVertDivider = sortedButtons.length <= 2 && index < sortedButtons.length - 1;

                                        return (
                                            <React.Fragment key={index}>
                                                <TouchableOpacity
                                                    style={[
                                                        styles.button,
                                                        sortedButtons.length <= 2 && styles.buttonFlex,
                                                        sortedButtons.length > 2 && styles.buttonFullWidth,
                                                    ]}
                                                    onPress={() => handleClose(btn.onPress)}
                                                    activeOpacity={0.6}
                                                >
                                                    {isPrimary ? (
                                                        <LinearGradient
                                                            colors={isDestructive
                                                                ? ['#EF4444', '#DC2626']
                                                                : [Colors.brand.secondary, '#1D4ED8']
                                                            }
                                                            start={{ x: 0, y: 0 }}
                                                            end={{ x: 1, y: 1 }}
                                                            style={styles.buttonGradientInner}
                                                        >
                                                            <Text style={[styles.buttonText, styles.buttonTextPrimary]}>
                                                                {btn.text}
                                                            </Text>
                                                        </LinearGradient>
                                                    ) : (
                                                        <View style={[
                                                            styles.buttonPlain,
                                                            isCancel && {
                                                                backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                                                            },
                                                        ]}>
                                                            <Text style={[
                                                                styles.buttonText,
                                                                {
                                                                    color: isCancel
                                                                        ? c.textSecondary
                                                                        : isDestructive
                                                                            ? c.danger
                                                                            : c.text,
                                                                    fontWeight: isCancel ? '500' : '600',
                                                                },
                                                            ]}>
                                                                {btn.text}
                                                            </Text>
                                                        </View>
                                                    )}
                                                </TouchableOpacity>
                                                {showVertDivider && (
                                                    <View style={[
                                                        styles.vertDivider,
                                                        { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' },
                                                    ]} />
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                </View>

                                {/* Auto Dismiss Progress Bar */}
                                {!!autoDismissMs && (
                                    <View style={styles.progressContainer}>
                                        <Animated.View
                                            style={[
                                                styles.progressBar,
                                                {
                                                    backgroundColor: vColors.accent,
                                                    width: progressAnim.interpolate({
                                                        inputRange: [0, 1],
                                                        outputRange: ['0%', '100%'],
                                                    }),
                                                },
                                            ]}
                                        />
                                    </View>
                                )}
                            </View>
                        </Animated.View>
                    </TouchableWithoutFeedback>
                </Animated.View>
            </TouchableWithoutFeedback>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 28,
    },
    cardOuter: {
        width: '100%',
        maxWidth: 360,
    },
    card: {
        borderRadius: 20,
        borderWidth: 1,
        overflow: 'hidden',
    },
    accentStrip: {
        height: 3.5,
        width: '100%',
    },
    iconBadgeWrapper: {
        alignItems: 'center',
        marginTop: 28,
        marginBottom: 4,
    },
    iconBadge: {
        width: 64,
        height: 64,
        borderRadius: 32,
        borderWidth: 1.5,
        justifyContent: 'center',
        alignItems: 'center',
    },
    iconInner: {
        width: 52,
        height: 52,
        borderRadius: 26,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        paddingHorizontal: 24,
        paddingTop: 16,
        paddingBottom: 20,
        alignItems: 'center',
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        textAlign: 'center',
        letterSpacing: -0.3,
        marginBottom: 6,
    },
    message: {
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
        marginTop: 2,
        opacity: 0.85,
    },
    divider: {
        height: 1,
        width: '100%',
    },
    buttonRow: {
        flexDirection: 'row',
        minHeight: 50,
    },
    buttonColumn: {
        flexDirection: 'column',
    },
    button: {
        overflow: 'hidden',
    },
    buttonFlex: {
        flex: 1,
    },
    buttonFullWidth: {
        width: '100%',
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(128,128,128,0.1)',
    },
    buttonGradientInner: {
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonPlain: {
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonText: {
        fontSize: 15,
        fontWeight: '600',
        letterSpacing: 0.1,
    },
    buttonTextPrimary: {
        color: '#FFFFFF',
        fontWeight: '700',
    },
    vertDivider: {
        width: 1,
        alignSelf: 'stretch',
    },
    progressContainer: {
        height: 3,
        width: '100%',
        backgroundColor: 'rgba(128,128,128,0.1)',
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
    },
    progressBar: {
        height: '100%',
        borderTopRightRadius: 2,
        borderBottomRightRadius: 2,
    },
});
