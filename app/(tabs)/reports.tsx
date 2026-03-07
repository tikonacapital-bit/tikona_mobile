import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ActivityIndicator, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Colors, Spacing, BorderRadius, FontSize } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Card, RecommendationBadge, EmptyState, ResponsiveContainer } from '@/components/ui';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import type { ResearchReport } from '@/lib/types';

const PAGE_SIZE = 12;

export default function ReportsScreen() {
    const theme = useColorScheme();
    const c = Colors[theme];
    const { userId, subscription, kyc, profile } = useAuth();
    const { gridColumns } = useResponsiveLayout();

    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');

    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(search), 300);
        return () => clearTimeout(t);
    }, [search]);


    const { data, isLoading, error } = useQuery({
        queryKey: ['my_reports', userId, debouncedSearch],
        queryFn: async (): Promise<ResearchReport[]> => {
            if (!userId) return [];

            // 1. Fetch report IDs assigned to this user
            const { data: assignments, error: assignErr } = await supabase
                .from('user_report_assignments')
                .select('report_id')
                .eq('user_id', userId);

            if (assignErr) throw new Error(assignErr.message);
            if (!assignments || assignments.length === 0) return [];

            const assignedIds = assignments.map((a) => a.report_id);

            // 2. Fetch the actual reports that are assigned & published
            let query = supabase
                .from('research_reports')
                .select('*')
                .in('report_id', assignedIds)
                .eq('is_published', true)
                .order('published_at', { ascending: false })
                .limit(PAGE_SIZE);

            if (debouncedSearch.trim()) {
                const term = `%${debouncedSearch.trim()}%`;
                query = query.or(`company_name.ilike.${term},nse_symbol.ilike.${term}`);
            }

            const { data: reports, error: dbError } = await query;
            if (dbError) throw new Error(dbError.message);
            return reports ?? [];
        },
        enabled: !!userId,
        staleTime: 60000,
    });

    const reports = data ?? [];

    const canAccessAll = subscription?.plan === 'basic' || subscription?.plan === 'premium';
    const isLocked = (index: number) => !canAccessAll && index >= 3;

    if (!kyc || !profile) {
        return (
            <View style={[styles.container, { backgroundColor: c.background, justifyContent: 'center', alignItems: 'center', padding: Spacing['2xl'] }]}>
                <Ionicons name="shield-half" size={56} color={c.textTertiary} style={{ marginBottom: Spacing.lg }} />
                <Text style={{ fontSize: FontSize.xl, fontWeight: '700', color: c.text, marginBottom: Spacing.sm, textAlign: 'center' }}>Verification Required</Text>
                <Text style={{ fontSize: FontSize.base, color: c.textSecondary, textAlign: 'center', marginBottom: Spacing.xl, lineHeight: 22 }}>
                    Complete your KYC and Risk Profiling to access research reports.
                </Text>
                <TouchableOpacity
                    style={{ backgroundColor: Colors.brand.primary, paddingHorizontal: Spacing.xl, paddingVertical: 14, borderRadius: BorderRadius.lg, flexDirection: 'row', alignItems: 'center', gap: 8 }}
                    onPress={() => router.push(!kyc ? '/(kyc)' : '/(profiling)')}
                >
                    <Text style={{ color: '#fff', fontSize: FontSize.md, fontWeight: '700' }}>{!kyc ? 'Complete KYC' : 'Complete Profile'}</Text>
                    <Ionicons name="arrow-forward" size={18} color="#fff" />
                </TouchableOpacity>
            </View>
        );
    }

    const renderReport = ({ item, index }: { item: ResearchReport; index: number }) => {
        const locked = isLocked(index);
        return (
            <Card
                theme={theme}
                style={[styles.reportCard, locked && { opacity: 0.55 }]}
                onPress={() => {
                    if (locked) { router.push('/subscription'); }
                    else { router.push(`/report/${item.report_id}`); }
                }}
            >
                <View style={styles.reportHeader}>
                    <View style={[styles.reportIcon, { backgroundColor: c.infoBg }]}>
                        <Ionicons name="document-text" size={18} color={c.info} />
                    </View>
                    <View style={styles.reportBadges}>
                        {item.recommendation && <RecommendationBadge recommendation={item.recommendation} theme={theme} />}
                        {locked && (
                            <View style={[styles.lockBadge, { backgroundColor: Colors.brand.gold + '15' }]}>
                                <Ionicons name="lock-closed" size={10} color={Colors.brand.gold} />
                                <Text style={{ color: Colors.brand.gold, fontSize: 10, fontWeight: '700' }}>PRO</Text>
                            </View>
                        )}
                    </View>
                </View>

                <Text style={[styles.companyName, { color: c.text }]} numberOfLines={1}>{item.company_name}</Text>
                <Text style={[styles.symbol, { color: c.textTertiary }]}>{item.nse_symbol}</Text>

                {item.target_price && (
                    <Text style={[styles.target, { color: c.textSecondary }]}>
                        Target: <Text style={{ fontWeight: '700', color: c.success }}>₹{item.target_price.toLocaleString('en-IN')}</Text>
                    </Text>
                )}

                <View style={styles.reportFooter}>
                    <Text style={[styles.date, { color: c.textTertiary }]}>
                        {item.published_at ? new Date(item.published_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                    </Text>
                    <View style={styles.mediaRow}>
                        {item.pdf_file_url && <Ionicons name="document" size={14} color={c.textTertiary} />}
                        {item.audio_file_url && <Ionicons name="headset" size={14} color={c.textTertiary} />}
                        {item.video_file_url && <Ionicons name="videocam" size={14} color={c.textTertiary} />}
                    </View>
                </View>
            </Card>
        );
    };

    return (
        <ResponsiveContainer style={{ backgroundColor: c.background }}>
            <View style={[styles.container, { backgroundColor: c.background }]}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={[styles.title, { color: c.text }]}>Research Reports</Text>
                    <Text style={[styles.subtitle, { color: c.textSecondary }]}>AI-powered equity analysis</Text>
                </View>

                {/* Search */}
                <View style={styles.searchWrap}>
                    <View style={[styles.searchBar, { backgroundColor: c.inputBg, borderColor: c.inputBorder }]}>
                        <Ionicons name="search" size={18} color={c.icon} />
                        <TextInput
                            style={[styles.searchInput, { color: c.text }]}
                            placeholder="Search by company or ticker..."
                            placeholderTextColor={c.textTertiary}
                            value={search}
                            onChangeText={setSearch}
                        />
                        {search.length > 0 && (
                            <TouchableOpacity onPress={() => setSearch('')}>
                                <Ionicons name="close-circle" size={18} color={c.icon} />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* List */}
                {isLoading ? (
                    <View style={styles.loadingWrap}>
                        <ActivityIndicator size="large" color={Colors.brand.secondary} />
                    </View>
                ) : error ? (
                    <View style={styles.loadingWrap}>
                        <Ionicons name="warning" size={40} color={c.danger} style={{ marginBottom: 12 }} />
                        <Text style={{ color: c.text, fontWeight: '700', fontSize: FontSize.md, marginBottom: 6 }}>Could not load reports</Text>
                        <Text style={{ color: c.textSecondary, fontSize: FontSize.sm, textAlign: 'center', paddingHorizontal: 24 }}>
                            {(error as Error).message}
                        </Text>
                    </View>
                ) : (
                    <FlatList
                        key={`reports-${gridColumns}`}
                        data={reports}
                        renderItem={renderReport}
                        keyExtractor={(item) => item.report_id}
                        numColumns={gridColumns}
                        columnWrapperStyle={styles.columnWrapper}
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                        ListEmptyComponent={
                            <EmptyState
                                icon="document-text-outline"
                                title={search ? 'No Results' : 'No Reports Published Yet'}
                                subtitle={search ? `No reports match "${search}"` : 'Reports published by the admin will appear here.'}
                                theme={theme}
                            />
                        }
                    />
                )}
            </View>
        </ResponsiveContainer>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { paddingHorizontal: Spacing.xl, paddingTop: Platform.select({ ios: 60, web: 20, default: 48 }), paddingBottom: Spacing.sm },
    title: { fontSize: FontSize.xl, fontWeight: '700', letterSpacing: -0.3 },
    subtitle: { fontSize: FontSize.sm, marginTop: 2 },
    searchWrap: { paddingHorizontal: Spacing.xl, marginBottom: Spacing.lg },
    searchBar: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: BorderRadius.md, paddingHorizontal: 14, height: 46, gap: 8 },
    searchInput: { flex: 1, fontSize: FontSize.base },
    loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    listContent: { paddingHorizontal: Spacing.xl, paddingBottom: 32 },
    columnWrapper: { gap: Spacing.md, marginBottom: Spacing.md },
    reportCard: { flex: 1, padding: Spacing.lg },
    reportHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.md },
    reportIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    reportBadges: { flexDirection: 'row', gap: 4, alignItems: 'center' },
    lockBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    companyName: { fontSize: FontSize.base, fontWeight: '700', marginBottom: 2 },
    symbol: { fontSize: FontSize.xs, fontFamily: 'monospace', marginBottom: 6 },
    target: { fontSize: FontSize.xs, marginBottom: 10 },
    reportFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    date: { fontSize: 10 },
    mediaRow: { flexDirection: 'row', gap: 4 },
});
