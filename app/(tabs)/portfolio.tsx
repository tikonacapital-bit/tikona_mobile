import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity,
    TextInput, ActivityIndicator, RefreshControl, Platform,
    Modal, Animated, KeyboardAvoidingView, FlatList, ScrollView,
    Keyboard, TouchableWithoutFeedback,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Colors, Spacing, BorderRadius, FontSize } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useAlert } from '@/context/AlertContext';
import { supabase } from '@/lib/supabase';
import { Card, SectionHeader, MetricCard, EmptyState, ResponsiveScrollView } from '@/components/ui';
import { DonutChart, PnlBarChart, getChartColor, TradingViewChart } from '@/components/charts';
import type { EnrichedHolding } from '@/lib/types';

export default function PortfolioScreen() {
    const theme = useColorScheme();
    const c = Colors[theme];
    const { user } = useAuth();
    const { showAlert } = useAlert();
    const queryClient = useQueryClient();
    const [refreshing, setRefreshing] = useState(false);

    const [showAdd, setShowAdd] = useState(false);
    const [symbol, setSymbol] = useState('');
    const [qty, setQty] = useState('');
    const [buyPrice, setBuyPrice] = useState('');
    const [selectedChart, setSelectedChart] = useState<string | null>(null);
    const [searchSymbol, setSearchSymbol] = useState('');

    // Modal animation
    const slideAnim = useRef(new Animated.Value(0)).current;
    const backdropAnim = useRef(new Animated.Value(0)).current;

    // Stock search state
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

    // Debounced stock search
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
            const { data: existing, error: fetchError } = await supabase.from('customer_portfolios').select('*').eq('user_id', user.id).limit(1);
            if (fetchError) throw new Error(`Failed to fetch portfolio: ${fetchError.message}`);
            if (existing && existing.length > 0) return existing[0];
            const { data: created, error: insertError } = await supabase.from('customer_portfolios').insert({ user_id: user.id, name: 'My Portfolio' }).select().single();
            if (insertError) throw new Error(`Failed to create portfolio: ${insertError.message}`);
            return created;
        },
        enabled: !!user?.id,
    });

    const { data: holdings, isLoading } = useQuery({
        queryKey: ['holdings', portfolio?.id],
        queryFn: async (): Promise<EnrichedHolding[]> => {
            if (!portfolio?.id) return [];
            const { data: raw } = await supabase.from('portfolio_holdings').select('*').eq('portfolio_id', portfolio.id).order('created_at', { ascending: false });
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

    const addMutation = useMutation({
        mutationFn: async () => {
            if (!symbol || !qty || !buyPrice) throw new Error('Fill all fields');
            if (!portfolio?.id) throw new Error('Portfolio not ready. Please wait a moment and try again.');
            const { error } = await supabase.from('portfolio_holdings').insert({
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
            const { error } = await supabase.from('portfolio_holdings').delete().eq('id', id);
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

    // Chart data
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
        return holdings
            .filter((h) => h.pnl != null)
            .map((h) => ({
                label: h.nse_symbol,
                value: h.pnl!,
            }));
    }, [holdings]);

    return (
        <ResponsiveScrollView
            style={[styles.container, { backgroundColor: c.background }]}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.brand.secondary} />}
        >
            {/* Header */}
            <View style={styles.header}>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.title, { color: c.text }]}>My Portfolio</Text>
                    <Text style={[styles.subtitle, { color: c.textSecondary }]}>{holdings?.length || 0} holdings</Text>
                </View>
                <TouchableOpacity
                    style={[styles.addBtn, { backgroundColor: Colors.brand.primary }]}
                    onPress={openModal}
                    activeOpacity={0.85}
                >
                    <Ionicons name="add" size={22} color="#fff" />
                </TouchableOpacity>
            </View>

            {/* Summary Metrics */}
            {holdings && holdings.length > 0 && (
                <View style={styles.metricsRow}>
                    <MetricCard label="Invested" value={fmt(totalInvested)} theme={theme} />
                    <MetricCard label="Current" value={fmt(totalCurrent)} theme={theme} />
                    <MetricCard label="P&L" value={`${totalPnl >= 0 ? '+' : ''}${fmt(totalPnl)}`} theme={theme} valueColor={totalPnl >= 0 ? c.success : c.danger} />
                    <MetricCard label="Returns" value={`${totalPnlPct >= 0 ? '+' : ''}${totalPnlPct.toFixed(1)}%`} theme={theme} valueColor={totalPnlPct >= 0 ? c.success : c.danger} />
                </View>
            )}

            {/* Charts Section */}
            {holdings && holdings.length > 0 && (
                <View style={styles.chartsSection}>
                    {/* Allocation Donut */}
                    <Card theme={theme} style={styles.chartCard}>
                        <Text style={[styles.chartTitle, { color: c.text }]}>Allocation</Text>
                        <Text style={[styles.chartSubtitle, { color: c.textTertiary }]}>Portfolio distribution by stock</Text>
                        <View style={{ marginTop: Spacing.md }}>
                            <DonutChart
                                data={allocationData}
                                theme={theme}
                                centerValue={fmt(totalCurrent)}
                                centerLabel="Total Value"
                            />
                        </View>
                    </Card>

                    {/* P&L Bar Chart */}
                    {pnlData.length > 0 && (
                        <Card theme={theme} style={styles.chartCard}>
                            <Text style={[styles.chartTitle, { color: c.text }]}>Stock P&L</Text>
                            <Text style={[styles.chartSubtitle, { color: c.textTertiary }]}>Profit / Loss per stock (₹)</Text>
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
                </View>
            )}

            {/* Price Charts Section */}
            {holdings && holdings.length > 0 && (
                <View style={styles.chartsSection}>
                    <Card theme={theme} style={styles.chartCard}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <View>
                                <Text style={[styles.chartTitle, { color: c.text }]}>Price Chart</Text>
                                <Text style={[styles.chartSubtitle, { color: c.textTertiary }]}>Tap a stock to view chart</Text>
                            </View>
                            {selectedChart && (
                                <TouchableOpacity
                                    onPress={() => setSelectedChart(null)}
                                    style={{ padding: 4 }}
                                >
                                    <Ionicons name="close-circle" size={22} color={c.textTertiary} />
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* Holding Chips */}
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            style={{ marginTop: Spacing.md }}
                            contentContainerStyle={{ gap: 8 }}
                        >
                            {holdings.map((h) => {
                                const isActive = selectedChart === h.nse_symbol;
                                return (
                                    <TouchableOpacity
                                        key={h.id}
                                        style={[
                                            styles.chipBtn,
                                            {
                                                backgroundColor: isActive ? Colors.brand.secondary : c.surfaceElevated,
                                                borderColor: isActive ? Colors.brand.secondary : c.border,
                                            },
                                        ]}
                                        onPress={() => setSelectedChart(isActive ? null : h.nse_symbol)}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={[
                                            styles.chipText,
                                            { color: isActive ? '#FFFFFF' : c.textSecondary },
                                        ]}>
                                            {h.nse_symbol}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>

                        {/* Chart */}
                        {selectedChart ? (
                            <View style={{ marginTop: Spacing.md }}>
                                <TradingViewChart
                                    symbol={selectedChart}
                                    theme={theme}
                                    height={380}
                                />
                            </View>
                        ) : (
                            <View style={styles.chartPlaceholder}>
                                <Ionicons name="trending-up" size={40} color={c.border} />
                                <Text style={{ color: c.textTertiary, fontSize: FontSize.sm, marginTop: Spacing.sm, textAlign: 'center' }}>
                                    Tap a stock above to view its chart
                                </Text>
                            </View>
                        )}
                    </Card>
                </View>
            )}

            {/* Add Stock Modal */}
            <Modal
                visible={showAdd}
                transparent
                animationType="none"
                onRequestClose={closeModal}
                statusBarTranslucent
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={{ flex: 1 }}
                >
                    {/* Backdrop */}
                    <TouchableWithoutFeedback onPress={closeModal}>
                        <Animated.View
                            style={[
                                styles.modalBackdrop,
                                { opacity: backdropAnim },
                            ]}
                        />
                    </TouchableWithoutFeedback>

                    {/* Sheet */}
                    <Animated.View
                        style={[
                            styles.modalSheet,
                            {
                                backgroundColor: c.surface,
                                transform: [{
                                    translateY: slideAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [600, 0],
                                    }),
                                }],
                            },
                        ]}
                    >
                        {/* Handle bar */}
                        <View style={styles.modalHandle}>
                            <View style={[styles.modalHandleBar, { backgroundColor: c.border }]} />
                        </View>

                        {/* Header */}
                        <View style={styles.modalHeader}>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.modalTitle, { color: c.text }]}>Add Stock</Text>
                                <Text style={[styles.modalSubtitle, { color: c.textTertiary }]}>Search and add to your portfolio</Text>
                            </View>
                            <TouchableOpacity
                                onPress={closeModal}
                                style={[styles.modalCloseBtn, { backgroundColor: c.surfaceElevated }]}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="close" size={18} color={c.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        {/* Search Input */}
                        <View style={styles.modalBody}>
                            <View style={[styles.searchContainer, { backgroundColor: c.inputBg, borderColor: symbol ? Colors.brand.accent : c.inputBorder }]}>
                                <Ionicons name="search" size={18} color={c.textTertiary} />
                                <TextInput
                                    style={[styles.searchTextInput, { color: c.text }]}
                                    placeholder="Search by symbol or name..."
                                    placeholderTextColor={c.textTertiary}
                                    value={symbol ? symbol : searchQuery}
                                    onChangeText={(text) => {
                                        if (symbol) {
                                            setSymbol('');
                                            setSearchQuery(text);
                                        } else {
                                            setSearchQuery(text);
                                        }
                                    }}
                                    autoCapitalize="characters"
                                    autoFocus
                                />
                                {(symbol || searchQuery) ? (
                                    <TouchableOpacity
                                        onPress={() => { setSymbol(''); setSearchQuery(''); }}
                                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                    >
                                        <Ionicons name="close-circle" size={18} color={c.textTertiary} />
                                    </TouchableOpacity>
                                ) : null}
                            </View>

                            {/* Selected stock pill */}
                            {symbol ? (
                                <View style={[styles.selectedPill, { backgroundColor: Colors.brand.secondary + '18', borderColor: Colors.brand.secondary + '40' }]}>
                                    <Ionicons name="checkmark-circle" size={16} color={Colors.brand.secondary} />
                                    <Text style={[styles.selectedPillText, { color: Colors.brand.secondary }]}>{symbol}</Text>
                                </View>
                            ) : null}

                            {/* Search Results */}
                            {!symbol && searchQuery.length > 0 && (
                                <View style={[styles.searchResultsContainer, { borderColor: c.border }]}>
                                    {isSearching ? (
                                        <View style={styles.searchLoading}>
                                            <ActivityIndicator size="small" color={Colors.brand.secondary} />
                                            <Text style={[styles.searchLoadingText, { color: c.textTertiary }]}>Searching...</Text>
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
                                                    onPress={() => {
                                                        setSymbol(item.nse_code);
                                                        setSearchQuery('');
                                                        setSearchResults([]);
                                                    }}
                                                    activeOpacity={0.6}
                                                >
                                                    <View style={[styles.searchResultIcon, { backgroundColor: Colors.brand.secondary + '15' }]}>
                                                        <Ionicons name="trending-up" size={14} color={Colors.brand.secondary} />
                                                    </View>
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={[styles.searchResultSymbol, { color: c.text }]}>{item.nse_code}</Text>
                                                        {item.company_name && (
                                                            <Text style={[styles.searchResultName, { color: c.textTertiary }]} numberOfLines={1}>
                                                                {item.company_name}
                                                            </Text>
                                                        )}
                                                    </View>
                                                    <Ionicons name="add-circle-outline" size={20} color={Colors.brand.secondary} />
                                                </TouchableOpacity>
                                            )}
                                        />
                                    ) : (
                                        <View style={styles.searchEmpty}>
                                            <Ionicons name="search-outline" size={24} color={c.textTertiary} />
                                            <Text style={[styles.searchEmptyText, { color: c.textTertiary }]}>No stocks found for "{searchQuery}"</Text>
                                        </View>
                                    )}
                                </View>
                            )}

                            {/* Qty & Price Row */}
                            <View style={[styles.formRow, { marginTop: Spacing.lg }]}>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.inputLabel, { color: c.textSecondary }]}>Quantity</Text>
                                    <TextInput
                                        style={[styles.modalInput, { backgroundColor: c.inputBg, borderColor: c.inputBorder, color: c.text }]}
                                        placeholder="0"
                                        placeholderTextColor={c.textTertiary}
                                        value={qty}
                                        onChangeText={setQty}
                                        keyboardType="numeric"
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.inputLabel, { color: c.textSecondary }]}>Buy Price (₹)</Text>
                                    <TextInput
                                        style={[styles.modalInput, { backgroundColor: c.inputBg, borderColor: c.inputBorder, color: c.text }]}
                                        placeholder="0.00"
                                        placeholderTextColor={c.textTertiary}
                                        value={buyPrice}
                                        onChangeText={setBuyPrice}
                                        keyboardType="numeric"
                                    />
                                </View>
                            </View>

                            {/* Submit Button */}
                            <TouchableOpacity
                                style={[
                                    styles.modalSubmitBtn,
                                    {
                                        backgroundColor: (symbol && qty && buyPrice) ? Colors.brand.primary : c.surfaceElevated,
                                        opacity: (addMutation.isPending || portfolioLoading) ? 0.6 : 1,
                                    },
                                ]}
                                onPress={() => addMutation.mutate()}
                                disabled={addMutation.isPending || portfolioLoading || !symbol || !qty || !buyPrice}
                                activeOpacity={0.85}
                            >
                                {addMutation.isPending || portfolioLoading ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <Ionicons name="add-circle" size={20} color={(symbol && qty && buyPrice) ? '#fff' : c.textTertiary} />
                                        <Text style={[
                                            styles.modalSubmitText,
                                            { color: (symbol && qty && buyPrice) ? '#fff' : c.textTertiary },
                                        ]}>
                                            Add to Portfolio
                                        </Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        </View>
                    </Animated.View>
                </KeyboardAvoidingView>
            </Modal>

            {/* Holdings */}
            <View style={styles.holdingsSection}>
                {isLoading ? (
                    <ActivityIndicator size="large" color={Colors.brand.secondary} />
                ) : holdings && holdings.length > 0 ? (
                    holdings.map((h) => (
                        <Card key={h.id} theme={theme} style={styles.holdingCard} onPress={() => router.push(`/stock/${h.nse_symbol}` as any)}>
                            <View style={styles.holdingRow}>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.holdingName, { color: c.text }]}>{h.company_name || h.nse_symbol}</Text>
                                    <Text style={[styles.holdingSymbol, { color: c.textTertiary }]}>{h.nse_symbol} · {h.quantity} shares</Text>
                                </View>
                                <View style={styles.holdingRight}>
                                    <Text style={[styles.holdingValue, { color: c.text }]}>
                                        {h.current_value != null ? fmt(h.current_value) : '—'}
                                    </Text>
                                    {h.pnl != null && (
                                        <Text style={[styles.holdingPnl, { color: h.pnl >= 0 ? c.success : c.danger }]}>
                                            {h.pnl >= 0 ? '+' : ''}{h.pnl_pct?.toFixed(1)}%
                                        </Text>
                                    )}
                                </View>
                                <TouchableOpacity
                                    onPress={() => showAlert('Remove?', `Remove ${h.company_name}?`, [
                                        { text: 'Cancel', style: 'cancel' },
                                        { text: 'Remove', style: 'destructive', onPress: () => deleteMutation.mutate(h.id) },
                                    ])}
                                >
                                    <Ionicons name="trash-outline" size={18} color={c.textTertiary} />
                                </TouchableOpacity>
                            </View>
                        </Card>
                    ))
                ) : (
                    <EmptyState icon="pie-chart-outline" title="No Holdings" subtitle="Add stocks to track your investments." theme={theme} />
                )}
            </View>

            <View style={{ height: 40 }} />
        </ResponsiveScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.xl, paddingTop: Platform.select({ ios: 60, web: 20, default: 48 }), paddingBottom: Spacing.lg },
    title: { fontSize: FontSize.xl, fontWeight: '700', letterSpacing: -0.3 },
    subtitle: { fontSize: FontSize.sm, marginTop: 2 },
    addBtn: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    metricsRow: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: Spacing.xl, gap: Spacing.sm, marginBottom: Spacing.xl },
    chartsSection: { paddingHorizontal: Spacing.xl, marginBottom: Spacing.lg },
    chartCard: { padding: Spacing.lg, marginBottom: Spacing.md },
    chartTitle: { fontSize: FontSize.md, fontWeight: '700' },
    chartSubtitle: { fontSize: FontSize.xs, marginTop: 2 },
    formRow: { flexDirection: 'row', gap: Spacing.md },
    holdingsSection: { paddingHorizontal: Spacing.xl },
    holdingCard: { padding: Spacing.lg, marginBottom: Spacing.sm },
    holdingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    holdingName: { fontSize: FontSize.base, fontWeight: '600' },
    holdingSymbol: { fontSize: FontSize.xs, marginTop: 2, fontFamily: 'monospace' },
    holdingRight: { alignItems: 'flex-end', marginRight: Spacing.sm },
    holdingValue: { fontSize: FontSize.base, fontWeight: '700' },
    holdingPnl: { fontSize: FontSize.xs, fontWeight: '600', marginTop: 2 },
    chipBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: BorderRadius.sm, borderWidth: 1 },
    chipText: { fontSize: FontSize.xs, fontWeight: '600' },
    chartPlaceholder: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing['4xl'] },

    // Modal styles
    modalBackdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.55)',
    },
    modalSheet: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingBottom: Platform.OS === 'ios' ? 34 : 24,
        maxHeight: '85%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 25,
        ...(Platform.OS === 'web' ? {
            width: '90%',
            maxWidth: 520,
            alignSelf: 'center',
            left: 'auto',
            right: 'auto',
            borderRadius: 24,
            marginBottom: 24,
        } as any : {}),
    },
    modalHandle: {
        alignItems: 'center',
        paddingTop: 12,
        paddingBottom: 4,
    },
    modalHandleBar: {
        width: 40,
        height: 4,
        borderRadius: 2,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.xl,
        paddingTop: Spacing.md,
        paddingBottom: Spacing.lg,
    },
    modalTitle: {
        fontSize: FontSize.lg,
        fontWeight: '700',
        letterSpacing: -0.3,
    },
    modalSubtitle: {
        fontSize: FontSize.xs,
        marginTop: 2,
    },
    modalCloseBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalBody: {
        paddingHorizontal: Spacing.xl,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1.5,
        borderRadius: BorderRadius.md,
        paddingHorizontal: 14,
        height: 50,
        gap: 10,
    },
    searchTextInput: {
        flex: 1,
        fontSize: FontSize.base,
        height: 50,
    },
    selectedPill: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: BorderRadius.full,
        borderWidth: 1,
        marginTop: Spacing.sm,
    },
    selectedPillText: {
        fontSize: FontSize.sm,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    searchResultsContainer: {
        marginTop: Spacing.sm,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        overflow: 'hidden',
    },
    searchResultItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 14,
        gap: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    searchResultIcon: {
        width: 32,
        height: 32,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    searchResultSymbol: {
        fontSize: FontSize.sm,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    searchResultName: {
        fontSize: FontSize.xs,
        marginTop: 1,
    },
    searchLoading: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: Spacing.lg,
    },
    searchLoadingText: {
        fontSize: FontSize.sm,
    },
    searchEmpty: {
        alignItems: 'center',
        paddingVertical: Spacing.xl,
        gap: 8,
    },
    searchEmptyText: {
        fontSize: FontSize.sm,
        textAlign: 'center',
    },
    inputLabel: {
        fontSize: FontSize.xs,
        fontWeight: '600',
        marginBottom: 6,
        letterSpacing: 0.3,
        textTransform: 'uppercase',
    },
    modalInput: {
        borderWidth: 1,
        borderRadius: BorderRadius.sm,
        paddingHorizontal: 14,
        height: 48,
        fontSize: FontSize.base,
    },
    modalSubmitBtn: {
        height: 52,
        borderRadius: BorderRadius.md,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: Spacing.xl,
    },
    modalSubmitText: {
        fontWeight: '700',
        fontSize: FontSize.base,
    },
});
