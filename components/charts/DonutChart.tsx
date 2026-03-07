import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { Colors, FontSize, Spacing, BorderRadius } from '@/constants/theme';
import type { ThemeMode } from '@/constants/theme';

interface DonutSlice {
    label: string;
    value: number;
    color: string;
}

interface DonutChartProps {
    data: DonutSlice[];
    size?: number;
    strokeWidth?: number;
    theme: ThemeMode;
    centerLabel?: string;
    centerValue?: string;
}

const CHART_COLORS = [
    '#2563EB', // Blue
    '#10B981', // Green
    '#F59E0B', // Amber
    '#8B5CF6', // Purple
    '#EC4899', // Pink
    '#06B6D4', // Cyan
    '#F97316', // Orange
    '#6366F1', // Indigo
    '#14B8A6', // Teal
    '#E11D48', // Rose
];

export function getChartColor(index: number): string {
    return CHART_COLORS[index % CHART_COLORS.length];
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
    const angleRad = ((angleDeg - 90) * Math.PI) / 180;
    return {
        x: cx + r * Math.cos(angleRad),
        y: cy + r * Math.sin(angleRad),
    };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
    const start = polarToCartesian(cx, cy, r, endAngle);
    const end = polarToCartesian(cx, cy, r, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}

export default function DonutChart({
    data,
    size = 180,
    strokeWidth = 28,
    theme,
    centerLabel,
    centerValue,
}: DonutChartProps) {
    const c = Colors[theme];
    const cx = size / 2;
    const cy = size / 2;
    const radius = (size - strokeWidth) / 2;

    const total = data.reduce((sum, d) => sum + d.value, 0);
    if (total === 0) return null;

    let currentAngle = 0;
    const arcs = data.map((slice, i) => {
        const sliceAngle = (slice.value / total) * 360;
        // Avoid rendering a full 360° arc (SVG can't render it)
        const adjustedAngle = sliceAngle >= 360 ? 359.99 : sliceAngle;
        const startAngle = currentAngle;
        const endAngle = currentAngle + adjustedAngle;
        currentAngle += sliceAngle;
        return { ...slice, startAngle, endAngle };
    });

    return (
        <View style={styles.container}>
            <View style={styles.chartWrapper}>
                <Svg width={size} height={size}>
                    {/* Background circle */}
                    <Circle
                        cx={cx}
                        cy={cy}
                        r={radius}
                        fill="none"
                        stroke={c.border}
                        strokeWidth={strokeWidth}
                        opacity={0.3}
                    />
                    {/* Data arcs */}
                    {arcs.map((arc, i) => (
                        <Path
                            key={i}
                            d={describeArc(cx, cy, radius, arc.startAngle, arc.endAngle)}
                            fill="none"
                            stroke={arc.color}
                            strokeWidth={strokeWidth}
                            strokeLinecap="round"
                        />
                    ))}
                </Svg>
                {/* Center text */}
                {(centerLabel || centerValue) && (
                    <View style={[styles.centerText, { width: size, height: size }]}>
                        {centerValue && (
                            <Text style={[styles.centerValue, { color: c.text }]}>{centerValue}</Text>
                        )}
                        {centerLabel && (
                            <Text style={[styles.centerLabel, { color: c.textSecondary }]}>{centerLabel}</Text>
                        )}
                    </View>
                )}
            </View>

            {/* Legend */}
            <View style={styles.legend}>
                {data.map((slice, i) => {
                    const pct = total > 0 ? ((slice.value / total) * 100).toFixed(1) : '0';
                    return (
                        <View key={i} style={styles.legendItem}>
                            <View style={[styles.legendDot, { backgroundColor: slice.color }]} />
                            <Text style={[styles.legendLabel, { color: c.textSecondary }]} numberOfLines={1}>
                                {slice.label}
                            </Text>
                            <Text style={[styles.legendValue, { color: c.text }]}>{pct}%</Text>
                        </View>
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
    },
    chartWrapper: {
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
    },
    centerText: {
        position: 'absolute',
        alignItems: 'center',
        justifyContent: 'center',
    },
    centerValue: {
        fontSize: FontSize.lg,
        fontWeight: '700',
    },
    centerLabel: {
        fontSize: FontSize.xs,
        marginTop: 2,
    },
    legend: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        marginTop: Spacing.lg,
        gap: Spacing.sm,
        paddingHorizontal: Spacing.md,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.sm,
        paddingVertical: Spacing.xs,
        borderRadius: BorderRadius.sm,
        gap: 6,
    },
    legendDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    legendLabel: {
        fontSize: FontSize.xs,
        maxWidth: 70,
    },
    legendValue: {
        fontSize: FontSize.xs,
        fontWeight: '600',
    },
});
