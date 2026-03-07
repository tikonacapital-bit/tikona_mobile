import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform, Animated } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Colors, Spacing, BorderRadius, FontSize } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useStockQuote } from '@/hooks/useStockQuote';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { Card, MetricCard, RecommendationBadge, SectionHeader, ResponsiveScrollView, ResponsiveContainer } from '@/components/ui';
import { TradingViewChart, ComparisonChart } from '@/components/charts';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import type { EquityUniverse, ResearchReport } from '@/lib/types';

const fmt = (v: number | null | undefined, suffix = ''): string => v != null ? `${v.toFixed(2)}${suffix}` : '—';
const fmtCr = (v: number | null | undefined): string => {
    if (v == null) return '—';
    if (v >= 100000) return `₹${(v / 100000).toFixed(2)} Lakh Cr`;
    if (v >= 1000) return `₹${(v / 1000).toFixed(1)}K Cr`;
    if (v >= 1) return `₹${v.toFixed(0)} Cr`;
    return `₹${v.toFixed(2)} Cr`;
};
const fmtPrice = (v: number | null | undefined): string => {
    if (v == null) return '—';
    return `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
};
const fmtVol = (v: number | null | undefined): string => {
    if (v == null) return '—';
    if (v >= 10000000) return `${(v / 10000000).toFixed(2)} Cr`;
    if (v >= 100000) return `${(v / 100000).toFixed(2)} L`;
    if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
    return v.toLocaleString('en-IN');
};

export default function StockDetailScreen() {
    const { symbol } = useLocalSearchParams<{ symbol: string }>();
    const theme = useColorScheme();
    const c = Colors[theme];
    const isDark = theme === 'dark';
    const [showDesc, setShowDesc] = useState(false);



    const { quote, screener, loading: quoteLoading, refresh } = useStockQuote(symbol, { refreshIntervalMs: 30000 });

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
            const { data } = await supabase.from('research_reports').select('*').eq('is_published', true).eq('nse_symbol', symbol!).order('published_at', { ascending: false }).limit(5);
            return data ?? [];
        },
        enabled: !!symbol,
    });

    if (isLoading && quoteLoading) {
        return (
            <View style={[styles.loadingWrap, { backgroundColor: c.background }]}>
                <ActivityIndicator size="large" color={Colors.brand.primary} />
            </View>
        );
    }

    const priceChange = quote?.change ?? 0;
    const priceUp = priceChange >= 0;
    const glowColor = priceUp ? '#10b981' : '#ef4444'; // Emerald for up, Red for down
    return (
        <View style={[styles.container, { backgroundColor: c.background }]}>
            {/* ═══ Scrollable Content ═══ */}
            <ResponsiveScrollView contentContainerStyle={styles.content}>
                <ResponsiveContainer style={{ paddingHorizontal: Spacing.xl }}>

                    {/* ═══ Integrated Premium Header ═══ */}
                    <HeaderContent symbol={symbol!} stock={stock} screener={screener} quote={quote} c={c} priceUp={priceUp} priceChange={priceChange} />

                    {/* Chart Section */}
                    <SectionHeader title="Price Chart" theme={theme} />
                    <View style={[styles.chartWrapper, { backgroundColor: c.surfaceElevated }]}>
                        <TradingViewChart symbol={symbol!} theme={theme} />
                    </View>

                    {/* ═══ Performance vs Benchmarks ═══ */}
                    <View style={{ marginTop: Spacing.xl }}>
                        <SectionHeader title="Performance vs Benchmarks" theme={theme} />
                    </View>
                    <View style={[styles.chartWrapper, { backgroundColor: c.surfaceElevated }]}>
                        <ComparisonChart symbol={symbol!} theme={theme} />
                    </View>

                    {/* ═══ Today's Trading ═══ */}
                    {quote && (
                        <>
                            <View style={styles.sectionRow}>
                                <SectionHeader title="Today's Trading" theme={theme} />
                                <View style={styles.liveTag}>
                                    <View style={[styles.statusDot, { backgroundColor: '#34D399' }]} />
                                    <Text style={styles.liveTagText}>Live Updates</Text>
                                </View>
                            </View>
                            <View style={styles.metricsGrid}>
                                <MetricCard label="Day High" value={fmtPrice(quote.dayHigh)} theme={theme} />
                                <MetricCard label="Day Low" value={fmtPrice(quote.dayLow)} theme={theme} />
                                <MetricCard label="Prev Close" value={fmtPrice(quote.previousClose)} theme={theme} />
                                <MetricCard label="Volume" value={fmtVol(quote.volume)} theme={theme} />
                                <MetricCard label="52W High" value={fmtPrice(quote.high52Week)} theme={theme} />
                                <MetricCard label="52W Low" value={fmtPrice(quote.low52Week)} theme={theme} />
                            </View>
                        </>
                    )}

                    {/* ═══ Key Metrics (Screener.in) ═══ */}
                    {screener && (
                        <>
                            <View style={styles.sectionRow}>
                                <SectionHeader title="Key Metrics" theme={theme} />
                                <View style={[styles.sourceTag, { backgroundColor: c.borderLight }]}>
                                    <Text style={{ fontSize: 9, color: c.textSecondary, fontWeight: '600' }}>Screener.in</Text>
                                </View>
                            </View>
                            <View style={styles.metricsGrid}>
                                <MetricCard label="Market Cap" value={fmtCr(screener.marketCap)} theme={theme} />
                                <MetricCard label="Stock P/E" value={screener.stockPE != null ? `${screener.stockPE.toFixed(2)}x` : '—'} theme={theme} />
                                <MetricCard label="Book Value" value={screener.bookValue != null ? `₹${screener.bookValue.toFixed(0)}` : '—'} theme={theme} />
                                <MetricCard label="Div Yield" value={screener.dividendYield != null ? `${screener.dividendYield.toFixed(2)}%` : '—'} theme={theme} />
                                <MetricCard label="ROCE" value={screener.roce != null ? `${screener.roce.toFixed(2)}%` : '—'} theme={theme} />
                                <MetricCard label="ROE" value={screener.roe != null ? `${screener.roe.toFixed(2)}%` : '—'} theme={theme} />
                                <MetricCard label="Face Value" value={screener.faceValue != null ? `₹${screener.faceValue}` : '—'} theme={theme} />
                            </View>
                        </>
                    )}

                    {/* ═══ Additional Metrics (Supabase) ═══ */}
                    {stock && (stock.ev_ebitda_ttm != null || stock.ebitda_margin_ttm != null || stock.debt != null) && (
                        <>
                            <SectionHeader title="Fundamentals" theme={theme} />
                            <View style={styles.metricsGrid}>
                                {stock.ev_ebitda_ttm != null && <MetricCard label="EV/EBITDA" value={fmt(stock.ev_ebitda_ttm, 'x')} theme={theme} />}
                                {stock.ebitda_margin_ttm != null && <MetricCard label="EBITDA Margin" value={fmt(stock.ebitda_margin_ttm, '%')} theme={theme} />}
                                {stock.debt != null && <MetricCard label="Debt" value={fmtCr(stock.debt)} theme={theme} />}
                                {stock.promoter_holding_pct != null && <MetricCard label="Promoter Hold" value={fmt(stock.promoter_holding_pct, '%')} theme={theme} />}
                                {stock.eps_ttm != null && <MetricCard label="EPS (TTM)" value={fmt(stock.eps_ttm)} theme={theme} />}
                                {stock.pe_ttm != null && !screener?.stockPE && <MetricCard label="P/E (TTM)" value={fmt(stock.pe_ttm, 'x')} theme={theme} />}
                            </View>
                        </>
                    )}

                    {/* ═══ About (Screener.in) ═══ */}
                    {screener?.description && (
                        <>
                            <SectionHeader title="About" theme={theme} />
                            <Card theme={theme} style={styles.aboutCard}>
                                <Text
                                    style={[styles.aboutText, { color: c.textSecondary }]}
                                    numberOfLines={showDesc ? undefined : 4}
                                >
                                    {screener.description}
                                </Text>
                                <TouchableOpacity onPress={() => setShowDesc(!showDesc)} activeOpacity={0.7}>
                                    <Text style={{ color: Colors.brand.primary, fontSize: FontSize.sm, fontWeight: '700', marginTop: 8 }}>
                                        {showDesc ? 'Show Less' : 'Read More →'}
                                    </Text>
                                </TouchableOpacity>
                            </Card>
                        </>
                    )}

                    {!stock && !quote && !screener && (
                        <View style={styles.noData}>
                            <Text style={[{ color: c.textSecondary, fontSize: FontSize.sm }]}>No data available for {symbol}.</Text>
                        </View>
                    )}

                    {/* Last Updated */}
                    {quote && (
                        <View style={styles.footer}>
                            <Text style={[styles.updatedAt, { color: c.textTertiary }]}>
                                Data by Yahoo Finance & Screener.in{'\n'}
                                Last updated: {quote.lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </Text>
                            <TouchableOpacity onPress={refresh} style={[styles.refreshBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]} activeOpacity={0.7}>
                                <Ionicons name="refresh" size={12} color={c.textSecondary} />
                                <Text style={{ color: c.textSecondary, fontSize: 12, fontWeight: '600' }}>Refresh Data</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    <View style={{ height: 60 }} />
                </ResponsiveContainer>
            </ResponsiveScrollView>
        </View >
    );
}

// ── Shared Header Content Component ──
function HeaderContent({ symbol, stock, screener, quote, c, priceUp, priceChange }: any) {
    return (
        <View style={styles.headerContentWrapper}>
            <View style={styles.topNavRow}>
                <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: c.borderLight }]} activeOpacity={0.8}>
                    <Ionicons name="chevron-back" size={20} color={c.text} />
                </TouchableOpacity>
                <View style={styles.symbolBadge}>
                    <Text style={[styles.symbolTextTop, { color: c.textSecondary }]}>NSE: {symbol}</Text>
                    {(screener?.sector || stock?.sector) && (
                        <View style={[styles.sectorBadge, { backgroundColor: c.borderLight }]}>
                            <Text style={{ color: c.textSecondary, fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                {screener?.industry || screener?.sector || stock?.sector}
                            </Text>
                        </View>
                    )}
                </View>
            </View>

            <View style={styles.headerMain}>
                <Text style={[styles.companyName, { color: c.text }]} numberOfLines={2}>
                    {quote?.companyName || stock?.company_name || symbol}
                </Text>

                <View style={styles.priceRow}>
                    <Text style={[styles.price, { color: c.text }]}>
                        {quote ? fmtPrice(quote.currentPrice) : fmtPrice(stock?.current_price)}
                    </Text>
                    {quote && (
                        <View style={[styles.changePill, { backgroundColor: priceUp ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)' }]}>
                            <Ionicons name={priceUp ? 'caret-up' : 'caret-down'} size={14} color={priceUp ? '#10b981' : '#ef4444'} />
                            <Text style={{ fontSize: 14, fontWeight: '700', color: priceUp ? '#10b981' : '#ef4444' }}>
                                {priceUp ? '+' : ''}{priceChange.toFixed(2)} ({quote.changePct.toFixed(2)}%)
                            </Text>
                        </View>
                    )}
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    /* ── Header ── */
    headerContentWrapper: {
        paddingTop: Platform.select({ ios: 50, default: 30 }),
        paddingBottom: Spacing.xl,
    },
    topNavRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: Spacing.lg,
    },
    symbolBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    symbolTextTop: { fontSize: FontSize.sm, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontWeight: '700' },
    sectorBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    headerMain: {
        gap: 4,
    },
    backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
    companyName: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5, lineHeight: 32 },
    priceRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 12,
        marginTop: 4,
    },
    price: { fontSize: 40, fontWeight: '800', letterSpacing: -1.5 },
    changePill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, marginBottom: 6 },

    /* ── Content ── */
    content: { paddingTop: Spacing.xl }, // removed left/right padding here, handling it inside ResponsiveContainer
    chartWrapper: {
        borderRadius: BorderRadius.xl,
        overflow: 'hidden',
        marginBottom: Spacing.xl,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
        padding: Spacing.lg,
    },
    sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
    liveTag: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: 'rgba(52, 211, 153, 0.15)', borderWidth: 1, borderColor: 'rgba(52, 211, 153, 0.3)' },
    liveTagText: { fontSize: 11, fontWeight: '700', color: '#34D399', letterSpacing: 0.5, textTransform: 'uppercase' },
    sourceTag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    statusDot: { width: 6, height: 6, borderRadius: 3 },
    metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing['2xl'], justifyContent: 'space-between' },
    noData: { padding: Spacing['3xl'], alignItems: 'center' },

    /* ── About ── */
    aboutCard: { padding: Spacing.xl, marginBottom: Spacing['2xl'], borderRadius: BorderRadius.xl },
    aboutText: { fontSize: FontSize.md, lineHeight: 24 },

    /* ── Footer ── */
    footer: { alignItems: 'center', gap: Spacing.md, marginTop: Spacing.xl },
    updatedAt: { fontSize: 11, textAlign: 'center', lineHeight: 18, fontWeight: '500' },
    refreshBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
});
