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
    Platform,
    Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

export type AlertVariant = 'success' | 'error' | 'warning' | 'danger' | 'info' | 'confirm';

export interface AlertButton {
    text: string;
    onPress?: () => void;
    style?: 'default' | 'cancel' | 'destructive';
}

export interface CustomAlertProps {
    visible: boolean;
    title: string;
    message?: string | React.ReactNode;
    variant?: AlertVariant;
    buttons?: AlertButton[];
    onDismiss: () => void;
    autoDismissMs?: number;
}

const variantConfig = {
    success: { icon: 'checkmark-outline' as const, neon: '#00FF66' },
    error: { icon: 'close-outline' as const, neon: '#FF0033' },
    warning: { icon: 'warning-outline' as const, neon: '#FFB800' },
    danger: { icon: 'alert-circle-outline' as const, neon: '#EF4444' },
    info: { icon: 'cube-outline' as const, neon: '#00D1FF' },
    confirm: { icon: 'finger-print-outline' as const, neon: '#B026FF' },
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

    // Dynamic Nothing OS Theme for Modal
    const nc = {
        overlayBg: isDark ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.85)',
        cardInner: isDark ? '#000000' : '#FFFFFF',
        iconBg: isDark ? '#000000' : '#FFFFFF',
        text: isDark ? '#FFFFFF' : '#000000',
        textMuted: isDark ? '#888888' : '#666666',
        secondaryBtnBg: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
        blurTint: isDark ? 'dark' : 'light' as 'light' | 'dark',
        border: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
        red: '#FF1100',
    };

    const backdropOpacity = useRef(new Animated.Value(0)).current;
    const cardScale = useRef(new Animated.Value(1.1)).current;
    const cardOpacity = useRef(new Animated.Value(0)).current;
    
    const vConfig = variantConfig[variant];

    useEffect(() => {
        if (visible) {
            backdropOpacity.setValue(0);
            cardScale.setValue(1.1);
            cardOpacity.setValue(0);

            Animated.parallel([
                Animated.timing(backdropOpacity, {
                    toValue: 1,
                    duration: 400,
                    easing: Easing.out(Easing.bezier(0.2, 0.8, 0.2, 1)),
                    useNativeDriver: true,
                }),
                Animated.timing(cardOpacity, {
                    toValue: 1,
                    duration: 350,
                    easing: Easing.out(Easing.ease),
                    useNativeDriver: true,
                }),
                Animated.spring(cardScale, {
                    toValue: 1,
                    friction: 14,
                    tension: 40,
                    useNativeDriver: true,
                })
            ]).start();
        }
    }, [visible, autoDismissMs]);

    const handleClose = (callback?: () => void) => {
        Animated.parallel([
            Animated.timing(backdropOpacity, {
                toValue: 0,
                duration: 250,
                useNativeDriver: true,
            }),
            Animated.timing(cardOpacity, {
                toValue: 0,
                duration: 250,
                useNativeDriver: true,
            }),
            Animated.timing(cardScale, {
                toValue: 0.95,
                duration: 250,
                useNativeDriver: true,
            }),
        ]).start(() => {
            onDismiss();
            if (callback) callback();
        });
    };

    if (!visible) return null;

    const sortedButtons = [...buttons].sort((a, b) => {
        if (a.style === 'cancel') return -1;
        if (b.style === 'cancel') return 1;
        return 0;
    });

    const isSimple = sortedButtons.length <= 2;

    return (
        <Modal transparent visible={visible} animationType="none" onRequestClose={() => handleClose()}>
            {/* Matte Black / Blur Backdrop */}
            <TouchableWithoutFeedback onPress={() => handleClose()}>
                <Animated.View style={[styles.overlay, { opacity: backdropOpacity }]}>
                    <BlurView intensity={60} tint={nc.blurTint} style={StyleSheet.absoluteFill} />
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: nc.overlayBg }]} />

                    <TouchableWithoutFeedback>
                        <View style={styles.centeredWrapper}>
                            {/* Animated Scale Card */}
                            <Animated.View style={[
                                styles.cardOuter,
                                {
                                    opacity: cardOpacity,
                                    transform: [{ scale: cardScale }],
                                }
                            ]}>
                                {/* Border Mask */}
                                <View style={[styles.borderGlowMask, { backgroundColor: nc.border }]}>
                                    {/* Pure Window Interior */}
                                    <View style={[styles.cardInner, { backgroundColor: nc.cardInner }]}>
                                        
                                        {/* Neon Icon */}
                                        <View style={styles.header}>
                                            <View style={[styles.iconWrapper, { borderColor: isDark ? `${vConfig.neon}30` : `${vConfig.neon}60`, backgroundColor: nc.iconBg }]}>
                                                {/* Core glow behind icon */}
                                                <LinearGradient 
                                                    colors={[`${vConfig.neon}${isDark ? '40' : '20'}`, 'transparent']} 
                                                    style={StyleSheet.absoluteFillObject}
                                                    start={{x:0.5, y:0}}
                                                    end={{x:0.5, y:1}}
                                                />
                                                <Ionicons name={vConfig.icon} size={32} color={vConfig.neon} />
                                            </View>
                                        </View>

                                        {/* Text Section */}
                                        <View style={styles.body}>
                                            <Text style={[styles.title, { color: nc.text }]}>{title.toUpperCase()}</Text>
                                            
                                            {typeof message === 'string' ? (
                                                <Text style={[styles.messageString, { color: nc.textMuted }]}>{message}</Text>
                                            ) : (
                                                <View style={styles.messageNode}>{message}</View>
                                            )}
                                        </View>

                                        {/* Actions */}
                                        <View style={[styles.actionContainer, isSimple ? styles.actionRow : styles.actionColumn]}>
                                            {sortedButtons.map((btn, index) => {
                                                const isPrimary = btn.style !== 'cancel' && index === sortedButtons.length - 1;
                                                const isDestructive = btn.style === 'destructive' || (variant === 'danger' && isPrimary);
                                                
                                                const neonAccent = isDestructive ? nc.red : vConfig.neon;

                                                return (
                                                    <TouchableOpacity
                                                        key={index}
                                                        style={[
                                                            styles.button,
                                                            isSimple && { flex: 1 },
                                                        ]}
                                                        onPress={() => handleClose(btn.onPress)}
                                                        activeOpacity={0.65}
                                                    >
                                                        {isPrimary ? (
                                                            // Primary Action -> Hollow Neon Style
                                                            <View style={styles.primaryBtnWrap}>
                                                                <View style={[styles.primaryBtnBorder, { backgroundColor: neonAccent }]}>
                                                                    <View style={[styles.primaryBtnInner, { backgroundColor: neonAccent }]}>
                                                                        <Text style={[styles.btnText, { color: '#FFFFFF' }]}>
                                                                            {btn.text.toUpperCase()}
                                                                        </Text>
                                                                    </View>
                                                                </View>
                                                            </View>
                                                        ) : (
                                                            // Cancel/Secondary -> Faded text
                                                            <View style={[styles.secondaryBtnWrap, { backgroundColor: nc.secondaryBtnBg }]}>
                                                                <Text style={[styles.btnText, styles.secondaryBtnText, { color: nc.textMuted }]}>
                                                                    {btn.text}
                                                                </Text>
                                                            </View>
                                                        )}
                                                    </TouchableOpacity>
                                                );
                                            })}
                                        </View>

                                    </View>
                                </View>
                            </Animated.View>
                        </View>
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
        paddingHorizontal: 24,
    },
    centeredWrapper: {
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
    },
    cardOuter: {
        width: '100%',
        maxWidth: 400,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 20 },
                shadowOpacity: 0.8,
                shadowRadius: 40,
            },
            android: { elevation: 30 }
        })
    },
    borderGlowMask: {
        width: '100%',
        borderRadius: 20,
        padding: 1, // 1px glowing border
    },
    cardInner: {
        width: '100%',
        borderRadius: 19,
        overflow: 'hidden',
        padding: 24,
    },
    header: {
        alignItems: 'center',
        marginBottom: 20,
    },
    iconWrapper: {
        width: 68,
        height: 68,
        borderRadius: 34,
        borderWidth: 1.5,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    body: {
        alignItems: 'center',
        marginBottom: 32,
    },
    title: {
        fontSize: 20,
        fontWeight: '900',
        letterSpacing: 2,
        marginBottom: 12,
        textAlign: 'center',
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    messageString: {
        fontSize: 14,
        lineHeight: 22,
        textAlign: 'center',
        fontWeight: '500',
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    messageNode: {
        width: '100%',
    },
    actionContainer: {
        gap: 12,
    },
    actionRow: {
        flexDirection: 'row',
    },
    actionColumn: {
        flexDirection: 'column',
    },
    button: {
        justifyContent: 'center',
    },
    primaryBtnWrap: {
        width: '100%',
    },
    primaryBtnBorder: {
        padding: 1,
        borderRadius: 12,
    },
    primaryBtnInner: {
        paddingVertical: 14,
        borderRadius: 11,
        alignItems: 'center',
        justifyContent: 'center',
    },
    secondaryBtnWrap: {
        paddingVertical: 15,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    btnText: {
        fontSize: 13,
        fontWeight: '800',
        letterSpacing: 1.2,
        textAlign: 'center',
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    primaryBtnText: {
        // Removed text shadow for clean Nothing look
    },
    secondaryBtnText: {
        // Color is now injected in the style directly based on light/dark mode
    },
});
