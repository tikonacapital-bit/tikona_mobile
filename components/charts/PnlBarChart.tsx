import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Rect, Line, Text as SvgText } from 'react-native-svg';
import { Colors, FontSize, Spacing } from '@/constants/theme';
import type { ThemeMode } from '@/constants/theme';

interface BarData {
    label: string;
    value: number;
    color?: string;
}

interface PnlBarChartProps {
    data: BarData[];
    height?: number;
    theme: ThemeMode;
    formatValue?: (v: number) => string;
}

export default function PnlBarChart({
    data,
    height = 180,
    theme,
    formatValue = (v) => `${v >= 0 ? '+' : ''}${v.toFixed(0)}`,
}: PnlBarChartProps) {
    const c = Colors[theme];

    if (!data.length) return null;

    const maxVal = Math.max(...data.map((d) => Math.abs(d.value)), 1);
    const chartPadding = { left: 10, right: 10, top: 24, bottom: 40 };
    const chartWidth = Math.max(data.length * 56, 280);
    const chartHeight = height;
    const barAreaHeight = chartHeight - chartPadding.top - chartPadding.bottom;
    const barWidth = Math.min(32, (chartWidth - chartPadding.left - chartPadding.right) / data.length - 8);
    const zeroY = chartPadding.top + barAreaHeight / 2;

    return (
        <View style={styles.container}>
            <Svg width={chartWidth} height={chartHeight}>
                {/* Zero line */}
                <Line
                    x1={chartPadding.left}
                    y1={zeroY}
                    x2={chartWidth - chartPadding.right}
                    y2={zeroY}
                    stroke={c.border}
                    strokeWidth={1}
                    strokeDasharray="4,4"
                />

                {/* Bars */}
                {data.map((d, i) => {
                    const barHeight = (Math.abs(d.value) / maxVal) * (barAreaHeight / 2);
                    const isPositive = d.value >= 0;
                    const barColor = d.color || (isPositive ? c.success : c.danger);
                    const x = chartPadding.left + i * (chartWidth - chartPadding.left - chartPadding.right) / data.length + ((chartWidth - chartPadding.left - chartPadding.right) / data.length - barWidth) / 2;
                    const y = isPositive ? zeroY - barHeight : zeroY;

                    return (
                        <React.Fragment key={i}>
                            {/* Bar */}
                            <Rect
                                x={x}
                                y={y}
                                width={barWidth}
                                height={Math.max(barHeight, 2)}
                                rx={4}
                                fill={barColor}
                                opacity={0.85}
                            />
                            {/* Value label */}
                            <SvgText
                                x={x + barWidth / 2}
                                y={isPositive ? y - 6 : y + barHeight + 14}
                                fontSize={9}
                                fontWeight="600"
                                fill={barColor}
                                textAnchor="middle"
                            >
                                {formatValue(d.value)}
                            </SvgText>
                            {/* Symbol label */}
                            <SvgText
                                x={x + barWidth / 2}
                                y={chartHeight - 8}
                                fontSize={9}
                                fill={c.textTertiary}
                                textAnchor="middle"
                                fontWeight="500"
                            >
                                {d.label.length > 5 ? d.label.slice(0, 5) : d.label}
                            </SvgText>
                        </React.Fragment>
                    );
                })}
            </Svg>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
    },
});
