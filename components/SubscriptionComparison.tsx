import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card } from './ui';

interface FeatureComparison {
    name: string;
    midcap: boolean | string;
    smallcap: boolean | string;
    sme: boolean | string;
    bundle: boolean | string;
}

const COMPARISON_DATA: FeatureComparison[] = [
    { name: 'Research Coverage', midcap: 'Top 101st to 250th based on market cap', smallcap: '251st company onwards', sme: 'SME listed companies', bundle: 'Full Access' },
    { name: 'Key Proposition', midcap: 'High growth and Large Caps of tomorrow', smallcap: 'Capable companies to transform to Midcaps', sme: 'Early-stage high potential businesses', bundle: 'All segments combined' },
    { name: 'Detailed Reports', midcap: 'In-depth fundamental reports with valuation', smallcap: 'Deep-dive reports with growth triggers', sme: 'Focused reports with business understanding', bundle: 'Access to all reports' },
    { name: 'Podcast Summary', midcap: true, smallcap: true, sme: true, bundle: true },
    { name: 'Video Summary', midcap: true, smallcap: true, sme: true, bundle: true },
    { name: 'Talk to Report', midcap: true, smallcap: true, sme: true, bundle: true },
    { name: 'Entry/Exit Strategy', midcap: 'Clear strategy for BUY, HOLD and SELL', smallcap: 'Tactical entry & exit with risk levels', sme: 'High-risk high-reward strategy guidance', bundle: 'Strategies for respective stocks' },
    { name: 'Portfolio Tracker', midcap: 'Track recommended stocks', smallcap: 'Track smallcap portfolio', sme: 'Track SME picks', bundle: 'Track all at each plan level' },
    { name: 'Telegram Access', midcap: 'Dedicated updates channel', smallcap: 'Dedicated updates channel', sme: 'Dedicated updates channel', bundle: 'Premium combined channel' },
    { name: 'Timely Research Calls', midcap: 'Regular conviction calls', smallcap: 'High-growth opportunity alerts', sme: 'Early-stage opportunity alerts', bundle: 'All calls' },
    { name: 'Priority Support', midcap: 'Email / Telegram', smallcap: 'Email / Telegram', sme: 'Email / Telegram', bundle: 'Email / Telegram' },
];

