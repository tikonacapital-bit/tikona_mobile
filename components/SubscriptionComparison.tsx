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

    const renderCell = (value: boolean | string, isLast = false) => {
        if (typeof value === 'boolean') {
            return (
                <View style={[styles.cell, isLast && styles.lastCell, isDesktop && styles.webCell]}>
                    <Ionicons
                        name={value ? "checkmark-circle" : "close-circle"}
                        size={20}
                        color={value ? c.success : c.textTertiary}
                    />
                </View>
            );
        }
        return (
            <View style={[styles.cell, isLast && styles.lastCell, isDesktop && styles.webCell]}>
                <Text style={[styles.cellText, { color: c.textSecondary }]}>{value}</Text>
            </View>
        );
    };

    const TableContent = (
        <View style={isDesktop && styles.webTableWrapper}>
            {/* Table Header */}
            <View style={[styles.row, styles.tableHeader, { borderBottomColor: c.border }]}>
                <View style={[styles.featureColumn, isDesktop && styles.webFeatureColumn]}>
                    <Text style={[styles.headerText, { color: c.textSecondary }]}>Feature</Text>
                </View>
                <View style={[styles.cell, isDesktop && styles.webCell]}><Text style={[styles.headerText, { color: c.textSecondary }]}>Midcap</Text></View>
                <View style={[styles.cell, isDesktop && styles.webCell]}><Text style={[styles.headerText, { color: c.textSecondary }]}>Smallcap</Text></View>
                <View style={[styles.cell, isDesktop && styles.webCell]}><Text style={[styles.headerText, { color: c.textSecondary }]}>SME</Text></View>
                <View style={[styles.cell, styles.lastCell, isDesktop && styles.webCell, { backgroundColor: isDark ? '#1e3a8a20' : '#ebf5ff' }]}>
                    <Text style={[styles.headerText, { color: Colors.brand.primary, fontWeight: '800' }]}>Bundle</Text>
                </View>
            </View>

            {/* Table Rows */}
            {COMPARISON_DATA.map((row, index) => (
                <View key={index} style={[styles.row, { borderBottomColor: c.borderLight }]}>
                    <View style={[styles.featureColumn, isDesktop && styles.webFeatureColumn]}>
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

    return (
        <Card theme={theme} style={styles.container}>
            <View style={styles.headerRow}>
                <Text style={[styles.title, { color: c.text }]}>Detailed Comparison</Text>
            </View>

            {isDesktop ? (
                <View style={styles.desktopContainer}>
                    {TableContent}
                </View>
            ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {TableContent}
                </ScrollView>
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
        width: 140,
        paddingLeft: 16,
        paddingVertical: 12,
    },
    webFeatureColumn: {
        flex: 1.5,
        paddingLeft: 8,
    },
    cell: {
        width: 140,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 8,
    },
    webCell: {
        flex: 1,
        width: 'auto',
    },
    lastCell: {
        width: 150,
    },
    headerText: {
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    rowName: {
        fontSize: 13,
        fontWeight: '600',
    },
    cellText: {
        fontSize: 11,
        fontWeight: '500',
        textAlign: 'center',
    },
});
