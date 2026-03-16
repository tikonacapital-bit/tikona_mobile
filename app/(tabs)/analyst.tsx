import React from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Colors, Spacing, BorderRadius, FontSize } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { SECTOR_ANALYSTS } from '@/lib/analysts';

export default function AIAnalystScreen() {
    const theme = useColorScheme();
    const c = Colors[theme];
    const isDark = theme === 'dark';

    return (
        <View style={[styles.container, { backgroundColor: c.background }]}>
            {/* Header */}
            <View style={styles.header}>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.title, { color: c.text }]}>AI Sector Analysts</Text>
                    <Text style={[styles.subtitle, { color: c.textSecondary }]}>
                        Talk to a specialist about any sector
                    </Text>
                </View>
            </View>

            <ScrollView
                contentContainerStyle={styles.grid}
                showsVerticalScrollIndicator={false}
            >
                {SECTOR_ANALYSTS.map((a) => (
                    <TouchableOpacity
                        key={a.sector}
                        style={[
                            styles.card,
                            {
                                backgroundColor: c.surface,
                                borderColor: c.border,
                            },
                        ]}
                        onPress={() => router.push({ pathname: '/ai-chat', params: { sector: a.sector } } as any)}
                        activeOpacity={0.85}
                    >
                        {/* Icon */}
                        <View style={[styles.iconWrap, { backgroundColor: isDark ? a.darkBg : a.bg }]}>
                            <Ionicons name={a.icon} size={24} color={a.color} />
                        </View>

                        {/* Text */}
                        <View style={styles.cardBody}>
                            <Text style={[styles.sectorName, { color: c.text }]}>{a.sector}</Text>
                            <Text style={[styles.analystName, { color: a.color }]}>
                                {a.analyst} · {a.title}
                            </Text>
                            <Text style={[styles.description, { color: c.textSecondary }]} numberOfLines={2}>
                                {a.description}
                            </Text>
                        </View>

                        {/* Arrow */}
                        <Ionicons name="chevron-forward" size={18} color={c.textTertiary} style={styles.arrow} />
                    </TouchableOpacity>
                ))}

                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        paddingHorizontal: Spacing.xl,
        paddingTop: Platform.select({ ios: 60, web: 20, default: 48 }),
        paddingBottom: Spacing.lg,
    },
    title: { fontSize: FontSize.xl, fontWeight: '700', letterSpacing: -0.3 },
    subtitle: { fontSize: FontSize.sm, marginTop: 2 },
    grid: {
        paddingHorizontal: Spacing.xl,
        gap: Spacing.sm,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        padding: Spacing.lg,
        borderRadius: BorderRadius.xl,
        borderWidth: 1,
    },
    iconWrap: {
        width: 52, height: 52,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cardBody: { flex: 1 },
    sectorName: { fontSize: FontSize.base, fontWeight: '700', marginBottom: 2 },
    analystName: { fontSize: FontSize.xs, fontWeight: '600', marginBottom: 4 },
    description: { fontSize: FontSize.xs, lineHeight: 18 },
    arrow: { marginLeft: 4 },
});
