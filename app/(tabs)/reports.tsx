import { Card, EmptyState, RecommendationBadge, ResponsiveContainer } from '@/components/ui';
import { BorderRadius, Colors, FontSize, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { supabase } from '@/lib/supabase';
import type { ResearchReport } from '@/lib/types';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Platform,
    StyleSheet,
    Text,
    TextInput, TouchableOpacity,
    View,
} from 'react-native';

const PAGE_SIZE = 12;

export default function ReportsScreen() {
    const theme = useColorScheme();
    const c = Colors[theme];
    const { userId, user, subscription, kyc, profile } = useAuth();
    const { gridColumns } = useResponsiveLayout();

    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');

    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(search), 300);
        return () => clearTimeout(t);
    }, [search]);


    const userEmail = user?.primaryEmailAddress?.emailAddress;

    const { data, isLoading, error } = useQuery({
        queryKey: ['my_reports', userId, userEmail, debouncedSearch],
        queryFn: async (): Promise<ResearchReport[]> => {
            if (!userId || !userEmail) return [];

            // Fetch only reports assigned to this user's email
            const { data: assignments, error: assignErr } = await supabase
                .from('user_report_assignments')
                .select('report_id')
                .eq('email', userEmail);

            if (assignErr) throw new Error(assignErr.message);
            if (!assignments || assignments.length === 0) return [];

            const assignedIds = assignments.map((a) => a.report_id);

            let query = supabase
                .from('research_reports')
                .select('*')
                .eq('is_published', true)
                .in('report_id', assignedIds)
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
        enabled: !!userId && !!userEmail,
        staleTime: 60000,

    });

    const reports = data ?? [];

    const canAccessAll = !!subscription?.is_active;
    const isLocked = (index: number) => !canAccessAll && index >= 3;

    if (!kyc || !profile) {
        const isKycMissing = !kyc;
        const missingText = isKycMissing ? 'KYC' : 'Risk Profiling';
        const route = isKycMissing ? '/(kyc)' : '/(profiling)';
        const btnText = isKycMissing ? 'Complete KYC' : 'Complete Risk Profile';

        return (
            <View style={[styles.container, { backgroundColor: c.background, justifyContent: 'center', alignItems: 'center', padding: Spacing['2xl'] }]}>
                <Ionicons name="shield-half" size={56} color={c.textTertiary} style={{ marginBottom: Spacing.lg }} />
                <Text style={{ fontSize: FontSize.xl, fontWeight: '700', color: c.text, marginBottom: Spacing.sm, textAlign: 'center' }}>
                    {missingText} Required
                </Text>
                <Text style={{ fontSize: FontSize.base, color: c.textSecondary, textAlign: 'center', marginBottom: Spacing.xl, lineHeight: 22 }}>
                    Please complete your {missingText} to access premium research reports.
                </Text>
                <TouchableOpacity
                    style={{ backgroundColor: Colors.brand.primary, paddingHorizontal: Spacing.xl, paddingVertical: 14, borderRadius: BorderRadius.lg, flexDirection: 'row', alignItems: 'center', gap: 8 }}
                    onPress={() => router.push(route)}
                >
                    <Text style={{ color: '#fff', fontSize: FontSize.md, fontWeight: '700' }}>{btnText}</Text>
                    <Ionicons name="arrow-forward" size={18} color="#fff" />
                </TouchableOpacity>
            </View>
        );
    }

    const renderReport = ({ item, index }: { item: ResearchReport & { _spacer?: boolean }; index: number }) => {
        if ((item as any)._spacer) {
            return <View style={[styles.reportCard, { opacity: 0 }]} />;
        }
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
                {/* Premium Header */}
                <View style={{ overflow: 'hidden' }}>
                    <LinearGradient
                        colors={[Colors.brand.primary, '#1e3a8a']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.header}
                    >
                        <View style={styles.headerTextWrapper}>
                            <Text style={styles.headerTitle}>Research Reports</Text>
                            <Text style={styles.headerSubtitle}>In-depth analysis by expert research analysts</Text>
                        </View>
                    </LinearGradient>
                </View>

                {/* Status Bar Background for consistency */}
                <View style={{ height: 1, backgroundColor: c.border }} />

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
                        data={(() => {
                            const remainder = reports.length % gridColumns;
                            if (remainder === 0 || gridColumns <= 1) return reports;
                            const spacersNeeded = gridColumns - remainder;
                            const spacers = Array.from({ length: spacersNeeded }, (_, i) => ({
                                report_id: `_spacer_${i}`,
                                _spacer: true,
                            }));
                            return [...reports, ...spacers] as any;
                        })()}
                        renderItem={renderReport as any}
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
                        ListFooterComponent={reports.length > 0 ? (
                            <View style={[styles.disclaimerFooter, { borderTopColor: c.border }]}>
                                <Ionicons name="information-circle-outline" size={13} color={c.textTertiary} />
                                <Text style={[styles.disclaimerText, { color: c.textTertiary }]}>
                                    Reports are for informational purposes only and do not constitute investment advice. Investment in securities market is subject to market risks. SEBI RA Reg. No.: INH000069807
                                </Text>
                            </View>
                        ) : null}
                    />
                )}
            </View>
        </ResponsiveContainer>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        paddingTop: Platform.select({ ios: 60, web: 24, default: 48 }),
        paddingBottom: 40,
        paddingHorizontal: Spacing.xl,
        borderBottomLeftRadius: BorderRadius['3xl'],
        borderBottomRightRadius: BorderRadius['3xl'],
    },
    headerTextWrapper: {
        marginTop: Spacing.xs,
    },
    headerTitle: {
        fontSize: 32,
        fontWeight: '800',
        color: '#fff',
        letterSpacing: -1,
    },
    headerSubtitle: {
        fontSize: FontSize.md,
        color: 'rgba(255,255,255,0.7)',
        marginTop: 6,
        fontWeight: '500',
    },
    searchWrap: { paddingHorizontal: Spacing.xl, marginTop: -24, marginBottom: Spacing.xl },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: BorderRadius.xl,
        paddingHorizontal: 16,
        height: 52,
        gap: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 1,
    },
    searchInput: { flex: 1, fontSize: 16 },
    loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    listContent: { paddingHorizontal: Spacing.xl, paddingBottom: 40 },
    columnWrapper: { gap: Spacing.xl, marginBottom: Spacing.xl },
    reportCard: {
        flex: 1,
        padding: 20,
        borderRadius: BorderRadius['2xl'],
    },
    reportHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    reportIcon: {
        width: 44,
        height: 44,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    reportBadges: { flexDirection: 'row', gap: 6, alignItems: 'center' },
    lockBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    companyName: {
        fontSize: 18,
        fontWeight: '800',
        marginBottom: 4,
        letterSpacing: -0.3,
    },
    symbol: {
        fontSize: 12,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        marginBottom: 8,
        fontWeight: '700',
        color: Colors.brand.secondary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    target: {
        fontSize: 13,
        marginBottom: 16,
        fontWeight: '500',
    },
    reportFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.03)',
    },
    date: { fontSize: 11, fontWeight: '500' },
    mediaRow: { flexDirection: 'row', gap: 6 },
    disclaimerFooter: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingTop: Spacing.lg, marginTop: Spacing.sm, borderTopWidth: 1, paddingBottom: Spacing.xl },
    disclaimerText: { flex: 1, fontSize: 11, lineHeight: 15 },
});
