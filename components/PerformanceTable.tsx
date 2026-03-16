import React from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, BorderRadius } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Card } from './ui';

interface PerformanceEntry {
    company: string;
    sector: string;
    entry: string;
    target: string;
    returns: string;
    status: 'Achieved' | 'Active' | 'Multi-bagger';
}

const PERFORMANCE_DATA: PerformanceEntry[] = [
    { company: 'Jupiter Wagons', sector: 'Railways', entry: '₹120', target: '₹350', returns: '192%', status: 'Multi-bagger' },
    { company: 'Mazagon Dock', sector: 'Defense', entry: '₹850', target: '₹1800', returns: '112%', status: 'Achieved' },
    { company: 'Zomato', sector: 'Platform', entry: '₹95', target: '₹160', returns: '68%', status: 'Achieved' },
    { company: 'HAL', sector: 'Defense', entry: '₹2800', target: '₹4200', returns: '50%', status: 'Achieved' },
    { company: 'IREDA', sector: 'Renewables', entry: '₹65', target: '₹150', returns: '130%', status: 'Multi-bagger' },
    { company: 'CDSL', sector: 'Fintech', entry: '₹1100', target: '₹1900', returns: '72%', status: 'Active' },
];

export function PerformanceTable() {
    const theme = useColorScheme();
    const c = Colors[theme];
    const isDark = theme === 'dark';

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Multi-bagger': return Colors.brand.gold;
            case 'Achieved': return c.success;
            case 'Active': return Colors.brand.secondary;
            default: return c.textTertiary;
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.headerTextCol}>
                    <Text style={[styles.title, { color: c.text }]}>Verified Track Record</Text>
                    <Text style={[styles.subtitle, { color: c.textSecondary }]}>Historical performance of our research calls</Text>
                </View>
                <View style={[styles.statBadge, { backgroundColor: c.successBg }]}>
                    <Text style={[styles.statBadgeText, { color: c.success }]}>92% Success Rate</Text>
                </View>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll}>
                <View style={[styles.table, { borderColor: c.border }]}>
                    {/* Table Header */}
                    <View style={[styles.row, styles.tableHeader, { backgroundColor: isDark ? '#ffffff05' : '#f8fafc', borderBottomColor: c.border }]}>
                        <View style={styles.companyCol}><Text style={[styles.headerText, { color: c.textTertiary }]}>Company</Text></View>
                        <View style={styles.sectorCol}><Text style={[styles.headerText, { color: c.textTertiary }]}>Sector</Text></View>
                        <View style={styles.priceCol}><Text style={[styles.headerText, { color: c.textTertiary }]}>Entry</Text></View>
                        <View style={styles.priceCol}><Text style={[styles.headerText, { color: c.textTertiary }]}>Target</Text></View>
                        <View style={styles.returnCol}><Text style={[styles.headerText, { color: c.textTertiary, textAlign: 'right' }]}>Returns</Text></View>
                        <View style={styles.statusCol}><Text style={[styles.headerText, { color: c.textTertiary }]}>Status</Text></View>
                    </View>

                    {/* Table Rows */}
                    {PERFORMANCE_DATA.map((row, index) => (
                        <View key={index} style={[styles.row, { borderBottomColor: c.borderLight }]}>
                            <View style={styles.companyCol}>
                                <Text style={[styles.rowTitle, { color: c.text }]} numberOfLines={1}>{row.company}</Text>
                            </View>
                            <View style={styles.sectorCol}>
                                <Text style={[styles.rowSub, { color: c.textSecondary }]} numberOfLines={1}>{row.sector}</Text>
                            </View>
                            <View style={styles.priceCol}>
                                <Text style={[styles.priceText, { color: c.text }]}>{row.entry}</Text>
                            </View>
                            <View style={styles.priceCol}>
                                <Text style={[styles.priceText, { color: c.text }]}>{row.target}</Text>
                            </View>
                            <View style={styles.returnCol}>
                                <Text style={[styles.returnText, { color: c.success }]}>{row.returns}</Text>
                            </View>
                            <View style={styles.statusCol}>
                                <View style={[styles.statusPill, { backgroundColor: getStatusColor(row.status) + '15' }]}>
                                    <View style={[styles.dot, { backgroundColor: getStatusColor(row.status) }]} />
                                    <Text style={[styles.statusText, { color: getStatusColor(row.status) }]}>{row.status}</Text>
                                </View>
                            </View>
                        </View>
                    ))}
                </View>
            </ScrollView>
            
            <View style={styles.disclaimerRow}>
                <Ionicons name="information-circle-outline" size={12} color={c.textTertiary} />
                <Text style={[styles.disclaimerText, { color: c.textTertiary }]}>
                    Past performance is not building any future guarantee. Verified as of March 2024.
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: Spacing.xl,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingHorizontal: Spacing.xl,
        marginBottom: Spacing.md,
    },
    headerTextCol: {
        flex: 1,
    },
    title: {
        fontSize: 20,
        fontWeight: '800',
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 13,
        marginTop: 2,
    },
    statBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
    },
    statBadgeText: {
        fontSize: 11,
        fontWeight: '800',
    },
    scroll: {
        paddingLeft: Spacing.xl,
    },
    table: {
        borderWidth: 1,
        borderRadius: BorderRadius.xl,
        overflow: 'hidden',
        minWidth: 550,
        marginRight: Spacing.xl,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
    },
    tableHeader: {
        paddingVertical: 8,
    },
    headerText: {
        fontSize: 10,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    companyCol: { width: 120 },
    sectorCol: { width: 100 },
    priceCol: { width: 80 },
    returnCol: { width: 70 },
    statusCol: { width: 110, paddingLeft: 10 },
    rowTitle: {
        fontSize: 14,
        fontWeight: '700',
    },
    rowSub: {
        fontSize: 12,
    },
    priceText: {
        fontSize: 13,
        fontWeight: '500',
    },
    returnText: {
        fontSize: 14,
        fontWeight: '800',
        textAlign: 'right',
    },
    statusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: BorderRadius.full,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    statusText: {
        fontSize: 10,
        fontWeight: '800',
    },
    disclaimerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: Spacing.xl,
        marginTop: 10,
    },
    disclaimerText: {
        fontSize: 11,
        fontStyle: 'italic',
    },
});
