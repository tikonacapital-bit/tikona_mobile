import React, { useState, useRef } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity,
    FlatList, Animated, ViewToken, useWindowDimensions, Platform,
    Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Logo } from '@/components/Logo';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SLIDES = [
    {
        id: '1',
        icon: 'shield-checkmark' as const,
        title: 'SEBI Registered\nResearch Analyst',
        subtitle: 'Trusted by investors across India for expert equity research and analysis.',
        regNo: 'INH000069807',
    },
    {
        id: '2',
        icon: 'headset' as const,
        title: 'Listen to\nResearch Reports',
        subtitle: 'Add conviction on curated ideas \u2014 listen to AI-narrated audio summaries of our research.',
        regNo: null,
    },
    {
        id: '3',
        icon: 'document-text' as const,
        title: 'Curated Research\nReports',
        subtitle: 'Get curated research reports based on your preference and risk profile.',
        regNo: null,
    },
];

const DISCLAIMER = 'Investment in securities market are subject to market risks. Read all the related documents carefully before investing.';

export default function OnboardingScreen() {
    const theme = useColorScheme();
    const c = Colors[theme];
    const isDark = theme === 'dark';
    const { width, height } = useWindowDimensions();
    const [currentIndex, setCurrentIndex] = useState(0);
    const scrollX = useRef(new Animated.Value(0)).current;
    const flatListRef = useRef<FlatList>(null);

    const isWideWeb = Platform.OS === 'web' && width >= 768;
    const isSmallScreen = height < 680;

    // Responsive sizes
    const logoSize = isWideWeb ? 80 : isSmallScreen ? 48 : 64;
    const titleSize = isWideWeb ? 36 : isSmallScreen ? 24 : 28;
    const titleLineHeight = isWideWeb ? 46 : isSmallScreen ? 30 : 36;
    const subtitleSize = isWideWeb ? 16 : FontSize.base;
    const subtitleMaxWidth = isWideWeb ? 420 : 300;
    const contentMaxWidth = isWideWeb ? 540 : '100%' as any;
    const iconSize = isWideWeb ? 54 : 44;
    const iconCircleSize = isWideWeb ? 110 : 90;

    const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
        if (viewableItems.length > 0 && viewableItems[0].index != null) {
            setCurrentIndex(viewableItems[0].index);
        }
    }).current;

    const handleNext = async () => {
        if (currentIndex < SLIDES.length - 1) {
            flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
        } else {
            try {
                await AsyncStorage.setItem('has_seen_onboarding', 'true');
            } catch (e) {
                console.error('Failed to save onboarding state:', e);
            }
            router.replace('/(auth)/login');
        }
    };

    const renderSlide = ({ item }: { item: typeof SLIDES[0] }) => (
        <View style={[styles.slide, { width }]}>
            <View style={{ maxWidth: contentMaxWidth, alignItems: 'center' as const, width: '100%' }}>

                {/* Brand Logo & Name */}
                <View style={{ marginBottom: isSmallScreen ? 20 : 32 }}>
                    <Logo
                        size={logoSize}
                        fontSize={isWideWeb ? 24 : 20}
                    />
                </View>

                {/* SEBI Registered Badge */}
                <LinearGradient
                    colors={isDark ? ['#FFA50030', '#FFA50018'] : ['#FFA50014', '#FFA50008']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={[styles.sebiBadge, { marginBottom: isSmallScreen ? 16 : isWideWeb ? 36 : 28 }]}
                >
                    <Ionicons name="shield-checkmark" size={13} color={isDark ? '#FFB84D' : '#FFA500'} />
                    <Text style={[styles.sebiBadgeText, { color: isDark ? '#FFB84D' : '#E8950A' }]}>SEBI Registered Research Analyst</Text>
                </LinearGradient>

                {/* Title */}
                <Text style={[styles.slideTitle, { color: isDark ? '#FFFFFF' : c.text, fontSize: titleSize, lineHeight: titleLineHeight }]}>{item.title}</Text>

                {/* Subtitle */}
                <Text style={[styles.slideSubtitle, { color: isDark ? '#B0B8C8' : c.textSecondary, fontSize: subtitleSize, maxWidth: subtitleMaxWidth }]}>{item.subtitle}</Text>

                {/* SEBI Registration Number (first slide only) */}
                {item.regNo && (
                    <View style={[styles.regNoContainer, { marginTop: isSmallScreen ? 16 : 24 }]}>
                        <Text style={[styles.regNoLabel, { color: isDark ? '#8B95A8' : c.textTertiary }]}>SEBI Registration No.</Text>
                        <Text style={[styles.regNoValue, { color: isDark ? '#7B9FD4' : Colors.brand.secondary, fontSize: isWideWeb ? 18 : 15 }]}>{item.regNo}</Text>
                    </View>
                )}

                {/* Feature icon for other slides */}
                {!item.regNo && (
                    <View style={[styles.featureIconArea, { marginTop: isSmallScreen ? 20 : 32 }]}>
                        <LinearGradient
                            colors={isDark ? ['#3A5BA028', '#FFA50018'] : ['#1F469015', '#FFA50010']}
                            style={[styles.featureIconCircle, { width: iconCircleSize, height: iconCircleSize }]}
                        >
                            <Ionicons name={item.icon} size={iconSize} color={isDark ? '#7B9FD4' : Colors.brand.secondary} />
                        </LinearGradient>
                    </View>
                )}

                {/* Market Risk Disclaimer */}
                <View style={[styles.disclaimerContainer, { marginTop: isSmallScreen ? 16 : 24, maxWidth: isWideWeb ? 400 : 300 }]}>
                    <Ionicons name="information-circle-outline" size={12} color={isDark ? '#8B95A8' : c.textTertiary} />
                    <Text style={[styles.disclaimerText, { color: isDark ? '#8B95A8' : c.textTertiary }]}>
                        {DISCLAIMER}
                    </Text>
                </View>
            </View>
        </View>
    );

    return (
        <LinearGradient
            colors={isDark
                ? ['#0C0F14', '#111827', '#0C0F14']
                : ['#F0F4FF', '#FFFFFF', '#F0FFF4']}
            style={styles.container}
        >
            {/* Decorative circles */}
            <View style={[styles.decoCircle1, { backgroundColor: '#1F469008' }]} />
            <View style={[styles.decoCircle2, { backgroundColor: isDark ? '#FFA50008' : '#FFA50006' }]} />

            {/* Slides */}
            <FlatList
                ref={flatListRef}
                data={SLIDES}
                renderItem={renderSlide}
                keyExtractor={(item) => item.id}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: false })}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
                getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
            />

            {/* Dots */}
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

            {/* Actions */}
            <View style={[styles.bottomActions, isWideWeb && { maxWidth: 540, alignSelf: 'center' as const, width: '100%' }]}>
                <TouchableOpacity onPress={async () => {
                    await AsyncStorage.setItem('has_seen_onboarding', 'true');
                    router.replace('/(auth)/login');
                }} style={styles.skipBtn}>
                    <Text style={[styles.skipText, { color: c.textTertiary }]}>Skip</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={handleNext} activeOpacity={0.85}>
                    <LinearGradient
                        colors={['#1F4690', '#3A5BA0']}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                        style={[styles.nextButton, isWideWeb && { paddingLeft: 32, paddingVertical: 8 }]}
                    >
                        <Text style={[styles.nextButtonText, isWideWeb && { fontSize: FontSize.lg }]}>
                            {currentIndex === SLIDES.length - 1 ? 'Get Started' : 'Next'}
                        </Text>
                        <View style={[styles.nextArrowCircle, isWideWeb && { width: 42, height: 42 }]}>
                            <Ionicons name="arrow-forward" size={isWideWeb ? 18 : 16} color="#fff" />
                        </View>
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },

    // Decorative background circles
    decoCircle1: {
        position: 'absolute', top: -80, right: -60,
        width: 260, height: 260, borderRadius: 130,
    },
    decoCircle2: {
        position: 'absolute', bottom: 100, left: -80,
        width: 220, height: 220, borderRadius: 110,
    },

    slide: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 28,
    },

    // Brand
    slideBrand: {
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'center',
        gap: 6,
        marginBottom: 10,
    },
    slideBrandName: { fontWeight: '700', letterSpacing: 3 },

    // SEBI Badge
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

    // Title & Subtitle
    slideTitle: {
        fontWeight: '800',
        textAlign: 'center',
        marginBottom: 14,
        letterSpacing: -0.5,
    },
    slideSubtitle: {
        textAlign: 'center',
        lineHeight: 23,
        letterSpacing: 0.1,
    },

    // SEBI Reg Number
    regNoContainer: {
        alignItems: 'center',
    },
    regNoLabel: {
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        marginBottom: 4,
    },
    regNoValue: {
        fontWeight: '700',
        letterSpacing: 0.8,
    },

    // Feature icon for slides 2 & 3
    featureIconArea: {
        alignItems: 'center',
    },
    featureIconCircle: {
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Disclaimer
    disclaimerContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 5,
        paddingHorizontal: 10,
    },
    disclaimerText: {
        fontSize: 9,
        lineHeight: 13,
        flex: 1,
    },

    // Dots
    dotRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 7,
        paddingVertical: 20,
    },
    dot: {
        height: 7,
        borderRadius: 4,
    },

    // Bottom Actions
    bottomActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: Spacing['2xl'],
        paddingBottom: Platform.OS === 'ios' ? 50 : 32,
    },
    skipBtn: {
        paddingVertical: 12,
        paddingHorizontal: 8,
    },
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
    nextButtonText: {
        color: '#fff',
        fontSize: FontSize.md,
        fontWeight: '700',
    },
    nextArrowCircle: {
        width: 38,
        height: 38,
        borderRadius: 13,
        backgroundColor: 'rgba(255,255,255,0.18)',
        justifyContent: 'center',
        alignItems: 'center',
    },
});
