import React, { useState, useRef } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity,
    FlatList, Animated, ViewToken, useWindowDimensions, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';

const SLIDES = [
    {
        id: '1',
        icon: 'analytics' as const,
        title: 'Expert Equity Research',
        subtitle: 'AI-powered research reports on Indian equities, crafted with deep fundamental analysis.',
    },
    {
        id: '2',
        icon: 'headset' as const,
        title: 'Audio & Video Briefings',
        subtitle: 'Listen to AI-narrated summaries or watch video research briefs — invest on the go.',
    },
    {
        id: '3',
        icon: 'pie-chart' as const,
        title: 'Smart Portfolio Tracking',
        subtitle: 'Track your investments, view P&L, and get personalized recommendations based on your risk profile.',
    },
];

export default function OnboardingScreen() {
    const theme = useColorScheme();
    const c = Colors[theme];
    const { width } = useWindowDimensions();
    const [currentIndex, setCurrentIndex] = useState(0);
    const scrollX = useRef(new Animated.Value(0)).current;
    const flatListRef = useRef<FlatList>(null);

    const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
        if (viewableItems.length > 0 && viewableItems[0].index != null) {
            setCurrentIndex(viewableItems[0].index);
        }
    }).current;

    const handleNext = () => {
        if (currentIndex < SLIDES.length - 1) {
            flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
        } else {
            router.replace('/(auth)/login');
        }
    };

    const isWideWeb = Platform.OS === 'web' && width >= 768;

    const renderSlide = ({ item }: { item: typeof SLIDES[0] }) => (
        <View style={[styles.slide, { width }]}>
            <View style={isWideWeb ? { maxWidth: 480, alignItems: 'center' as const } : undefined}>
                <View style={[styles.iconCircle, { backgroundColor: Colors.brand.primary + '10' }]}>
                    <Ionicons name={item.icon} size={48} color={Colors.brand.primary} />
                </View>
                <Text style={[styles.slideTitle, { color: c.text }]}>{item.title}</Text>
                <Text style={[styles.slideSubtitle, { color: c.textSecondary }]}>{item.subtitle}</Text>
            </View>
        </View>
    );

    return (
        <View style={[styles.container, { backgroundColor: c.background }]}>
            {/* Brand */}
            <View style={styles.brandHeader}>
                <Text style={[styles.brandName, { color: Colors.brand.primary }]}>Tikona</Text>
                <Text style={[styles.brandSuffix, { color: c.textTertiary }]}>Capital</Text>
            </View>

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
                    const dotWidth = scrollX.interpolate({ inputRange, outputRange: [8, 24, 8], extrapolate: 'clamp' });
                    const opacity = scrollX.interpolate({ inputRange, outputRange: [0.3, 1, 0.3], extrapolate: 'clamp' });
                    return (
                        <Animated.View key={i} style={[styles.dot, { width: dotWidth, opacity, backgroundColor: Colors.brand.primary }]} />
                    );
                })}
            </View>

            {/* Actions */}
            <View style={[styles.bottomActions, isWideWeb && { maxWidth: 480, alignSelf: 'center' as const, width: '100%' }]}>
                <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
                    <Text style={[styles.skipText, { color: c.textTertiary }]}>Skip</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.nextButton, { backgroundColor: Colors.brand.primary }]}
                    onPress={handleNext}
                    activeOpacity={0.85}
                >
                    <Text style={styles.nextButtonText}>
                        {currentIndex === SLIDES.length - 1 ? 'Get Started' : 'Next'}
                    </Text>
                    <Ionicons name="arrow-forward" size={18} color="#fff" />
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    brandHeader: {
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'center',
        paddingTop: Platform.select({ ios: 70, web: 30, default: 50 }),
        gap: 6,
    },
    brandName: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
    brandSuffix: { fontSize: 20, fontWeight: '400' },
    slide: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    iconCircle: {
        width: 100,
        height: 100,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 32,
    },
    slideTitle: {
        fontSize: FontSize['3xl'],
        fontWeight: '800',
        textAlign: 'center',
        marginBottom: 14,
        letterSpacing: -0.3,
    },
    slideSubtitle: {
        fontSize: FontSize.base,
        textAlign: 'center',
        lineHeight: 22,
        maxWidth: 300,
    },
    dotRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 20,
    },
    dot: {
        height: 8,
        borderRadius: 4,
    },
    bottomActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: Spacing['2xl'],
        paddingBottom: Platform.OS === 'ios' ? 50 : 32,
    },
    skipText: { fontSize: FontSize.md, fontWeight: '500' },
    nextButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: BorderRadius.lg,
    },
    nextButtonText: {
        color: '#fff',
        fontSize: FontSize.md,
        fontWeight: '700',
    },
});