export function SubscriptionComparison() {
    const theme = useColorScheme();
    const c = Colors[theme];
    const isDark = theme === 'dark';
    const { isDesktop } = useResponsiveLayout();

    const gridColor = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.10)';
    const borderWidth = StyleSheet.hairlineWidth;

    const renderCell = (value: boolean | string, isLast = false, height?: number) => {
        const cellStyle = [
            styles.cell, 
            isLast && styles.lastCell, 
            isDesktop && styles.webCell,
            height ? { height } : undefined,
            { borderRightWidth: isLast ? 0 : borderWidth, borderRightColor: gridColor }
        ];

        if (typeof value === 'boolean') {
            return (
                <View style={cellStyle}>
                    <Ionicons
                        name={value ? "checkmark-circle" : "close-circle"}
                        size={20}
                        color={value ? c.success : c.textTertiary}
                    />
                </View>
            );
        }
        return (
            <View style={cellStyle}>
                <Text style={[styles.cellText, { color: c.textSecondary }]}>{value}</Text>
            </View>
        );
    };

    const getRowHeight = (index: number) => {
        if ([3, 4, 5].includes(index)) return 50; 
        return 80;
    };

    const headerHeight = 50;

    const DesktopContent = (
        <View style={styles.webTableWrapper}>
            {/* Table Header */}
            <View style={[styles.row, styles.tableHeader, { borderBottomColor: gridColor, borderBottomWidth: borderWidth }]}>
                <View style={[styles.featureColumn, styles.webFeatureColumn, { borderRightWidth: borderWidth, borderRightColor: gridColor }]}>
                    <Text style={[styles.headerText, { color: c.textSecondary }]}>Feature</Text>
                </View>
                <View style={[styles.cell, styles.webCell, { borderRightWidth: borderWidth, borderRightColor: gridColor }]}><Text style={[styles.headerText, { color: c.textSecondary }]}>Midcap</Text></View>
                <View style={[styles.cell, styles.webCell, { borderRightWidth: borderWidth, borderRightColor: gridColor }]}><Text style={[styles.headerText, { color: c.textSecondary }]}>Smallcap</Text></View>
                <View style={[styles.cell, styles.webCell, { borderRightWidth: borderWidth, borderRightColor: gridColor }]}><Text style={[styles.headerText, { color: c.textSecondary }]}>SME</Text></View>
                <View style={[styles.cell, styles.lastCell, styles.webCell, { backgroundColor: isDark ? '#1e3a8a20' : '#ebf5ff' }]}>
                    <Text style={[styles.headerText, { color: Colors.brand.primary, fontWeight: '800' }]}>Bundle</Text>
                </View>
            </View>

            {/* Table Rows */}
            {COMPARISON_DATA.map((row, index) => (
                <View key={index} style={[styles.row, { borderBottomColor: gridColor, borderBottomWidth: borderWidth }]}>
                    <View style={[styles.featureColumn, styles.webFeatureColumn, { borderRightWidth: borderWidth, borderRightColor: gridColor }]}>
                        <Text style={[styles.rowName, { color: c.text }]}>{row.name}</Text>
                    </View>
                    {renderCell(row.midcap)}
                    {renderCell(row.smallcap)}
                    {renderCell(row.sme)}
                    {renderCell(row.bundle, true)}
                </View>
            ))}
        </View>
    );

    const MobileContent = (
        <View style={{ flexDirection: 'row' }}>
            {/* Sticky Left Column */}
            <View style={{ width: 100, borderRightWidth: borderWidth, borderRightColor: gridColor, zIndex: 10, backgroundColor: c.card }}>
                <View style={[styles.featureColumn, { height: headerHeight, borderBottomWidth: borderWidth, borderBottomColor: gridColor, justifyContent: 'center' }]}>
                    <Text style={[styles.headerText, { color: c.textSecondary }]}>Feature</Text>
                </View>
                {COMPARISON_DATA.map((row, index) => (
                    <View key={index} style={[styles.featureColumn, { height: getRowHeight(index), borderBottomWidth: borderWidth, borderBottomColor: gridColor, justifyContent: 'center' }]}>
                        <Text style={[styles.rowName, { color: c.text }]}>{row.name}</Text>
                    </View>
                ))}
            </View>

            {/* Scrollable Data Columns */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ borderRightWidth: borderWidth, borderRightColor: gridColor }}>
                    <View style={[styles.row, { height: headerHeight, borderBottomWidth: borderWidth, borderBottomColor: gridColor }]}>
                        <View style={[styles.cell, { borderRightWidth: borderWidth, borderRightColor: gridColor }]}><Text style={[styles.headerText, { color: c.textSecondary }]}>Midcap</Text></View>
                        <View style={[styles.cell, { borderRightWidth: borderWidth, borderRightColor: gridColor }]}><Text style={[styles.headerText, { color: c.textSecondary }]}>Smallcap</Text></View>
                        <View style={[styles.cell, { borderRightWidth: borderWidth, borderRightColor: gridColor }]}><Text style={[styles.headerText, { color: c.textSecondary }]}>SME</Text></View>
                        <View style={[styles.cell, styles.lastCell, { backgroundColor: isDark ? '#1e3a8a20' : '#ebf5ff' }]}>
                            <Text style={[styles.headerText, { color: Colors.brand.primary, fontWeight: '800' }]}>Bundle</Text>
                        </View>
                    </View>
                    {COMPARISON_DATA.map((row, index) => (
                        <View key={index} style={[styles.row, { height: getRowHeight(index), borderBottomWidth: borderWidth, borderBottomColor: gridColor }]}>
                            {renderCell(row.midcap, false, getRowHeight(index))}
                            {renderCell(row.smallcap, false, getRowHeight(index))}
                            {renderCell(row.sme, false, getRowHeight(index))}
                            {renderCell(row.bundle, true, getRowHeight(index))}
                        </View>
                    ))}
                </View>
            </ScrollView>
        </View>
    );

    return (
        <Card theme={theme} style={styles.container}>
            <View style={styles.headerRow}>
                <Text style={[styles.title, { color: c.text }]}>Detailed Comparison</Text>
            </View>

            {isDesktop ? (
                <View style={styles.desktopContainer}>
                    {DesktopContent}
                </View>
            ) : (
                MobileContent
            )}
        </Card>
    );
}

const styles = StyleSheet.create({
    container: {
        marginTop: Spacing.xl,
        padding: 0,
        overflow: 'hidden',
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 16,
        paddingBottom: 4,
    },
    title: {
        fontSize: 16,
        fontWeight: '800',
    },
    desktopContainer: {
        paddingHorizontal: 16,
        paddingBottom: 16,
    },
    webTableWrapper: {
        width: '100%',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1,
    },
    tableHeader: {
        borderBottomWidth: 2,
    },
    featureColumn: {
        width: 100,
        paddingLeft: 8,
        paddingVertical: 8,
    },
    webFeatureColumn: {
        flex: 1.5,
        paddingLeft: 16,
        paddingVertical: 12,
    },
    cell: {
        width: 75,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        paddingHorizontal: 2,
    },
    webCell: {
        flex: 1,
        width: 'auto',
        paddingVertical: 12,
        paddingHorizontal: 8,
    },
    lastCell: {
        width: 80,
    },
    headerText: {
        fontSize: 10,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.2,
    },
    rowName: {
        fontSize: 11,
        fontWeight: '600',
    },
    cellText: {
        fontSize: 10,
        fontWeight: '500',
        textAlign: 'center',
    },
});
