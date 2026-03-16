import React from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, BorderRadius } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { Card } from './ui';

interface FeatureComparison {
    name: string;
    midcap: boolean | string;
    smallcap: boolean | string;
    sme: boolean | string;
    bundle: boolean | string;
}

const COMPARISON_DATA: FeatureComparison[] = [
    { name: 'Research Coverage', midcap: 'Mid Cap Only', smallcap: 'Small Cap Only', sme: 'SME Only', bundle: 'Full Access' },
    { name: 'Detailed Reports', midcap: true, smallcap: true, sme: true, bundle: true },
    { name: 'Entry/Exit Alerts', midcap: true, smallcap: true, sme: true, bundle: true },
    { name: 'Portfolio Tracker', midcap: true, smallcap: true, sme: true, bundle: true },
    { name: 'Telegram Access', midcap: true, smallcap: true, sme: true, bundle: true },
    { name: 'Research Calls', midcap: false, smallcap: false, sme: false, bundle: 'Personalised' },
    { name: 'Portfolio Advisory', midcap: false, smallcap: false, sme: false, bundle: 'Priority' },
    { name: 'Support', midcap: 'Email', smallcap: 'Priority', sme: 'Priority', bundle: 'Dedicated' },
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
                <Text style={[styles.cellText, { color: c.textSecondary }]} numberOfLines={1}>{value}</Text>
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
                <Ionicons name="git-compare-outline" size={20} color={Colors.brand.primary} />
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
        width: 100,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
    },
    webCell: {
        flex: 1,
        width: 'auto',
    },
    lastCell: {
        width: 110,
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
