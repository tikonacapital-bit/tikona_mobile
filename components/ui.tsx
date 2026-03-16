import { BorderRadius, Colors, FontSize, Spacing, ThemeMode } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Platform, ScrollView, StyleProp, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View, ViewStyle } from 'react-native';

// ── Responsive constants ──
const CONTENT_MAX_WIDTH = 1350;

// ── Web cursor helper — applied to all pressable wrappers ──
const webPressableStyle: ViewStyle | undefined = Platform.OS === 'web'
    ? { cursor: 'pointer' as unknown as undefined } as unknown as ViewStyle
    : undefined;

// ── ResponsiveContainer — Centers and constrains content on wide screens ──
interface ResponsiveContainerProps {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    maxWidth?: number;
}

export function ResponsiveContainer({ children, style, maxWidth = CONTENT_MAX_WIDTH }: ResponsiveContainerProps) {
    const { width } = useWindowDimensions();
    const isWide = Platform.OS === 'web' && width >= 768;

    return (
        <View style={[
            { flex: 1 },
            isWide && { alignItems: 'center' as const },
            style,
        ]}>
            <View style={[
                { flex: 1, width: '100%' },
                isWide && { maxWidth },
            ]}>
                {children}
            </View>
        </View>
    );
}

export function ResponsiveScrollView({
    children,
    style,
    contentContainerStyle,
    maxWidth = CONTENT_MAX_WIDTH,
    ...props
}: {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    contentContainerStyle?: StyleProp<ViewStyle>;
    maxWidth?: number;
    [key: string]: any;
}) {
    const { width } = useWindowDimensions();
    const isWide = Platform.OS === 'web' && width >= 768;

    return (
        <ScrollView
            style={style}
            contentContainerStyle={[
                contentContainerStyle,
                isWide && {
                    alignSelf: 'center' as const,
                    width: '100%',
                    maxWidth,
                },
            ]}
            showsVerticalScrollIndicator={false}
            {...props}
        >
            {children}
        </ScrollView>
    );
}

// ── StatusChip — Compact label for status indicators ──
type ChipVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface StatusChipProps {
    label: string;
    variant?: ChipVariant;
    theme: ThemeMode;
}

export function StatusChip({ label, variant = 'neutral', theme }: StatusChipProps) {
    const c = Colors[theme];
    const colorMap: Record<ChipVariant, { bg: string; text: string }> = {
        success: { bg: c.successBg, text: c.success },
        warning: { bg: c.warningBg, text: c.warning },
        danger: { bg: c.dangerBg, text: c.danger },
        info: { bg: c.infoBg, text: c.info },
        neutral: { bg: c.borderLight, text: c.textSecondary },
    };
    const colors = colorMap[variant];
    return (
        <View style={[styles.chip, { backgroundColor: colors.bg }]}>
            <Text style={[styles.chipText, { color: colors.text }]}>{label}</Text>
        </View>
    );
}

// ── Card — Clean container with hover support on web ──
interface CardProps {
    children: React.ReactNode;
    theme: ThemeMode;
    style?: StyleProp<ViewStyle>;
    onPress?: () => void;
}

export function Card({ children, theme, style, onPress }: CardProps) {
    const c = Colors[theme];
    const [hovered, setHovered] = useState(false);

    const cardStyle: ViewStyle = {
        backgroundColor: c.cardBg,
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        borderColor: hovered && onPress ? c.border : c.cardBorder,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: hovered && onPress ? 3 : 1 },
        shadowOpacity: hovered && onPress ? 0.08 : 0.04,
        shadowRadius: hovered && onPress ? 8 : 3,
        elevation: hovered && onPress ? 3 : 1,
        ...(Platform.OS === 'web' && onPress ? { transition: 'all 0.15s ease' } as any : {}),
    };

    const hoverHandlers = Platform.OS === 'web' && onPress
        ? {
            onMouseEnter: () => setHovered(true),
            onMouseLeave: () => setHovered(false),
        }
        : {};

    if (onPress) {
        return (
            <TouchableOpacity
                style={[cardStyle, webPressableStyle, style]}
                onPress={onPress}
                activeOpacity={0.7}
                {...hoverHandlers}
            >
                {children}
            </TouchableOpacity>
        );
    }
    return <View style={[cardStyle, style]}>{children}</View>;
}

