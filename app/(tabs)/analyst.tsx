import React from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Colors, Spacing, BorderRadius, FontSize } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SECTOR_ANALYSTS } from '@/lib/analysts';

export default function AIAnalystScreen() {
    const theme = useColorScheme();
    const c = Colors[theme];
    const isDark = theme === 'dark';

    return (
        <View style={[styles.container, { backgroundColor: c.background }]}>
            {/* Premium Header */}
            <LinearGradient
                colors={isDark
                    ? ['#0f172a', '#1e293b']
                    : [Colors.brand.primary, '#1e3a8a']
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.header}
            >
                <View style={styles.badgeRow}>
                    <View style={styles.aiBadge}>
                        <Ionicons name="sparkles" size={11} color="#fff" />
                        <Text style={styles.aiBadgeText}>AI Powered</Text>
                    </View>
                    <View style={styles.liveBadge}>
                        <View style={styles.liveDot} />
                        <Text style={styles.liveBadgeText}>Live</Text>
                    </View>
                </View>
                <Text style={styles.title}>Sector Analysts</Text>
                <Text style={styles.subtitle}>
                    Talk directly to a specialist about any sector
                </Text>
            </LinearGradient>

            <ScrollView
                contentContainerStyle={styles.grid}
                showsVerticalScrollIndicator={false}
            >
                {SECTOR_ANALYSTS.map((a) => (
                    <TouchableOpacity
                        key={a.sector}
                        style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}
                        onPress={() => router.push({ pathname: '/ai-chat', params: { sector: a.sector } } as any)}
                        activeOpacity={0.82}
                    >
                        {/* Left color accent strip */}
                        <View style={[styles.accentStrip, { backgroundColor: a.color }]} />

                        {/* Icon */}
                        <View style={[styles.iconWrap, { backgroundColor: isDark ? a.darkBg : a.bg }]}>
                            <Ionicons name={a.icon} size={22} color={a.color} />
                        </View>

                        {/* Content */}
                        <View style={styles.cardBody}>
                            <View style={styles.topRow}>
                                <Text style={[styles.sectorName, { color: c.text }]}>{a.sector}</Text>
                                <View style={styles.onlinePill}>
                                    <View style={styles.onlineDot} />
                                    <Text style={styles.onlineText}>Online</Text>
                                </View>
                            </View>
                            <Text style={[styles.analystName, { color: a.color }]}>
                                {a.analyst} · {a.title}
                            </Text>
                            <Text style={[styles.description, { color: c.textSecondary }]} numberOfLines={1}>
                                {a.description}
                            </Text>
                        </View>

                        {/* Arrow */}
                        <View style={[styles.arrowWrap, { backgroundColor: isDark ? a.darkBg : a.bg }]}>
                            <Ionicons name="chevron-forward" size={14} color={a.color} />
                        </View>
                    </TouchableOpacity>
                ))}

                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },

    // Header
    header: {
        paddingTop: Platform.select({ ios: 60, web: 24, default: 48 }),
        paddingBottom: 28,
        paddingHorizontal: Spacing.xl,
    },
    badgeRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
    aiBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: 'rgba(255,255,255,0.15)',
        paddingHorizontal: 10, paddingVertical: 4,
        borderRadius: BorderRadius.full,
    },
    aiBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
    liveBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: 'rgba(34,197,94,0.18)',
        paddingHorizontal: 10, paddingVertical: 4,
        borderRadius: BorderRadius.full,
    },
    liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22c55e' },
    liveBadgeText: { color: '#22c55e', fontSize: 11, fontWeight: '700' },
    title: { fontSize: 26, fontWeight: '800', color: '#fff', letterSpacing: -0.5, marginBottom: 4 },
    subtitle: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },

    // Grid
    grid: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.xl, gap: Spacing.sm },

    // Card
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderRadius: BorderRadius.xl,
        borderWidth: 1,
        overflow: 'hidden',
        paddingVertical: 14,
        paddingRight: 14,
    },
    accentStrip: { width: 3, alignSelf: 'stretch' },
    iconWrap: {
        width: 46, height: 46,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cardBody: { flex: 1 },
    topRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
    sectorName: { fontSize: FontSize.base, fontWeight: '700' },
    onlinePill: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: '#22c55e18',
        paddingHorizontal: 7, paddingVertical: 2,
        borderRadius: BorderRadius.full,
    },
    onlineDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#22c55e' },
    onlineText: { color: '#22c55e', fontSize: 10, fontWeight: '700' },
    analystName: { fontSize: 11, fontWeight: '600', marginBottom: 3 },
    description: { fontSize: 11, lineHeight: 16 },
    arrowWrap: {
        width: 30, height: 30, borderRadius: 10,
        justifyContent: 'center', alignItems: 'center',
    },
});
