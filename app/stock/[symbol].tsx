import { Card, RecommendationBadge, ResponsiveScrollView } from '@/components/ui';
import { BorderRadius, Colors, FontSize, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { getAuthenticatedSupabase, supabase } from '@/lib/supabase';
import type { EquityUniverse, ResearchReport } from '@/lib/types';
import { useAuth as useClerkAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// ── Formatters ──
const fmtPrice = (v: number | null | undefined) =>
    v != null ? `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '—';
const fmtCr = (v: number | null | undefined) => {
    if (v == null) return '—';
    if (v >= 100000) return `₹${(v / 100000).toFixed(2)}L Cr`;
    if (v >= 1000) return `₹${(v / 1000).toFixed(1)}K Cr`;
    return `₹${v.toFixed(0)} Cr`;
};
const fmtPct = (v: number | null | undefined) => v != null ? `${v.toFixed(2)}%` : '—';
const fmtX = (v: number | null | undefined) => v != null ? `${v.toFixed(2)}x` : '—';
const fmtNum = (v: number | null | undefined) => v != null ? v.toFixed(2) : '—';

// ── Metric Row Item ──
function MetricRow({ label, value, valueColor, theme }: { label: string; value: string; valueColor?: string; theme: string }) {
    const c = Colors[theme as 'light' | 'dark'];
    return (
        <View style={metricRowStyles.row}>
            <Text style={[metricRowStyles.label, { color: c.textSecondary }]}>{label}</Text>
            <Text style={[metricRowStyles.value, { color: valueColor ?? c.text }]}>{value}</Text>
        </View>
    );
}
const metricRowStyles = StyleSheet.create({
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
    label: { fontSize: FontSize.sm, fontWeight: '500' },
    value: { fontSize: FontSize.sm, fontWeight: '700', textAlign: 'right', maxWidth: '55%' },
});

// ── 52-Week Range Bar ──
function RangeBar({ current, low, high, theme }: { current: number | null; low: number | null; high: number | null; theme: string }) {
    const c = Colors[theme as 'light' | 'dark'];
    if (current == null || low == null || high == null || high === low) return null;
    const pct = Math.min(Math.max(((current - low) / (high - low)) * 100, 0), 100);
    return (
        <View style={{ marginTop: Spacing.md }}>
            <View style={[rangeStyles.track, { backgroundColor: c.border }]}>
                <View style={[rangeStyles.fill, { width: `${pct}%` as any, backgroundColor: Colors.brand.secondary }]} />
                <View style={[rangeStyles.thumb, { left: `${pct}%` as any, backgroundColor: Colors.brand.secondary }]} />
            </View>
            <View style={rangeStyles.labels}>
                <Text style={[rangeStyles.label, { color: c.textTertiary }]}>{fmtPrice(low)}</Text>
                <Text style={[rangeStyles.label, { color: c.textSecondary, fontWeight: '700' }]}>{fmtPrice(current)}</Text>
                <Text style={[rangeStyles.label, { color: c.textTertiary }]}>{fmtPrice(high)}</Text>
            </View>
        </View>
    );
}
const rangeStyles = StyleSheet.create({
    track: { height: 6, borderRadius: 3, overflow: 'visible', position: 'relative' },
    fill: { height: 6, borderRadius: 3 },
    thumb: { position: 'absolute', top: -4, width: 14, height: 14, borderRadius: 7, marginLeft: -7, borderWidth: 2, borderColor: '#fff' },
    labels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
    label: { fontSize: 11, fontWeight: '500' },
});

// ── Divider ──
function Divider({ theme }: { theme: string }) {
    const c = Colors[theme as 'light' | 'dark'];
    return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.borderLight, marginVertical: 2 }} />;
}

export default function StockDetailScreen() {
    const { symbol } = useLocalSearchParams<{ symbol: string }>();
    const theme = useColorScheme();
    const c = Colors[theme];
    const { getToken } = useClerkAuth();

    const { data: stock, isLoading } = useQuery({
        queryKey: ['stock', symbol],
        queryFn: async () => {
            const { data } = await supabase.from('equity_universe').select('*').eq('nse_code', symbol!).maybeSingle();
            return data as EquityUniverse | null;
        },
        enabled: !!symbol,
    });

    const { data: reports } = useQuery({
        queryKey: ['stock_reports', symbol],
        queryFn: async (): Promise<ResearchReport[]> => {
            const token = await getToken({ template: 'supabase' });
            if (!token) return [];
            const client = getAuthenticatedSupabase(token);

            const { data } = await client
                .from('research_reports')
                .select('report_id, company_name, nse_symbol, recommendation, target_price, published_at, pdf_file_url, audio_file_url, video_file_url')
                .eq('is_published', true)
                .eq('nse_symbol', symbol!)
                .order('published_at', { ascending: false })
                .limit(5);
            return data ?? [];
        },
        enabled: !!symbol,
    });

    if (isLoading) {
        return (
            <View style={[styles.loadingWrap, { backgroundColor: c.background }]}>
                <ActivityIndicator size="large" color={Colors.brand.primary} />
            </View>
        );
    }

    const hasPrice = stock?.current_price != null;
    const upFromLow = stock?.low_52_week != null && stock?.current_price != null
        ? ((stock.current_price - stock.low_52_week) / stock.low_52_week) * 100
        : null;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
            <ResponsiveScrollView contentContainerStyle={styles.content}>

                {/* ── Back Bar ── */}
                <View style={styles.backRow}>
                    <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: c.borderLight }]} activeOpacity={0.8}>
                        <Ionicons name="chevron-back" size={20} color={c.text} />
                    </TouchableOpacity>
                    <Text style={[styles.backLabel, { color: c.textSecondary }]}>NSE: {symbol}</Text>
                    {(stock?.sector) && (
                        <View style={[styles.sectorBadge, { backgroundColor: c.borderLight }]}>
                            <Text style={[styles.sectorText, { color: c.textSecondary }]}>{stock.sector}</Text>
                        </View>
                    )}
                </View>

                {/* ── Price Hero Card ── */}
                <Card theme={theme} style={styles.heroCard}>
                    <Text style={[styles.companyName, { color: c.text }]} numberOfLines={2}>
                        {stock?.company_name || symbol}
                    </Text>

                    {hasPrice ? (
                        <View>
                            <View style={styles.priceRow}>
                                <Text style={[styles.price, { color: c.text }]}>{fmtPrice(stock!.current_price)}</Text>
                                {upFromLow != null && (
                                    <View style={[styles.changePill, { backgroundColor: Colors.brand.secondary + '18' }]}>
                                        <Ionicons name="trending-up" size={13} color={Colors.brand.secondary} />
                                        <Text style={[styles.changeText, { color: Colors.brand.secondary }]}>
                                            +{upFromLow.toFixed(1)}% from 52W low
                                        </Text>
                                    </View>
                                )}
                            </View>
                            {stock?.updated_at && (
                                <Text style={{ fontSize: 11, color: c.textTertiary, marginTop: 4 }}>
                                    Data as on {new Date(stock.updated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </Text>
                            )}
                        </View>
                    ) : (
                        <Text style={[styles.noPrice, { color: c.textTertiary }]}>Price not available</Text>
                    )}

                    {/* 52-Week Range */}
                    {stock?.high_52_week != null && stock?.low_52_week != null && (
                        <View style={{ marginTop: Spacing.lg }}>
                            <Text style={[styles.rangeLabel, { color: c.textSecondary }]}>52-Week Range</Text>
                            <RangeBar
                                current={stock.current_price}
                                low={stock.low_52_week}
                                high={stock.high_52_week}
                                theme={theme}
                            />
                        </View>
                    )}

                    {/* Target Price */}
                    {stock?.consensus_target_price != null && (
                        <View style={[styles.targetRow, { backgroundColor: c.surfaceElevated, borderColor: c.border }]}>
                            <Ionicons name="flag" size={14} color={Colors.brand.secondary} />
                            <Text style={[styles.targetLabel, { color: c.textSecondary }]}>Consensus Target</Text>
                            <Text style={[styles.targetValue, { color: Colors.brand.secondary }]}>
                                {fmtPrice(stock.consensus_target_price)}
                            </Text>
                            {stock.current_price != null && (
                                <Text style={[styles.targetUpside, { color: c.textTertiary }]}>
                                    ({((stock.consensus_target_price - stock.current_price) / stock.current_price * 100) >= 0 ? '+' : ''}
                                    {((stock.consensus_target_price - stock.current_price) / stock.current_price * 100).toFixed(1)}% upside)
                                </Text>
                            )}
                        </View>
                    )}
                </Card>

                {/* ── Stock Performance ── */}
                {(stock?.return_1m != null || stock?.return_3m != null || stock?.return_6m != null || stock?.return_12m != null) && (
                    <Card theme={theme} style={styles.card}>
                        <View style={styles.cardHeader}>
                            <Ionicons name="pulse" size={16} color={Colors.brand.secondary} />
                            <Text style={[styles.cardTitle, { color: c.text }]}>Stock Performance</Text>
                        </View>

                        {/* Period Return Pills */}
                        <View style={perfStyles.pillsRow}>
                            {[
                                { label: '1M', value: stock?.return_1m },
                                { label: '3M', value: stock?.return_3m },
                                { label: '6M', value: stock?.return_6m },
                                { label: '1Y', value: stock?.return_12m },
                            ].filter(p => p.value != null).map((period) => {
                                const isPositive = (period.value ?? 0) >= 0;
                                return (
                                    <View
                                        key={period.label}
                                        style={[
                                            perfStyles.pill,
                                            {
                                                backgroundColor: isPositive ? c.success + '12' : c.danger + '12',
                                                borderColor: isPositive ? c.success + '30' : c.danger + '30',
                                            },
                                        ]}
                                    >
                                        <Text style={[perfStyles.pillLabel, { color: c.textSecondary }]}>{period.label}</Text>
                                        <View style={perfStyles.pillValueRow}>
                                            <Ionicons
                                                name={isPositive ? 'caret-up' : 'caret-down'}
                                                size={12}
                                                color={isPositive ? c.success : c.danger}
                                            />
                                            <Text style={[perfStyles.pillValue, { color: isPositive ? c.success : c.danger }]}>
                                                {isPositive ? '+' : ''}{period.value?.toFixed(1)}%
                                            </Text>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>

                        {/* Return Bars */}
                        <View style={perfStyles.barsSection}>
                            {[
                                { label: '1 Month', value: stock?.return_1m },
                                { label: '3 Months', value: stock?.return_3m },
                                { label: '6 Months', value: stock?.return_6m },
                                { label: '1 Year', value: stock?.return_12m },
                            ].filter(p => p.value != null).map((period) => {
                                const val = period.value ?? 0;
                                const isPositive = val >= 0;
                                const maxBar = 60; // max bar width percentage
                                const absVal = Math.min(Math.abs(val), 100);
                                const barWidth = (absVal / 100) * maxBar;
                                return (
                                    <View key={period.label} style={perfStyles.barRow}>
                                        <Text style={[perfStyles.barLabel, { color: c.textSecondary }]}>{period.label}</Text>
                                        <View style={perfStyles.barTrack}>
                                            {/* Center line */}
                                            <View style={[perfStyles.barCenter, { backgroundColor: c.border }]} />
                                            {/* Bar */}
                                            <View
                                                style={[
                                                    perfStyles.barFill,
                                                    {
                                                        width: `${barWidth}%`,
                                                        backgroundColor: isPositive ? c.success : c.danger,
                                                        ...(isPositive
                                                            ? { left: '50%' }
                                                            : { right: '50%' }),
                                                    } as any,
                                                ]}
                                            />
                                        </View>
                                        <Text style={[perfStyles.barValue, { color: isPositive ? c.success : c.danger }]}>
                                            {isPositive ? '+' : ''}{val.toFixed(1)}%
                                        </Text>
                                    </View>
                                );
                            })}
                        </View>

                        {/* 52W Metrics */}
                        {(stock?.return_up_from_52w_low != null || stock?.return_down_from_52w_high != null) && (
                            <View style={[perfStyles.weekMetrics, { borderTopColor: c.borderLight }]}>
                                {stock?.return_up_from_52w_low != null && (
                                    <View style={[perfStyles.weekMetric, { backgroundColor: c.success + '08' }]}>
                                        <Ionicons name="arrow-up-circle" size={16} color={c.success} />
                                        <View>
                                            <Text style={[perfStyles.weekMetricLabel, { color: c.textTertiary }]}>From 52W Low</Text>
                                            <Text style={[perfStyles.weekMetricValue, { color: c.success }]}>
                                                +{stock.return_up_from_52w_low.toFixed(1)}%
                                            </Text>
                                        </View>
                                    </View>
                                )}
                                {stock?.return_down_from_52w_high != null && (
                                    <View style={[perfStyles.weekMetric, { backgroundColor: c.danger + '08' }]}>
                                        <Ionicons name="arrow-down-circle" size={16} color={c.danger} />
                                        <View>
                                            <Text style={[perfStyles.weekMetricLabel, { color: c.textTertiary }]}>From 52W High</Text>
                                            <Text style={[perfStyles.weekMetricValue, { color: c.danger }]}>
                                                {stock.return_down_from_52w_high.toFixed(1)}%
                                            </Text>
                                        </View>
                                    </View>
                                )}
                            </View>
                        )}
                    </Card>
                )}

                {/* ── Valuation ── */}
                {(stock?.pe_ttm != null || stock?.ev_ebitda_ttm != null || stock?.market_cap != null || stock?.book_value != null) && (
                    <Card theme={theme} style={styles.card}>
                        <View style={styles.cardHeader}>
                            <Ionicons name="bar-chart" size={16} color={Colors.brand.secondary} />
                            <Text style={[styles.cardTitle, { color: c.text }]}>Valuation</Text>
                        </View>
                        {stock?.market_cap != null && <><MetricRow label="Market Cap" value={fmtCr(stock.market_cap)} theme={theme} /><Divider theme={theme} /></>}
                        {stock?.pe_ttm != null && <><MetricRow label="P/E (TTM) (x)" value={fmtX(stock.pe_ttm)} theme={theme} /><Divider theme={theme} /></>}
                        {stock?.ev_ebitda_ttm != null && <><MetricRow label="EV / EBITDA (x)" value={fmtX(stock.ev_ebitda_ttm)} theme={theme} /><Divider theme={theme} /></>}
                        {stock?.book_value != null && <MetricRow label="Book Value" value={fmtPrice(stock.book_value)} theme={theme} />}
                    </Card>
                )}

                {/* ── Profitability ── */}
                {(stock?.roce != null || stock?.roe != null || stock?.ebitda_margin_ttm != null || stock?.pat_margin_ttm != null || stock?.eps_ttm != null) && (
                    <Card theme={theme} style={styles.card}>
                        <View style={styles.cardHeader}>
                            <Ionicons name="trending-up" size={16} color='#10B981' />
                            <Text style={[styles.cardTitle, { color: c.text }]}>Profitability</Text>
                        </View>
                        {stock?.roce != null && <><MetricRow label="ROCE" value={fmtPct(stock.roce)} valueColor='#10B981' theme={theme} /><Divider theme={theme} /></>}
                        {stock?.roe != null && <><MetricRow label="ROE" value={fmtPct(stock.roe)} valueColor='#10B981' theme={theme} /><Divider theme={theme} /></>}
                        {stock?.ebitda_margin_ttm != null && <><MetricRow label="EBITDA Margin" value={fmtPct(stock.ebitda_margin_ttm)} theme={theme} /><Divider theme={theme} /></>}
                        {stock?.pat_margin_ttm != null && <><MetricRow label="PAT Margin" value={fmtPct(stock.pat_margin_ttm)} theme={theme} /><Divider theme={theme} /></>}
                        {stock?.eps_ttm != null && <MetricRow label="EPS (TTM)" value={`₹${fmtNum(stock.eps_ttm)}`} theme={theme} />}
                    </Card>
                )}

                {/* ── Balance Sheet ── */}
                {(stock?.debt != null || stock?.promoter_holding_pct != null) && (
                    <Card theme={theme} style={styles.card}>
                        <View style={styles.cardHeader}>
                            <Ionicons name="shield-checkmark" size={16} color='#8B5CF6' />
                            <Text style={[styles.cardTitle, { color: c.text }]}>Balance Sheet</Text>
                        </View>
                        {stock?.debt != null && <><MetricRow label="Debt" value={fmtCr(stock.debt)} theme={theme} /><Divider theme={theme} /></>}
                        {stock?.promoter_holding_pct != null && (
                            <>
                                <MetricRow label="Promoter Holding" value={fmtPct(stock.promoter_holding_pct)} valueColor={stock.promoter_holding_pct >= 50 ? '#10B981' : undefined} theme={theme} />
                                {/* Promoter holding bar */}
                                <View style={[styles.barBg, { backgroundColor: c.border }]}>
                                    <View style={[styles.barFill, { width: `${stock.promoter_holding_pct}%` as any, backgroundColor: stock.promoter_holding_pct >= 50 ? '#10B981' : Colors.brand.secondary }]} />
                                </View>
                            </>
                        )}
                    </Card>
                )}

                {/* ── Research Reports ── */}
                {reports && reports.length > 0 && (
                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, { color: c.text }]}>Research Reports</Text>
                        {reports.map((r) => (
                            <Card
                                key={r.report_id}
                                theme={theme}
                                style={styles.reportCard}
                                onPress={() => router.push(`/report/${r.report_id}`)}
                            >
                                <View style={styles.reportRow}>
                                    <View style={[styles.reportIcon, { backgroundColor: c.infoBg }]}>
                                        <Ionicons name="document-text" size={18} color={c.info} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.reportDate, { color: c.textTertiary }]}>
                                            {r.published_at ? new Date(r.published_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                                        </Text>
                                        {r.target_price != null && (
                                            <Text style={[styles.reportTarget, { color: c.textSecondary }]}>
                                                Target: <Text style={{ color: c.success, fontWeight: '700' }}>{fmtPrice(r.target_price)}</Text>
                                            </Text>
                                        )}
                                    </View>
                                    {r.recommendation && <RecommendationBadge recommendation={r.recommendation} theme={theme} />}
                                    <Ionicons name="chevron-forward" size={16} color={c.textTertiary} />
                                </View>
                            </Card>
                        ))}
                    </View>
                )}

                {/* No data fallback */}
                {!stock && (
                    <Card theme={theme} style={[styles.card, { alignItems: 'center', paddingVertical: 40 }]}>
                        <Ionicons name="search-outline" size={40} color={c.textTertiary} />
                        <Text style={[{ color: c.textTertiary, marginTop: Spacing.md, fontSize: FontSize.sm }]}>
                            No data found for {symbol}
                        </Text>
                    </Card>
                )}

                <View style={{ height: 60 }} />
            </ResponsiveScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    content: { paddingHorizontal: Spacing.xl, paddingTop: Platform.select({ ios: 56, default: 32 }) },

    // Back bar
    backRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.xl },
    backBtn: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
    backLabel: { fontSize: FontSize.sm, fontWeight: '700', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
    sectorBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    sectorText: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },

    // Hero card
    heroCard: { padding: Spacing.xl, marginBottom: Spacing.md },
    companyName: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5, marginBottom: Spacing.sm },
    priceRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
    price: { fontSize: 36, fontWeight: '800', letterSpacing: -1 },
    changePill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
    changeText: { fontSize: 12, fontWeight: '700' },
    noPrice: { fontSize: FontSize.md, marginTop: 4 },
    rangeLabel: { fontSize: FontSize.xs, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
    targetRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.lg, padding: 12, borderRadius: BorderRadius.md, borderWidth: 1, flexWrap: 'wrap' },
    targetLabel: { fontSize: FontSize.sm, fontWeight: '500' },
    targetValue: { fontSize: FontSize.sm, fontWeight: '800' },
    targetUpside: { fontSize: 11 },

    // Cards
    card: { padding: Spacing.xl, marginBottom: Spacing.md },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing.sm },
    cardTitle: { fontSize: FontSize.md, fontWeight: '700' },

    // Balance sheet bar
    barBg: { height: 6, borderRadius: 3, marginTop: 8, overflow: 'hidden' },
    barFill: { height: 6, borderRadius: 3 },

    // Reports
    section: { marginBottom: Spacing.md },
    sectionTitle: { fontSize: FontSize.lg, fontWeight: '700', marginBottom: Spacing.md, letterSpacing: -0.2 },
    reportCard: { padding: Spacing.lg, marginBottom: Spacing.sm },
    reportRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    reportIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    reportDate: { fontSize: FontSize.xs, marginBottom: 2 },
    reportTarget: { fontSize: FontSize.sm },
});

// ── Stock Performance Styles ──
const perfStyles = StyleSheet.create({
    pillsRow: {
        flexDirection: 'row',
        gap: Spacing.sm,
        marginBottom: Spacing.lg,
        flexWrap: 'wrap',
    },
    pill: {
        flex: 1,
        minWidth: 70,
        alignItems: 'center',
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.sm,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
    },
    pillLabel: {
        fontSize: 10,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 4,
    },
    pillValueRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
    },
    pillValue: {
        fontSize: FontSize.base,
        fontWeight: '800',
    },
    barsSection: {
        gap: Spacing.md,
        marginBottom: Spacing.md,
    },
    barRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    barLabel: {
        width: 72,
        fontSize: FontSize.xs,
        fontWeight: '500',
    },
    barTrack: {
        flex: 1,
        height: 8,
        borderRadius: 4,
        backgroundColor: 'transparent',
        position: 'relative',
        overflow: 'hidden',
    },
    barCenter: {
        position: 'absolute',
        left: '50%',
        top: 0,
        bottom: 0,
        width: 1,
    },
    barFill: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        borderRadius: 4,
    },
    barValue: {
        width: 52,
        fontSize: FontSize.xs,
        fontWeight: '700',
        textAlign: 'right',
    },
    weekMetrics: {
        flexDirection: 'row',
        gap: Spacing.sm,
        paddingTop: Spacing.md,
        borderTopWidth: 1,
    },
    weekMetric: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.md,
        borderRadius: BorderRadius.md,
    },
    weekMetricLabel: {
        fontSize: 10,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.3,
    },
    weekMetricValue: {
        fontSize: FontSize.sm,
        fontWeight: '800',
    },
});
