import { Logo } from '@/components/Logo';
import { BorderRadius, Colors, FontSize, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
    Animated,
    FlatList,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    ViewToken,
    useWindowDimensions
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SLIDES = [
    {
        id: '1',
        icon: 'shield-checkmark' as const,
        badge: 'SEBI Registered Research Analyst',
        badgeIcon: 'shield-checkmark' as const,
        title: 'Driven by Research,\nBuilt with Networks,\nAct with Conviction.',
        subtitle: 'Trusted by investors across India for expert equity research and analysis.',
        regNo: 'SEBI Registration No. INH000069807\nBSE Enlistment Number: 5585',
    },
    {
        id: '2',
        icon: 'document-text' as const,
        badge: 'Institutional Research Expertise',
        badgeIcon: 'business-outline' as const,
        title: 'Curated Research\nReports',
        subtitle: 'Get curated research reports based on your preference and risk profile.',
        regNo: null,
    },
    {
        id: '3',
        icon: 'headset' as const,
        badge: '20 yrs Experience Across Market Cycles',
        badgeIcon: 'time-outline' as const,
        title: 'Listen to\nResearch Reports',
        subtitle: 'Add conviction on curated ideas \u2014 listen to AI-narrated audio summaries of our research.',
        regNo: null,
    },
];

const DISCLAIMER = 'Investment in securities market are subject to market risks.\nRead all the related documents carefully before investing.';

const CARD_WIDTH = 860;
const LEFT_PANEL_W = 300;

export default function OnboardingScreen() {
    const theme = useColorScheme();
    const c = Colors[theme];
    const isDark = theme === 'dark';
    const { width, height } = useWindowDimensions();
    const [currentIndex, setCurrentIndex] = useState(0);
    const scrollX = useRef(new Animated.Value(0)).current;
    const flatListRef = useRef<FlatList>(null);
    const insets = useSafeAreaInsets();

    const isWideWeb = Platform.OS === 'web' && width >= 768;
    const isSmallScreen = height < 680;

    // Right panel width inside the desktop card
    const rightPanelW = CARD_WIDTH - LEFT_PANEL_W;

    const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
        if (viewableItems.length > 0 && viewableItems[0].index != null) {
            setCurrentIndex(viewableItems[0].index);
        }
    }).current;

    const handleNext = async () => {
        if (currentIndex < SLIDES.length - 1) {
            flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
        } else {
            try { await AsyncStorage.setItem('has_seen_onboarding', 'true'); } catch { }
            router.replace('/(auth)/register');
        }
    };

    const handleSkip = async () => {
        try { await AsyncStorage.setItem('has_seen_onboarding', 'true'); } catch { }
        router.replace('/(auth)/login');
    };

    // ─── Desktop right-panel slide ────────────────────────────────────────────
    const renderDesktopSlide = ({ item }: { item: typeof SLIDES[0] }) => (
        <View style={{ width: rightPanelW, flex: 1, justifyContent: 'center' as const, paddingHorizontal: 44, paddingVertical: 48 }}>
            {/* SEBI Badge */}
            <LinearGradient
                colors={isDark ? ['#FFA50030', '#FFA50018'] : ['#FFA50014', '#FFA50008']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={[styles.sebiBadge, { alignSelf: 'flex-start' as const, marginBottom: 20 }]}
            >
                <Ionicons name={item.badgeIcon} size={12} color={isDark ? '#FFB84D' : '#FFA500'} />
                <Text style={[styles.sebiBadgeText, { color: isDark ? '#FFB84D' : '#E8950A' }]}>
                    {item.badge}
                </Text>
            </LinearGradient>

            {/* Title */}
            <Text style={[styles.slideTitle, {
                color: isDark ? '#FFFFFF' : c.text,
                fontSize: 28,
                lineHeight: 38,
                textAlign: 'left' as const,
                marginBottom: 14,
            }]}>
                {item.title}
            </Text>

            {/* Subtitle */}
            <Text style={[styles.slideSubtitle, {
                color: isDark ? '#B0B8C8' : c.textSecondary,
                fontSize: 15,
                lineHeight: 24,
                textAlign: 'left' as const,
            }]}>
                {item.subtitle}
            </Text>

            {/* Reg number */}
            {item.regNo && (
                <View style={{ marginTop: 24, gap: 4 }}>
                    {item.regNo.split('\n').map((line, index) => (
                        <Text key={index} style={{ color: isDark ? '#7B9FD4' : '#3A5BA0', fontSize: 11, fontWeight: '600', letterSpacing: 0.5 }}>
                            {line}
                        </Text>
                    ))}
                </View>
            )}
        </View>
    );

    // ─── Mobile slide ─────────────────────────────────────────────────────────
    const renderMobileSlide = ({ item }: { item: typeof SLIDES[0] }) => (
        <View style={[styles.slide, { width }]}>

            {/* ── Top: Logo ── */}
            <View style={{ alignItems: 'center' as const, marginBottom: 20 }}>
                <Logo size={isSmallScreen ? 58 : 68} fontSize={isSmallScreen ? 15 : 17} stacked={true} textColor="#3A5BA0" />
            </View>

            {/* ── Middle: Badge + Title + Subtitle (expands to fill space) ── */}
            <View style={{ flex: 1, justifyContent: 'flex-start' as const, alignItems: 'center' as const, paddingTop: 30 }}>
                <LinearGradient
                    colors={isDark ? ['#FFA50030', '#FFA50018'] : ['#FFA50014', '#FFA50008']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={[styles.sebiBadge, { marginBottom: 30 }]}
                >
                    <Ionicons name={item.badgeIcon} size={12} color={isDark ? '#FFB84D' : '#FFA500'} />
                    <Text style={[styles.sebiBadgeText, { color: isDark ? '#FFB84D' : '#E8950A' }]}>
                        {item.badge}
                    </Text>
                </LinearGradient>

                <Text style={[styles.slideTitle, {
                    color: isDark ? '#FFFFFF' : c.text,
                    fontSize: isSmallScreen ? 21 : 24,
                    lineHeight: isSmallScreen ? 29 : 33,
                }]}>
                    {item.title}
                </Text>
                <Text style={[styles.slideSubtitle, {
                    color: isDark ? '#B0B8C8' : c.textSecondary,
                    maxWidth: 300,
                }]}>
                    {item.subtitle}
                </Text>
            </View>

            {/* ── Bottom: Icon or RegNo (anchored at bottom) ── */}
            <View style={{ alignItems: 'center' as const, paddingBottom: isSmallScreen ? 12 : 20 }}>
                {item.regNo ? (
                    <View style={{ alignItems: 'center', gap: 4 }}>
                        {item.regNo.split('\n').map((line, index) => (
                            <Text key={index} style={{ color: isDark ? '#7B9FD4' : '#3A5BA0', fontSize: 10, fontWeight: '600', letterSpacing: 0.5, textAlign: 'center' }}>
                                {line}
                            </Text>
                        ))}
                    </View>
                ) : (
                    <LinearGradient
                        colors={isDark ? ['#3A5BA028', '#FFA50018'] : ['#1F469015', '#FFA50010']}
                        style={[styles.featureIconCircle, { width: isSmallScreen ? 80 : 96, height: isSmallScreen ? 80 : 96 }]}
                    >
                        <Ionicons name={item.icon} size={isSmallScreen ? 36 : 44} color={isDark ? '#7B9FD4' : Colors.brand.secondary} />
                    </LinearGradient>
                )}
            </View>

        </View>
    );

    // ─── Desktop layout ───────────────────────────────────────────────────────
    if (isWideWeb) {
        const slide = SLIDES[currentIndex];
        return (
            <LinearGradient
                colors={isDark ? ['#0C0F14', '#111827', '#0C0F14'] : ['#EEF2FF', '#F8FAFF', '#EEF2FF']}
                style={styles.container}
            >
                {/* Background deco */}
                <View style={[styles.decoCircle1, { backgroundColor: isDark ? '#1F469015' : '#1F469010' }]} />
                <View style={[styles.decoCircle2, { backgroundColor: isDark ? '#FFA50010' : '#FFA50008' }]} />

                {/* Centered card */}
                <View style={styles.desktopOuter}>
                    <View style={[styles.desktopCard, {
                        backgroundColor: isDark ? '#1A1F2E' : '#FFFFFF',
                        borderColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(31,70,144,0.10)',
                        ...(Platform.OS === 'web' ? {
                            boxShadow: isDark
                                ? '0 24px 80px rgba(0,0,0,0.5)'
                                : '0 24px 80px rgba(31,70,144,0.14)',
                        } as any : {
                            shadowColor: '#1F4690',
                            shadowOffset: { width: 0, height: 12 },
                            shadowOpacity: 0.15,
                            shadowRadius: 40,
                            elevation: 10,
                        }),
                    }]}>

                        {/* ── Left blue panel ── */}
                        <LinearGradient
                            colors={isDark ? ['#1E3A7A', '#152B5E'] : ['#1F4690', '#2D5CB8']}
                            style={styles.desktopLeft}
                        >
                            <View style={styles.leftDeco1} />
                            <View style={styles.leftDeco2} />

                            <View style={{ alignItems: 'center', zIndex: 1 }}>
                                <Logo size={58} fontSize={16} stacked={true} textColor="#FFFFFF" />

                                {/* Icon visual */}
                                <LinearGradient
                                    colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.07)']}
                                    style={styles.leftIconCircle}
                                >
                                    <Ionicons name={slide.icon} size={48} color="rgba(255,255,255,0.92)" />
                                </LinearGradient>

                                {/* Slide progress dots */}
                                <View style={styles.leftDots}>
                                    {SLIDES.map((_, i) => (
                                        <View key={i} style={[
                                            styles.leftDot,
                                            { backgroundColor: i === currentIndex ? '#FFFFFF' : 'rgba(255,255,255,0.3)', width: i === currentIndex ? 20 : 8 }
                                        ]} />
                                    ))}
                                </View>
                            </View>
                        </LinearGradient>

                        {/* ── Right content panel ── */}
                        <View style={[styles.desktopRight, { backgroundColor: isDark ? '#1A1F2E' : '#FFFFFF' }]}>
                            <FlatList
                                ref={flatListRef}
                                data={SLIDES}
                                renderItem={renderDesktopSlide}
                                keyExtractor={(item) => item.id}
                                horizontal
                                pagingEnabled
                                showsHorizontalScrollIndicator={false}
                                scrollEnabled={false}
                                onScroll={Animated.event(
                                    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                                    { useNativeDriver: false }
                                )}
                                onViewableItemsChanged={onViewableItemsChanged}
                                viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
                                style={{ flex: 1 }}
                                getItemLayout={(_, index) => ({ length: rightPanelW, offset: rightPanelW * index, index })}
                            />

                            {/* Actions */}
                            <View style={[styles.desktopActions, {
                                borderTopColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(31,70,144,0.08)',
                            }]}>
                                <TouchableOpacity onPress={handleSkip} style={styles.skipBtn}>
                                    <Text style={[styles.skipText, { color: c.textTertiary }]}>Sign In</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={handleNext} activeOpacity={0.85}>
                                    <LinearGradient
                                        colors={['#1F4690', '#3A5BA0']}
                                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                                        style={[styles.nextButton, { paddingLeft: 28, paddingVertical: 9 }]}
                                    >
                                        <Text style={[styles.nextButtonText, { fontSize: FontSize.md }]}>
                                            {currentIndex === SLIDES.length - 1 ? 'Create Account' : 'Next'}
                                        </Text>
                                        <View style={[styles.nextArrowCircle, { width: 38, height: 38 }]}>
                                            <Ionicons name="arrow-forward" size={17} color="#fff" />
                                        </View>
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>
                        </View>

                    </View>

                    {/* Disclaimer below card */}
                    <View style={[styles.desktopDisclaimer, { alignSelf: 'center' }]}>
                        <Text style={[styles.disclaimerText, { color: isDark ? '#8B95A8' : c.textTertiary, fontSize: 11, textAlign: 'center' }]}>
                            {DISCLAIMER}
                        </Text>
                    </View>
                </View>
            </LinearGradient>
        );
    }

    // ─── Mobile layout ────────────────────────────────────────────────────────
    return (
        <LinearGradient
            colors={isDark ? ['#0C0F14', '#111827', '#0C0F14'] : ['#F0F4FF', '#FFFFFF', '#F0FFF4']}
            style={styles.container}
        >
            <View style={[styles.decoCircle1, { backgroundColor: '#1F469008' }]} />
            <View style={[styles.decoCircle2, { backgroundColor: isDark ? '#FFA50008' : '#FFA50006' }]} />

            <FlatList
                ref={flatListRef}
                data={SLIDES}
                renderItem={renderMobileSlide}
                keyExtractor={(item) => item.id}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: false })}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
                getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
                style={{ flex: 1 }}
            />

            <View style={styles.dotRow}>
                {SLIDES.map((_, i) => {
                    const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
                    const dotWidth = scrollX.interpolate({ inputRange, outputRange: [8, 28, 8], extrapolate: 'clamp' });
                    const opacity = scrollX.interpolate({ inputRange, outputRange: [0.25, 1, 0.25], extrapolate: 'clamp' });
                    return (
                        <Animated.View key={i} style={[styles.dot, { width: dotWidth, opacity, backgroundColor: Colors.brand.secondary }]} />
                    );
                })}
            </View>

            {/* Bottom Footer block containing Disclaimer and Actions */}
            <View style={{
                borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(31,70,144,0.08)',
                borderTopWidth: 1,
                backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(31,70,144,0.03)',
            }}>
                <View style={[styles.mobileDisclaimerBar, { borderTopWidth: 0, paddingBottom: 10 }]}>
                    <Text style={[styles.disclaimerText, { color: isDark ? '#8B95A8' : c.textTertiary, textAlign: 'center', fontSize: 10, flex: 1 }]}>
                        {DISCLAIMER}
                    </Text>
                </View>

                {/* Separator Line */}
                <View style={{
                    height: 1,
                    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(31,70,144,0.1)',
                    marginHorizontal: Spacing['2xl'],
                    marginBottom: 16
                }} />

                <View style={[styles.bottomActions, { paddingBottom: Math.max(insets.bottom, 24) }]}>
                    <TouchableOpacity onPress={handleSkip} style={styles.skipBtn}>
                        <Text style={[styles.skipText, { color: c.textTertiary }]}>Sign In</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleNext} activeOpacity={0.85}>
                        <LinearGradient
                            colors={['#1F4690', '#3A5BA0']}
                            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                            style={styles.nextButton}
                        >
                            <Text style={styles.nextButtonText}>
                                {currentIndex === SLIDES.length - 1 ? 'Create Account' : 'Next'}
                            </Text>
                            <View style={styles.nextArrowCircle}>
                                <Ionicons name="arrow-forward" size={16} color="#fff" />
                            </View>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </View>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, overflow: 'hidden', width: '100%' },

    decoCircle1: {
        position: 'absolute', top: -80, right: -60,
        width: 260, height: 260, borderRadius: 130,
    },
    decoCircle2: {
        position: 'absolute', bottom: 100, left: -80,
        width: 220, height: 220, borderRadius: 110,
    },

    // ── Desktop layout ──
    desktopOuter: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 40,
        paddingHorizontal: 24,
    },
    desktopCard: {
        width: CARD_WIDTH,
        maxWidth: '100%',
        flexDirection: 'row',
        borderRadius: 24,
        borderWidth: 1,
        overflow: 'hidden',
        minHeight: 440,
    },

    // Left panel
    desktopLeft: {
        width: LEFT_PANEL_W,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 48,
        paddingHorizontal: 24,
        overflow: 'hidden',
    },
    leftDeco1: {
        position: 'absolute', top: -50, right: -50,
        width: 180, height: 180, borderRadius: 90,
        backgroundColor: 'rgba(255,255,255,0.06)',
    },
    leftDeco2: {
        position: 'absolute', bottom: -30, left: -40,
        width: 140, height: 140, borderRadius: 70,
        backgroundColor: 'rgba(255,255,255,0.04)',
    },
    leftIconCircle: {
        width: 110,
        height: 110,
        borderRadius: 55,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 36,
        marginBottom: 36,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
    },
    leftDots: {
        flexDirection: 'row',
        gap: 8,
        alignItems: 'center',
    },
    leftDot: {
        height: 6,
        borderRadius: 3,
    },

    // Right panel
    desktopRight: {
        flex: 1,
        flexDirection: 'column',
    },
    desktopActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 44,
        paddingVertical: 18,
        borderTopWidth: 1,
    },
    desktopRegNo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 10,
        borderWidth: 1,
        alignSelf: 'flex-start' as const,
    },

    desktopDisclaimer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginTop: 20,
        paddingHorizontal: 16,
        maxWidth: CARD_WIDTH,
        width: '100%',
    },

    // ── Mobile slide ──
    slide: {
        flex: 1,
        flexDirection: 'column',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 28,
        paddingTop: 60,
    },

    sebiBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: BorderRadius.full,
    },
    sebiBadgeText: {
        fontSize: 10.5,
        fontWeight: '700',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },

    slideTitle: {
        fontWeight: '800',
        textAlign: 'center',
        marginBottom: 14,
        letterSpacing: -0.5,
    },
    slideSubtitle: {
        textAlign: 'center',
        lineHeight: 23,
        fontSize: FontSize.base,
        letterSpacing: 0.1,
    },

    regNoContainer: { alignItems: 'center' },
    regNoValue: { fontWeight: '700', letterSpacing: 0.8 },

    featureIconArea: { alignItems: 'center' },
    featureIconCircle: {
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
    },

    disclaimerContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 5,
        paddingHorizontal: 10,
    },
    disclaimerText: {
        fontSize: 9,
        lineHeight: 13,
    },

    // ── Dots (mobile) ──
    dotRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 7,
        paddingVertical: 20,
    },
    dot: { height: 7, borderRadius: 4 },

    // ── Actions ──
    bottomActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: Spacing['2xl'],
        paddingBottom: 16,
    },
    skipBtn: { paddingVertical: 12, paddingHorizontal: 8 },
    skipText: { fontSize: FontSize.md, fontWeight: '500' },
    nextButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingLeft: 24,
        paddingRight: 6,
        paddingVertical: 6,
        borderRadius: BorderRadius.xl,
    },
    nextButtonText: { color: '#fff', fontSize: FontSize.md, fontWeight: '700' },
    nextArrowCircle: {
        width: 38,
        height: 38,
        borderRadius: 13,
        backgroundColor: 'rgba(255,255,255,0.18)',
        justifyContent: 'center',
        alignItems: 'center',
    },

    // ── Mobile reg number pill ──
    mobileRegNo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
    },

    // ── Mobile disclaimer bar (bottom strip) ──
    mobileDisclaimerBar: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'center',
        gap: 6,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderTopWidth: 1,
        paddingBottom: Platform.OS === 'ios' ? 20 : 10,
    },
});
