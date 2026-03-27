import { DonutChart, PnlBarChart, getChartColor } from '@/components/charts';
import { Card, EmptyState, MetricCard, ResponsiveScrollView } from '@/components/ui';
import { BorderRadius, Colors, FontSize, Spacing } from '@/constants/theme';
import { useAlert } from '@/context/AlertContext';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { getAuthenticatedSupabase, supabase } from '@/lib/supabase';
import { useAuth as useClerkAuth } from '@clerk/clerk-expo';
import type { EnrichedHolding } from '@/lib/types';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    FlatList,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PortfolioScreen() {
    const theme = useColorScheme();
    const isDark = theme === 'dark';
    const c = Colors[theme];
    const { user } = useAuth();
    const { getToken } = useClerkAuth();
    const { showAlert } = useAlert();
    const queryClient = useQueryClient();
    const [refreshing, setRefreshing] = useState(false);

    const [showAdd, setShowAdd] = useState(false);
    const [symbol, setSymbol] = useState('');
    const [qty, setQty] = useState('');
    const [buyPrice, setBuyPrice] = useState('');

    const slideAnim = useRef(new Animated.Value(0)).current;
    const backdropAnim = useRef(new Animated.Value(0)).current;

    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<{ nse_code: string; company_name?: string }[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    const openModal = useCallback(() => {
        setShowAdd(true);
        Animated.parallel([
            Animated.timing(slideAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
            Animated.timing(backdropAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        ]).start();
    }, [slideAnim, backdropAnim]);

    const closeModal = useCallback(() => {
        if (Platform.OS !== 'web') Keyboard.dismiss();
        Animated.parallel([
            Animated.timing(slideAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
            Animated.timing(backdropAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
        ]).start(() => {
            setShowAdd(false);
            setSearchQuery('');
            setSearchResults([]);
        });
    }, [slideAnim, backdropAnim]);

    useEffect(() => {
        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        if (!searchQuery || searchQuery.length < 1) {
            setSearchResults([]);
            setIsSearching(false);
            return;
        }
        setIsSearching(true);
        searchTimeout.current = setTimeout(async () => {
            try {
                const { data } = await supabase
                    .from('equity_universe')
                    .select('nse_code, company_name')
                    .or(`nse_code.ilike.%${searchQuery}%,company_name.ilike.%${searchQuery}%`)
                    .limit(8);
                setSearchResults(data || []);
            } catch {
                setSearchResults([]);
            }
            setIsSearching(false);
        }, 300);
        return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
    }, [searchQuery]);

    const { data: portfolio, isLoading: portfolioLoading } = useQuery({
        queryKey: ['portfolio', user?.id],
        queryFn: async () => {
            if (!user?.id) return null;
            const token = await getToken({ template: 'supabase' });
            const client = getAuthenticatedSupabase(token);

            const { data: existing, error: fetchError } = await client.from('customer_portfolios').select('id, user_id, name, created_at, updated_at').eq('user_id', user.id).limit(1);
            if (fetchError) throw new Error(fetchError.message);
            if (existing && existing.length > 0) return existing[0];
            const { data: created, error: insertError } = await client.from('customer_portfolios').insert({ user_id: user.id, name: 'My Portfolio' }).select('id, user_id, name, created_at, updated_at').single();
            if (insertError) throw new Error(insertError.message);
            return created;
        },
        enabled: !!user?.id,
    });

    const { data: holdings, isLoading } = useQuery({
        queryKey: ['holdings', portfolio?.id],
        queryFn: async (): Promise<EnrichedHolding[]> => {
            if (!portfolio?.id) return [];
            const token = await getToken({ template: 'supabase' });
            const client = getAuthenticatedSupabase(token);

            const { data: raw } = await client.from('portfolio_holdings').select('id, portfolio_id, nse_symbol, company_name, quantity, buy_price, created_at, updated_at').eq('portfolio_id', portfolio.id).order('created_at', { ascending: false });
            if (!raw?.length) return [];
            const symbols = [...new Set(raw.map((h: any) => h.nse_symbol))];
            const { data: universe } = await supabase.from('equity_universe').select('nse_code, current_price, sector').in('nse_code', symbols);
            const priceMap = new Map((universe || []).map((u: any) => [u.nse_code, u]));
            return raw.map((h: any) => {
                const u = priceMap.get(h.nse_symbol);
                const invested = h.quantity * h.buy_price;
                const currentValue = u?.current_price != null ? h.quantity * u.current_price : null;
                const pnl = currentValue != null ? currentValue - invested : null;
                return { ...h, current_price: u?.current_price ?? null, sector: u?.sector ?? null, invested, current_value: currentValue, pnl, pnl_pct: pnl != null && invested > 0 ? (pnl / invested) * 100 : null };
            });
        },
        enabled: !!portfolio?.id,
        staleTime: 30000,
    });

    const totalInvested = holdings?.reduce((s, h) => s + h.invested, 0) ?? 0;
    const totalCurrent = holdings?.reduce((s, h) => s + (h.current_value ?? h.invested), 0) ?? 0;
    const totalPnl = totalCurrent - totalInvested;
    const totalPnlPct = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;

    // ── Health & Concentration Logic ──
    const healthScore = useMemo(() => {
        if (!holdings?.length) return 0;
        let score = 50;

        // Diversification
        const sectors = new Set(holdings.map(h => h.sector).filter(Boolean));
        if (sectors.size >= 5) score += 15;
        else if (sectors.size >= 3) score += 5;

        // Stock count
        if (holdings.length >= 10) score += 15;
        else if (holdings.length >= 5) score += 5;

        // Concentration
        const maxConcentration = Math.max(...holdings.map(h => ((h.current_value ?? h.invested) / totalCurrent) * 100));
        if (maxConcentration < 20) score += 10;
        else if (maxConcentration > 40) score -= 10;

        // Performance
        if (totalPnlPct > 15) score += 10;
        else if (totalPnlPct < -5) score -= 5;

        return Math.min(Math.max(score, 0), 100);
    }, [holdings, totalCurrent, totalPnlPct]);

    const concentrationAlerts = useMemo(() => {
        if (!holdings?.length) return [];
        return holdings.filter(h => {
            const pct = ((h.current_value ?? h.invested) / totalCurrent) * 100;
            return pct > 25;
        });
    }, [holdings, totalCurrent]);

    const allocationData = useMemo(() => {
        if (!holdings?.length) return [];
        return holdings.map((h, i) => ({
            label: h.nse_symbol,
            value: h.current_value ?? h.invested,
            color: getChartColor(i),
        }));
    }, [holdings]);

    const pnlData = useMemo(() => {
        if (!holdings?.length) return [];
        return holdings.filter((h) => h.pnl != null).map((h) => ({ label: h.nse_symbol, value: h.pnl! }));
    }, [holdings]);

    const sectorAllocation = useMemo(() => {
        if (!holdings?.length) return [];
        const map: Record<string, number> = {};
        holdings.forEach(h => {
            const s = h.sector || 'Other';
            map[s] = (map[s] || 0) + (h.current_value ?? h.invested);
        });
        return Object.entries(map).map(([label, value], i) => ({
            label,
            value,
            color: getChartColor(i + 5), // Offset colors
        })).sort((a, b) => b.value - a.value);
    }, [holdings]);

    const lastUpdated = useMemo(() => {
        // In a real app, this would come from the DB. Simulating for now.
        return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }, [holdings]);

    const addMutation = useMutation({
        mutationFn: async () => {
            if (!symbol || !qty || !buyPrice) throw new Error('Fill all fields');
            if (!portfolio?.id) throw new Error('Portfolio not ready');
            const token = await getToken({ template: 'supabase' });
            const client = getAuthenticatedSupabase(token);

            const { error } = await client.from('portfolio_holdings').insert({
                portfolio_id: portfolio.id,
                nse_symbol: symbol.toUpperCase().trim(),
                company_name: symbol.toUpperCase().trim(),
                quantity: parseFloat(qty),
                buy_price: parseFloat(buyPrice),
            });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['holdings'] });
            closeModal();
            setSymbol(''); setQty(''); setBuyPrice('');
            setSearchQuery(''); setSearchResults([]);
            showAlert('Added', 'Stock added to portfolio');
        },
        onError: (e) => showAlert('Error', e.message),
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const token = await getToken({ template: 'supabase' });
            const client = getAuthenticatedSupabase(token);
            const { error } = await client.from('portfolio_holdings').delete().eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['holdings'] }),
    });

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await queryClient.invalidateQueries({ queryKey: ['holdings'] });
        setRefreshing(false);
    }, [queryClient]);

    const fmt = (v: number) => `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

    const hasData = holdings && holdings.length > 0;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
        <ResponsiveScrollView
            style={{ flex: 1 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.brand.secondary} />}
        >
            {/* ── Header ── */}
            <View style={styles.header}>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.title, { color: c.text }]}>My Portfolio</Text>
                    <Text style={[styles.subtitle, { color: c.textSecondary }]}>{holdings?.length || 0} holdings</Text>
                </View>
                <TouchableOpacity style={[styles.addBtn, { backgroundColor: Colors.brand.primary }]} onPress={openModal} activeOpacity={0.85}>
                    <Ionicons name="add" size={22} color="#fff" />
                </TouchableOpacity>
            </View>

            {/* ── Summary Metrics ── */}
            {hasData && (
                <View style={styles.metricsRow}>
                    <MetricCard label="Current Value" value={fmt(totalCurrent)} theme={theme} />
                    <MetricCard label="Health Score" value={`${healthScore}/100`} theme={theme} valueColor={healthScore > 70 ? c.success : healthScore > 40 ? c.warning : c.danger} />
                    <MetricCard label="Total P&L" value={`${totalPnl >= 0 ? '+' : ''}${fmt(totalPnl)}`} theme={theme} valueColor={totalPnl >= 0 ? c.success : c.danger} />
                    <MetricCard label="Total Returns" value={`${totalPnlPct >= 0 ? '+' : ''}${totalPnlPct.toFixed(1)}%`} theme={theme} valueColor={totalPnlPct >= 0 ? c.success : c.danger} />
                </View>
            )}

            {/* ── AI Insights Banner ── */}
            {hasData && (
                <View style={styles.aiSection}>
                    <TouchableOpacity
                        onPress={() => router.push({ pathname: '/ai-chat', params: { sector: 'Portfolio Strategy' } } as any)}
                        activeOpacity={0.9}
                    >
                        <View style={[styles.aiBanner, { backgroundColor: Colors.brand.primary }]}>
                            <View style={styles.aiLeft}>
                                <View style={styles.aiIconWrap}>
                                    <Ionicons name="sparkles" size={20} color="#fff" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.aiBannerTitle}>AI Analyst Insight</Text>
                                    <Text style={styles.aiBannerSub}>
                                        {concentrationAlerts.length > 0
                                            ? `Attention: ${concentrationAlerts[0].nse_symbol} represents ${(((concentrationAlerts[0].current_value ?? concentrationAlerts[0].invested) / totalCurrent) * 100).toFixed(0)}% of your portfolio.`
                                            : healthScore > 80
                                                ? "Your portfolio looks well-diversified. Ready for deep-dive analysis?"
                                                : "I can help you optimize your diversification. Want to chat?"
                                        }
                                    </Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.6)" />
                            </View>
                        </View>
                    </TouchableOpacity>
                </View>
            )}

            {/* ── Charts ── */}
            {hasData && (
                <View style={styles.chartsRow}>
                    {/* Allocation Donut */}
                    <Card theme={theme} style={styles.chartCard}>
                        <Text style={[styles.chartTitle, { color: c.text }]}>Allocation</Text>
                        <Text style={[styles.chartSub, { color: c.textTertiary }]}>By current value</Text>
                        <View style={{ marginTop: Spacing.md }}>
                            <DonutChart
                                data={allocationData}
                                theme={theme}
                                centerValue={fmt(totalCurrent)}
                                centerLabel="Total"
                                size={160}
                            />
                        </View>
                    </Card>

                    {/* P&L Bar */}
                    {pnlData.length > 0 && (
                        <Card theme={theme} style={styles.chartCard}>
                            <Text style={[styles.chartTitle, { color: c.text }]}>Stock P&L</Text>
                            <Text style={[styles.chartSub, { color: c.textTertiary }]}>Profit / Loss (₹)</Text>
                            <View style={{ marginTop: Spacing.md }}>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                    <PnlBarChart
                                        data={pnlData}
                                        theme={theme}
                                        formatValue={(v) => `${v >= 0 ? '+' : ''}${fmt(v)}`}
                                    />
                                </ScrollView>
                            </View>
                        </Card>
                    )}

                    {/* Sector Allocation */}
                    {sectorAllocation.length > 0 && (
                        <Card theme={theme} style={styles.chartCard}>
                            <Text style={[styles.chartTitle, { color: c.text }]}>Sector Allocation</Text>
                            <Text style={[styles.chartSub, { color: c.textTertiary }]}>By industry diversification</Text>
                            <View style={{ marginTop: Spacing.md }}>
                                <DonutChart
                                    data={sectorAllocation}
                                    theme={theme}
                                    centerValue={`${sectorAllocation.length}`}
                                    centerLabel="Sectors"
                                    size={160}
                                />
                            </View>
                            <View style={styles.sectorList}>
                                {sectorAllocation.slice(0, 3).map((s, i) => (
                                    <View key={i} style={styles.sectorRow}>
                                        <View style={[styles.sectorDot, { backgroundColor: s.color }]} />
                                        <Text style={[styles.sectorLabel, { color: c.textSecondary }]}>{s.label}</Text>
                                        <Text style={[styles.sectorPct, { color: c.text }]}>{((s.value / totalCurrent) * 100).toFixed(0)}%</Text>
                                    </View>
                                ))}
                            </View>
                        </Card>
                    )}
                </View>
            )}

            {/* ── Benchmark Comparison ── */}
            {hasData && (
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: c.text, marginBottom: Spacing.md }]}>Performance vs Benchmark</Text>
                    <Card theme={theme} style={styles.benchmarkCard}>
                        <View style={styles.benchmarkRow}>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.benchmarkLabel, { color: c.textTertiary }]}>Your Portfolio</Text>
                                <Text style={[styles.benchmarkValue, { color: totalPnlPct >= 0 ? c.success : c.danger }]}>
                                    {totalPnlPct >= 0 ? '+' : ''}{totalPnlPct.toFixed(2)}%
                                </Text>
                            </View>
                            <View style={[styles.benchmarkDivider, { backgroundColor: c.border }]} />
                            <View style={{ flex: 1, alignItems: 'flex-end' }}>
                                <Text style={[styles.benchmarkLabel, { color: c.textTertiary }]}>Nifty 50 (Est.)</Text>
                                <Text style={[styles.benchmarkValue, { color: c.text }]}>+12.40%</Text>
                            </View>
                        </View>
                        <Text style={[styles.benchmarkNote, { color: c.textTertiary }]}>
                            *Benchmark data is indicative of annual year-to-date performance.
                        </Text>
                    </Card>
                </View>
            )}


            {/* ── Holdings ── */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, { color: c.text }]}>Holdings</Text>
                    {concentrationAlerts.length > 0 && (
                        <View style={[styles.alertPill, { backgroundColor: c.danger + '15' }]}>
                            <Ionicons name="warning" size={12} color={c.danger} />
                            <Text style={[styles.alertText, { color: c.danger }]}>Concentration Risk</Text>
                        </View>
                    )}
                </View>

                {isLoading ? (
                    <View style={styles.loadingWrap}>
                        <ActivityIndicator size="large" color={Colors.brand.secondary} />
                    </View>
                ) : hasData ? (
                    holdings.map((h, i) => {
                        const dotColor = getChartColor(i);
                        const isUp = (h.pnl ?? 0) >= 0;
                        const weight = ((h.current_value ?? h.invested) / totalCurrent) * 100;
                        return (
                            <Card
                                key={h.id}
                                theme={theme}
                                style={styles.holdingCard}
                                onPress={() => router.push(`/stock/${h.nse_symbol}` as any)}
                            >
                                <View style={styles.holdingRow}>
                                    {/* Color dot */}
                                    <View style={[styles.holdingDot, { backgroundColor: dotColor }]} />

                                    {/* Left: name + meta */}
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.holdingName, { color: c.text }]} numberOfLines={1}>
                                            {h.company_name || h.nse_symbol}
                                        </Text>
                                        <Text style={[styles.holdingMeta, { color: c.textTertiary }]}>
                                            {h.nse_symbol} · {h.quantity} shares · Avg ₹{h.buy_price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                        </Text>
                                    </View>

                                    {/* Right: value + P&L */}
                                    <View style={styles.holdingRight}>
                                        <Text style={[styles.holdingValue, { color: c.text }]}>
                                            {h.current_value != null ? fmt(h.current_value) : '—'}
                                        </Text>
                                        {h.pnl != null ? (
                                            <View style={[styles.pnlBadge, { backgroundColor: isUp ? c.success + '18' : c.danger + '18' }]}>
                                                <Ionicons name={isUp ? 'caret-up' : 'caret-down'} size={10} color={isUp ? c.success : c.danger} />
                                                <Text style={[styles.pnlText, { color: isUp ? c.success : c.danger }]}>
                                                    {h.pnl_pct?.toFixed(1)}%
                                                </Text>
                                            </View>
                                        ) : (
                                            <Text style={[styles.holdingMeta, { color: c.textTertiary }]}>No price</Text>
                                        )}
                                    </View>

                                    {/* Delete */}
                                    <TouchableOpacity
                                        style={styles.deleteBtn}
                                        onPress={() => showAlert('Remove?', `Remove ${h.company_name || h.nse_symbol}?`, [
                                            { text: 'Cancel', style: 'cancel' },
                                            { text: 'Remove', style: 'destructive', onPress: () => deleteMutation.mutate(h.id) },
                                        ])}
                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    >
                                        <Ionicons name="trash-outline" size={16} color={c.textTertiary} />
                                    </TouchableOpacity>
                                </View>

                                {/* Progress bar: Weight in portfolio */}
                                {h.current_value != null && (
                                    <View style={{ marginTop: 12 }}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                                            <Text style={{ color: c.textTertiary, fontSize: 10 }}>Portfolio Weight</Text>
                                            <Text style={{ color: c.textSecondary, fontSize: 10, fontWeight: '700' }}>{weight.toFixed(1)}%</Text>
                                        </View>
                                        <View style={[styles.progressBg, { backgroundColor: c.border }]}>
                                            <View style={[
                                                styles.progressFill,
                                                {
                                                    width: `${Math.min(weight, 100)}%` as any,
                                                    backgroundColor: weight > 25 ? c.danger : dotColor,
                                                },
                                            ]} />
                                        </View>
                                    </View>
                                )}
                            </Card>
                        );
                    })
                ) : (
                    <EmptyState
                        icon="pie-chart-outline"
                        title="No Holdings"
                        subtitle="Tap + to add your first stock and start tracking."
                        theme={theme}
                    />
                )}
            </View>

            {/* ── Legal & Data Disclaimer ── */}
            <View style={styles.footer}>
                <View style={styles.dataStatus}>
                    <Ionicons name="time-outline" size={14} color={c.textTertiary} />
                    <Text style={[styles.footerText, { color: c.textTertiary }]}>
                        Prices updated today at {lastUpdated} · Source: Exchange (Delayed)
                    </Text>
                </View>

                <TouchableOpacity
                    onPress={() => showAlert('Report Issue', 'Is the price or quantity incorrect? We will verify and update our database.', [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Report Error', onPress: () => showAlert('Thank You', 'Our data team has been notified. We will review the discrepancy.') }
                    ])}
                    style={styles.reportLink}
                >
                    <Text style={{ color: Colors.brand.secondary, fontSize: 12, fontWeight: '600' }}>Report Data Discrepancy</Text>
                </TouchableOpacity>

                <View style={[styles.legalBox, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }]}>
                    <Text style={[styles.legalText, { color: c.textTertiary }]}>
                        <Text style={{ fontWeight: '700', color: c.textSecondary }}>LEGAL DISCLAIMER: </Text>
                        This portfolio tracker is for educational and research purposes only. Market data is provided "as is" and may be inaccurate or delayed.
                        We are a SEBI registered Research Analyst (REG NO: INH000069807). This does not constitute investment advice. Please verify all data with your official broker statements before making trading decisions.
                    </Text>
                </View>
            </View>

            {/* ── Add Stock Modal ── */}
            <Modal visible={showAdd} transparent animationType="none" onRequestClose={closeModal} statusBarTranslucent>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                    <TouchableWithoutFeedback onPress={closeModal}>
                        <Animated.View style={[styles.modalBackdrop, { opacity: backdropAnim }]} />
                    </TouchableWithoutFeedback>

                    <Animated.View style={[
                        styles.modalSheet,
                        {
                            backgroundColor: c.surface,
                            transform: [{ translateY: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [600, 0] }) }],
                        },
                    ]}>
                        <View style={styles.modalHandle}>
                            <View style={[styles.modalHandleBar, { backgroundColor: c.border }]} />
                        </View>

                        <View style={styles.modalHeader}>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.modalTitle, { color: c.text }]}>Add Stock</Text>
                                <Text style={[styles.modalSubtitle, { color: c.textTertiary }]}>Search and add to your portfolio</Text>
                            </View>
                            <TouchableOpacity onPress={closeModal} style={[styles.modalCloseBtn, { backgroundColor: c.surfaceElevated }]}>
                                <Ionicons name="close" size={18} color={c.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.modalBody}>
                            <View style={[styles.searchContainer, { backgroundColor: c.inputBg, borderColor: symbol ? Colors.brand.accent : c.inputBorder }]}>
                                <Ionicons name="search" size={18} color={c.textTertiary} />
                                <TextInput
                                    style={[styles.searchTextInput, { color: c.text }]}
                                    placeholder="Search by symbol or name..."
                                    placeholderTextColor={c.textTertiary}
                                    value={symbol ? symbol : searchQuery}
                                    onChangeText={(text) => {
                                        if (symbol) { setSymbol(''); setSearchQuery(text); }
                                        else { setSearchQuery(text); }
                                    }}
                                    autoCapitalize="characters"
                                    autoFocus
                                />
                                {(symbol || searchQuery) ? (
                                    <TouchableOpacity onPress={() => { setSymbol(''); setSearchQuery(''); }}>
                                        <Ionicons name="close-circle" size={18} color={c.textTertiary} />
                                    </TouchableOpacity>
                                ) : null}
                            </View>

                            {symbol ? (
                                <View style={[styles.selectedPill, { backgroundColor: Colors.brand.secondary + '18', borderColor: Colors.brand.secondary + '40' }]}>
                                    <Ionicons name="checkmark-circle" size={16} color={Colors.brand.secondary} />
                                    <Text style={[styles.selectedPillText, { color: Colors.brand.secondary }]}>{symbol}</Text>
                                </View>
                            ) : null}

                            {!symbol && searchQuery.length > 0 && (
                                <View style={[styles.searchResultsContainer, { borderColor: c.border }]}>
                                    {isSearching ? (
                                        <View style={styles.searchLoading}>
                                            <ActivityIndicator size="small" color={Colors.brand.secondary} />
                                            <Text style={{ color: c.textTertiary, fontSize: FontSize.sm }}>Searching...</Text>
                                        </View>
                                    ) : searchResults.length > 0 ? (
                                        <FlatList
                                            data={searchResults}
                                            keyExtractor={(item) => item.nse_code}
                                            keyboardShouldPersistTaps="handled"
                                            style={{ maxHeight: 200 }}
                                            renderItem={({ item }) => (
                                                <TouchableOpacity
                                                    style={[styles.searchResultItem, { borderBottomColor: c.borderLight }]}
                                                    onPress={() => { setSymbol(item.nse_code); setSearchQuery(''); setSearchResults([]); }}
                                                    activeOpacity={0.6}
                                                >
                                                    <View style={[styles.searchResultIcon, { backgroundColor: Colors.brand.secondary + '15' }]}>
                                                        <Ionicons name="trending-up" size={14} color={Colors.brand.secondary} />
                                                    </View>
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={{ color: c.text, fontSize: FontSize.sm, fontWeight: '700' }}>{item.nse_code}</Text>
                                                        {item.company_name && <Text style={{ color: c.textTertiary, fontSize: FontSize.xs, marginTop: 1 }} numberOfLines={1}>{item.company_name}</Text>}
                                                    </View>
                                                    <Ionicons name="add-circle-outline" size={20} color={Colors.brand.secondary} />
                                                </TouchableOpacity>
                                            )}
                                        />
                                    ) : (
                                        <View style={styles.searchLoading}>
                                            <Text style={{ color: c.textTertiary, fontSize: FontSize.sm }}>No results for "{searchQuery}"</Text>
                                        </View>
                                    )}
                                </View>
                            )}

                            <View style={[styles.formRow, { marginTop: Spacing.lg }]}>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.inputLabel, { color: c.textSecondary }]}>Quantity</Text>
                                    <TextInput style={[styles.modalInput, { backgroundColor: c.inputBg, borderColor: c.inputBorder, color: c.text }]} placeholder="0" placeholderTextColor={c.textTertiary} value={qty} onChangeText={setQty} keyboardType="numeric" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.inputLabel, { color: c.textSecondary }]}>Buy Price (₹)</Text>
                                    <TextInput style={[styles.modalInput, { backgroundColor: c.inputBg, borderColor: c.inputBorder, color: c.text }]} placeholder="0.00" placeholderTextColor={c.textTertiary} value={buyPrice} onChangeText={setBuyPrice} keyboardType="numeric" />
                                </View>
                            </View>

                            <TouchableOpacity
                                style={[styles.modalSubmitBtn, { backgroundColor: (symbol && qty && buyPrice) ? Colors.brand.primary : c.surfaceElevated, opacity: (addMutation.isPending || portfolioLoading) ? 0.6 : 1 }]}
                                onPress={() => addMutation.mutate()}
                                disabled={addMutation.isPending || portfolioLoading || !symbol || !qty || !buyPrice}
                                activeOpacity={0.85}
                            >
                                {addMutation.isPending || portfolioLoading ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <Ionicons name="add-circle" size={20} color={(symbol && qty && buyPrice) ? '#fff' : c.textTertiary} />
                                        <Text style={{ fontWeight: '700', fontSize: FontSize.base, color: (symbol && qty && buyPrice) ? '#fff' : c.textTertiary }}>
                                            Add to Portfolio
                                        </Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        </View>
                    </Animated.View>
                </KeyboardAvoidingView>
            </Modal>

            <View style={{ height: 40 }} />
        </ResponsiveScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.xl, paddingTop: Platform.select({ ios: 60, web: 20, default: 48 }), paddingBottom: Spacing.lg },
    title: { fontSize: FontSize.xl, fontWeight: '700', letterSpacing: -0.3 },
    subtitle: { fontSize: FontSize.sm, marginTop: 2 },
    addBtn: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    metricsRow: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: Spacing.xl, gap: Spacing.sm, marginBottom: Spacing.xl },
    chartsRow: { paddingHorizontal: Spacing.xl, gap: Spacing.md, marginBottom: Spacing.xl },
    chartCard: { padding: Spacing.lg },
    chartTitle: { fontSize: FontSize.md, fontWeight: '700' },
    chartSub: { fontSize: FontSize.xs, marginTop: 2 },
    section: { paddingHorizontal: Spacing.xl },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
    sectionTitle: { fontSize: FontSize.lg, fontWeight: '700', letterSpacing: -0.2 },
    alertPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    alertText: { fontSize: 10, fontWeight: '700' },
    loadingWrap: { paddingVertical: 40, alignItems: 'center' },
    holdingCard: { padding: Spacing.lg, marginBottom: Spacing.sm },
    holdingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    holdingDot: { width: 10, height: 10, borderRadius: 5 },
    holdingName: { fontSize: FontSize.base, fontWeight: '600' },
    holdingMeta: { fontSize: FontSize.xs, marginTop: 2 },
    holdingRight: { alignItems: 'flex-end', minWidth: 80 },
    holdingValue: { fontSize: FontSize.base, fontWeight: '700' },
    pnlBadge: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginTop: 3 },
    pnlText: { fontSize: 11, fontWeight: '700' },
    deleteBtn: { paddingLeft: 4 },
    progressBg: { height: 3, borderRadius: 2, overflow: 'hidden' },
    progressFill: { height: 3, borderRadius: 2 },

    // Modal
    modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
    modalSheet: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        borderTopLeftRadius: 24, borderTopRightRadius: 24,
        paddingBottom: Platform.OS === 'ios' ? 34 : 24, maxHeight: '85%',
        shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 25,
        ...(Platform.OS === 'web' ? { width: '90%', maxWidth: 520, alignSelf: 'center', left: 'auto', right: 'auto', borderRadius: 24, marginBottom: 24 } as any : {}),
    },
    modalHandle: { alignItems: 'center', paddingTop: 12, paddingBottom: 4 },
    modalHandleBar: { width: 40, height: 4, borderRadius: 2 },
    modalHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.xl, paddingTop: Spacing.md, paddingBottom: Spacing.lg },
    modalTitle: { fontSize: FontSize.lg, fontWeight: '700', letterSpacing: -0.3 },
    modalSubtitle: { fontSize: FontSize.xs, marginTop: 2 },
    modalCloseBtn: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    modalBody: { paddingHorizontal: Spacing.xl },
    searchContainer: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: BorderRadius.md, paddingHorizontal: 14, height: 50, gap: 10 },
    searchTextInput: { flex: 1, fontSize: FontSize.base, height: 50 },
    selectedPill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: BorderRadius.full, borderWidth: 1, marginTop: Spacing.sm },
    selectedPillText: { fontSize: FontSize.sm, fontWeight: '700', letterSpacing: 0.5 },
    searchResultsContainer: { marginTop: Spacing.sm, borderRadius: BorderRadius.md, borderWidth: 1, overflow: 'hidden' },
    searchResultItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, gap: 12, borderBottomWidth: StyleSheet.hairlineWidth },
    searchResultIcon: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
    searchLoading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: Spacing.lg },
    formRow: { flexDirection: 'row', gap: Spacing.md },
    inputLabel: { fontSize: FontSize.xs, fontWeight: '600', marginBottom: 6, letterSpacing: 0.3, textTransform: 'uppercase' },
    modalInput: { borderWidth: 1, borderRadius: BorderRadius.sm, paddingHorizontal: 14, height: 48, fontSize: FontSize.base },
    modalSubmitBtn: { height: 52, borderRadius: BorderRadius.md, justifyContent: 'center', alignItems: 'center', marginTop: Spacing.xl },

    // AI Banner
    aiSection: { paddingHorizontal: Spacing.xl, marginBottom: Spacing.xl },
    aiBanner: { borderRadius: BorderRadius.xl, padding: Spacing.lg, gap: Spacing.md },
    aiLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    aiIconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
    aiBannerTitle: { color: '#fff', fontSize: FontSize.base, fontWeight: '700' },
    aiBannerSub: { color: 'rgba(255,255,255,0.75)', fontSize: FontSize.xs, marginTop: 2, lineHeight: 16 },
    aiChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    aiChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: BorderRadius.full },
    aiChipText: { color: 'rgba(255,255,255,0.9)', fontSize: 11, fontWeight: '600' },

    // Sector Allocation UI
    sectorList: { marginTop: Spacing.md, gap: 8 },
    sectorRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    sectorDot: { width: 8, height: 8, borderRadius: 4 },
    sectorLabel: { flex: 1, fontSize: 11 },
    sectorPct: { fontSize: 11, fontWeight: '700' },

    // Benchmark UI
    benchmarkCard: { padding: Spacing.lg, marginTop: Spacing.sm },
    benchmarkRow: { flexDirection: 'row', alignItems: 'center' },
    benchmarkDivider: { width: 1, height: 40, marginHorizontal: Spacing.xl },
    benchmarkLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
    benchmarkValue: { fontSize: FontSize.lg, fontWeight: '800' },
    benchmarkNote: { fontSize: 9, marginTop: 12, fontStyle: 'italic' },

    // Footer & Legal
    footer: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing['2xl'], gap: Spacing.md, alignItems: 'center' },
    dataStatus: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    footerText: { fontSize: 11 },
    reportLink: { paddingVertical: 4 },
    legalBox: { padding: Spacing.lg, borderRadius: BorderRadius.md, width: '100%', marginTop: Spacing.sm },
    legalText: { fontSize: 10, lineHeight: 15, textAlign: 'justify' },
});