// ── SectionHeader — Clean left-aligned section title ──
export function SectionHeader({ title, theme, action }: { title: string; theme: ThemeMode; action?: React.ReactNode }) {
    return (
        <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: Colors[theme].text }]}>{title}</Text>
            {action}
        </View>
    );
}

// ── EmptyState — Zero-data placeholder ──
export function EmptyState({ icon, title, subtitle, theme }: {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    subtitle: string;
    theme: ThemeMode;
}) {
    const c = Colors[theme];
    return (
        <View style={styles.emptyContainer}>
            <View style={[styles.emptyIconCircle, { backgroundColor: c.borderLight }]}>
                <Ionicons name={icon} size={28} color={c.textTertiary} />
            </View>
            <Text style={[styles.emptyTitle, { color: c.text }]}>{title}</Text>
            <Text style={[styles.emptySubtitle, { color: c.textSecondary }]}>{subtitle}</Text>
        </View>
    );
}

// ── RecommendationBadge — BUY / SELL / HOLD ──
export function RecommendationBadge({ recommendation, theme }: {
    recommendation: 'BUY' | 'SELL' | 'HOLD';
    theme: ThemeMode;
}) {
    const c = Colors[theme];
    const map: Record<string, { bg: string; text: string }> = {
        BUY: { bg: c.successBg, text: c.success },
        SELL: { bg: c.dangerBg, text: c.danger },
        HOLD: { bg: c.warningBg, text: c.warning },
    };
    const color = map[recommendation] || map.HOLD;
    return (
        <View style={[styles.recBadge, { backgroundColor: color.bg }]}>
            <Text style={[styles.recBadgeText, { color: color.text }]}>{recommendation}</Text>
        </View>
    );
}

// ── MetricCard — Summary stat display (responsive width) ──
export function MetricCard({ label, value, theme, valueColor }: {
    label: string;
    value: string;
    theme: ThemeMode;
    valueColor?: string;
}) {
    const c = Colors[theme];
    const { width } = useWindowDimensions();
    const isWide = Platform.OS === 'web' && width >= 1024;
    return (
        <View style={[
            styles.metricCard,
            { backgroundColor: c.surfaceElevated, borderColor: c.border },
            isWide && { width: '31%' },
        ]}>
            <Text style={[styles.metricLabel, { color: c.textTertiary }]}>{label}</Text>
            <Text style={[styles.metricValue, { color: valueColor || c.text }]}>{value}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    chip: {
        paddingHorizontal: Spacing.sm,
        paddingVertical: 3,
        borderRadius: BorderRadius.full,
    },
    chipText: {
        fontSize: FontSize.xs,
        fontWeight: '600',
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.md,
    },
    sectionTitle: {
        fontSize: FontSize.lg,
        fontWeight: '700',
    },
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: Spacing['5xl'],
    },
    emptyIconCircle: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Spacing.md,
    },
    emptyTitle: {
        fontSize: FontSize.md,
        fontWeight: '600',
        marginBottom: Spacing.xs,
    },
    emptySubtitle: {
        fontSize: FontSize.sm,
        textAlign: 'center',
        maxWidth: 260,
        lineHeight: 19,
    },
    recBadge: {
        paddingHorizontal: Spacing.sm,
        paddingVertical: 2,
        borderRadius: BorderRadius.sm,
    },
    recBadgeText: {
        fontSize: FontSize.xs,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    metricCard: {
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        padding: Spacing.md,
        width: '48%',
    },
    metricLabel: {
        fontSize: FontSize.xs,
        marginBottom: 4,
    },
    metricValue: {
        fontSize: FontSize.base,
        fontWeight: '700',
    },
});
