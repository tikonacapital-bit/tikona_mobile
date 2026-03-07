import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, TextInput, ScrollView, Keyboard, Platform } from 'react-native';
import { Colors, Spacing, BorderRadius, FontSize, ThemeMode } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';

// Conditionally import WebView only on native
let WebView: any = null;
if (Platform.OS !== 'web') {
    try {
        WebView = require('react-native-webview').WebView;
    } catch { }
}

interface ComparisonChartProps {
    symbol: string;
    theme: ThemeMode;
    height?: number;
}

interface SeriesData {
    key: string;        // unique id e.g. 'RELIANCE.NS', '^NSEI'
    label: string;      // display name
    color: string;
    data: { time: string; value: number }[];
    removable: boolean;
}

const PALETTE = [
    '#3B82F6', // blue (main stock - always index 0)
    '#F59E0B', // amber
    '#8B5CF6', // purple
    '#EF4444', // red
    '#10B981', // green
    '#EC4899', // pink
    '#06B6D4', // cyan
    '#F97316', // orange
];

const RANGES = [
    { label: '1M', range: '1mo', interval: '1d' },
    { label: '3M', range: '3mo', interval: '1d' },
    { label: '6M', range: '6mo', interval: '1wk' },
    { label: '1Y', range: '1y', interval: '1wk' },
    { label: '3Y', range: '3y', interval: '1mo' },
];

// Popular peers by broad sector
const POPULAR_PEERS: Record<string, string[]> = {
    DEFAULT: ['NIFTY 50', 'SENSEX'],
};

// Quick add suggestions (always available)
const QUICK_ADD = [
    { symbol: '^NSEI', label: 'Nifty 50' },
    { symbol: '^BSESN', label: 'Sensex' },
    { symbol: 'NIFTYIT.NS', label: 'Nifty IT' },
    { symbol: 'NIFTY_FIN_SERVICE.NS', label: 'Nifty Fin' },
];

// CORS proxy for web — Yahoo Finance doesn't send CORS headers
const CORS_PROXY = 'https://corsproxy.io/?url=';

async function fetchChartData(
    yahooSymbol: string,
    range: string,
    interval: string
): Promise<{ time: number; close: number }[]> {
    const baseUrls = [
        `https://query2.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=${interval}&range=${range}&includePrePost=false`,
        `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=${interval}&range=${range}&includePrePost=false`,
    ];

    // On web, route through CORS proxy; on native, hit Yahoo directly
    const urls = Platform.OS === 'web'
        ? baseUrls.map(u => CORS_PROXY + encodeURIComponent(u))
        : baseUrls;

    for (const url of urls) {
        try {
            const res = await fetch(url, {
                headers: Platform.OS === 'web'
                    ? {}
                    : { 'User-Agent': 'Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36' },
            });
            if (!res.ok) continue;
            const json = await res.json();
            const result = json.chart?.result?.[0];
            if (!result) continue;

            const timestamps = result.timestamp || [];
            const closes = result.indicators?.quote?.[0]?.close || [];

            const data: { time: number; close: number }[] = [];
            for (let i = 0; i < timestamps.length; i++) {
                if (closes[i] != null) {
                    data.push({ time: timestamps[i], close: closes[i] });
                }
            }
            return data;
        } catch { /* try next */ }
    }
    return [];
}

function normalizeToPercent(data: { time: number; close: number }[]): { time: string; value: number }[] {
    if (data.length === 0) return [];
    const basePrice = data[0].close;
    return data.map(d => ({
        time: new Date(d.time * 1000).toISOString().split('T')[0],
        value: ((d.close - basePrice) / basePrice) * 100,
    }));
}

function buildComparisonHtml(opts: {
    seriesData: { label: string; color: string; data: { time: string; value: number }[] }[];
    bgColor: string;
    gridColor: string;
    crosshairColor: string;
}): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <script src="https://unpkg.com/lightweight-charts@4.1.3/dist/lightweight-charts.standalone.production.js"><\/script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { width: 100%; height: 100%; overflow: hidden; background: ${opts.bgColor}; font-family: -apple-system, sans-serif; }
        #chart { width: 100%; height: calc(100% - 28px); }
        #info { height: 28px; display: flex; align-items: center; padding: 0 8px; gap: 10px; overflow-x: auto; }
        .val { font-size: 10px; font-weight: 600; white-space: nowrap; }
    </style>
</head>
<body>
    <div id="info"></div>
    <div id="chart"></div>
    <script>
        const seriesData = ${JSON.stringify(opts.seriesData)};

        const container = document.getElementById('chart');
        const chart = LightweightCharts.createChart(container, {
            width: container.offsetWidth,
            height: container.offsetHeight,
            layout: {
                background: { type: 'solid', color: '${opts.bgColor}' },
                textColor: '${opts.crosshairColor}',
                fontSize: 10,
            },
            grid: {
                vertLines: { color: '${opts.gridColor}' },
                horzLines: { color: '${opts.gridColor}' },
            },
            crosshair: {
                mode: LightweightCharts.CrosshairMode.Magnet,
                vertLine: { color: '${opts.crosshairColor}', width: 1, style: 2 },
                horzLine: { color: '${opts.crosshairColor}', width: 1, style: 2 },
            },
            rightPriceScale: {
                borderColor: '${opts.gridColor}',
                scaleMargins: { top: 0.1, bottom: 0.1 },
            },
            timeScale: { borderColor: '${opts.gridColor}' },
            handleScroll: { vertTouchDrag: false },
        });

        const zeroLine = {
            price: 0, color: '${opts.crosshairColor}', lineWidth: 1,
            lineStyle: LightweightCharts.LineStyle.Dashed, axisLabelVisible: true, title: '0%',
        };

        const infoEl = document.getElementById('info');
        const lineArr = [];

        seriesData.forEach((s, idx) => {
            const ls = chart.addLineSeries({
                color: s.color,
                lineWidth: idx === 0 ? 2.5 : 1.5,
                priceFormat: { type: 'custom', formatter: (p) => p.toFixed(1) + '%' },
                crosshairMarkerVisible: true,
                crosshairMarkerRadius: 3,
            });
            ls.setData(s.data);
            if (idx === 0) ls.createPriceLine(zeroLine);
            lineArr.push({ series: ls, label: s.label, color: s.color });

            const last = s.data[s.data.length - 1];
            const val = last ? last.value : 0;
            const span = document.createElement('span');
            span.className = 'val';
            span.style.color = s.color;
            span.id = 'lbl-' + idx;
            span.textContent = s.label + ' ' + (val >= 0 ? '+' : '') + val.toFixed(1) + '%';
            infoEl.appendChild(span);
        });

        chart.subscribeCrosshairMove((param) => {
            lineArr.forEach((item, idx) => {
                const el = document.getElementById('lbl-' + idx);
                if (!el) return;
                const data = param.seriesData.get(item.series);
                if (data) {
                    el.textContent = item.label + ' ' + (data.value >= 0 ? '+' : '') + data.value.toFixed(1) + '%';
                }
            });
        });

        chart.timeScale().fitContent();
        window.addEventListener('resize', () => {
            chart.applyOptions({ width: container.offsetWidth, height: container.offsetHeight });
        });
    <\/script>
</body>
</html>`;
}

export function ComparisonChart({ symbol, theme, height = 300 }: ComparisonChartProps) {
    const c = Colors[theme];

    // Comparison items: [{key, label}]
    const [compareItems, setCompareItems] = useState<{ key: string; label: string }[]>([
        { key: '^NSEI', label: 'Nifty 50' },
    ]);
    const [rangeIdx, setRangeIdx] = useState(2); // 6M default
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [allSeries, setAllSeries] = useState<SeriesData[]>([]);
    const [showAdd, setShowAdd] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [addingSymbol, setAddingSymbol] = useState<string | null>(null);
    const inputRef = useRef<TextInput>(null);

    const { range, interval } = RANGES[rangeIdx];

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const mainSymbol = `${symbol}.NS`;
            const allSymbols = [mainSymbol, ...compareItems.map(i => i.key)];

            const results = await Promise.all(
                allSymbols.map(s => fetchChartData(s, range, interval))
            );

            if (results[0].length === 0) {
                setError('No data available');
                setLoading(false);
                return;
            }

            const series: SeriesData[] = [
                {
                    key: mainSymbol,
                    label: symbol,
                    color: PALETTE[0],
                    data: normalizeToPercent(results[0]),
                    removable: false,
                },
                ...compareItems.map((item, i) => ({
                    key: item.key,
                    label: item.label,
                    color: PALETTE[(i + 1) % PALETTE.length],
                    data: normalizeToPercent(results[i + 1]),
                    removable: true,
                })),
            ];

            setAllSeries(series);
        } catch (e: any) {
            setError(e.message || 'Failed to load');
        } finally {
            setLoading(false);
        }
    }, [symbol, range, interval, compareItems]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const addStock = async (yahooKey: string, label: string) => {
        // Don't add duplicates
        if (compareItems.some(i => i.key === yahooKey)) return;
        if (`${symbol}.NS` === yahooKey) return;

        setAddingSymbol(yahooKey);

        // Verify data exists
        const data = await fetchChartData(yahooKey, range, interval);
        if (data.length === 0) {
            setAddingSymbol(null);
            return;
        }

        setCompareItems(prev => [...prev, { key: yahooKey, label }]);
        setShowAdd(false);
        setSearchText('');
        setAddingSymbol(null);
        if (Platform.OS !== 'web') Keyboard.dismiss();
    };

    const removeStock = (key: string) => {
        setCompareItems(prev => prev.filter(i => i.key !== key));
    };

    const handleSearchAdd = () => {
        const text = searchText.trim().toUpperCase();
        if (!text) return;
        // Treat as NSE stock symbol
        const yahooKey = `${text}.NS`;
        addStock(yahooKey, text);
    };

    const getReturn = (s: SeriesData): string => {
        if (s.data.length === 0) return '—';
        const last = s.data[s.data.length - 1].value;
        return `${last >= 0 ? '+' : ''}${last.toFixed(1)}%`;
    };

    const bgColor = theme === 'dark' ? '#0D1117' : '#FFFFFF';
    const gridColor = theme === 'dark' ? '#21262D' : '#F0F0F0';
    const crosshairColor = theme === 'dark' ? '#484F58' : '#9CA3AF';

    // Filter quick-add to exclude already-added
    const availableQuickAdd = QUICK_ADD.filter(
        q => !compareItems.some(i => i.key === q.symbol) && `${symbol}.NS` !== q.symbol
    );

    const seriesForHtml = allSeries.map(s => ({
        label: s.label,
        color: s.color,
        data: s.data,
    }));

    const chartHtml = allSeries.length > 0
        ? buildComparisonHtml({ seriesData: seriesForHtml, bgColor, gridColor, crosshairColor })
        : '';

    return (
        <View style={styles.container}>
            {/* Top bar: Range + Add button */}
            <View style={styles.topBar}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.rangeScroll} contentContainerStyle={styles.rangeRow}>
                    {RANGES.map((item, idx) => {
                        const isActive = rangeIdx === idx;
                        return (
                            <TouchableOpacity
                                key={item.label}
                                style={[
                                    styles.rangeBtn,
                                    {
                                        backgroundColor: isActive ? Colors.brand.secondary : c.surfaceElevated,
                                        borderColor: isActive ? Colors.brand.secondary : c.border,
                                    },
                                ]}
                                onPress={() => setRangeIdx(idx)}
                                activeOpacity={0.7}
                            >
                                <Text style={[styles.rangeText, { color: isActive ? '#FFF' : c.textSecondary }]}>
                                    {item.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
                <TouchableOpacity
                    style={[styles.addBtn, { backgroundColor: Colors.brand.secondary + '20', borderColor: Colors.brand.secondary }]}
                    onPress={() => { setShowAdd(!showAdd); setTimeout(() => inputRef.current?.focus(), 100); }}
                    activeOpacity={0.7}
                >
                    <Ionicons name={showAdd ? 'close' : 'add'} size={16} color={Colors.brand.secondary} />
                    <Text style={{ fontSize: 11, fontWeight: '600', color: Colors.brand.secondary }}>
                        {showAdd ? 'Close' : 'Add'}
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Add stock panel */}
            {showAdd && (
                <View style={[styles.addPanel, { backgroundColor: c.surfaceElevated, borderColor: c.border }]}>
                    {/* Search input */}
                    <View style={[styles.searchRow, { borderColor: c.border }]}>
                        <Ionicons name="search" size={14} color={c.textTertiary} />
                        <TextInput
                            ref={inputRef}
                            style={[styles.searchInput, { color: c.text }]}
                            placeholder="Type stock symbol (e.g. INFY)"
                            placeholderTextColor={c.textTertiary}
                            value={searchText}
                            onChangeText={setSearchText}
                            autoCapitalize="characters"
                            returnKeyType="go"
                            onSubmitEditing={handleSearchAdd}
                        />
                        {searchText.length > 0 && (
                            <TouchableOpacity onPress={handleSearchAdd} style={[styles.goBtn, { backgroundColor: Colors.brand.secondary }]}>
                                <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '700' }}>Add</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                    {/* Quick add suggestions */}
                    {availableQuickAdd.length > 0 && (
                        <View style={styles.quickRow}>
                            <Text style={{ fontSize: 10, color: c.textTertiary, marginRight: 4 }}>Quick:</Text>
                            {availableQuickAdd.map(q => (
                                <TouchableOpacity
                                    key={q.symbol}
                                    style={[styles.quickChip, { borderColor: c.border }]}
                                    onPress={() => addStock(q.symbol, q.label)}
                                    disabled={addingSymbol === q.symbol}
                                >
                                    {addingSymbol === q.symbol ? (
                                        <ActivityIndicator size="small" color={Colors.brand.secondary} style={{ width: 12, height: 12 }} />
                                    ) : (
                                        <Ionicons name="add" size={10} color={Colors.brand.secondary} />
                                    )}
                                    <Text style={{ fontSize: 10, color: c.textSecondary }}>{q.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                </View>
            )}

            {/* Legend chips (scrollable) */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.legendScroll} contentContainerStyle={styles.legendRow}>
                {allSeries.map((s) => (
                    <View
                        key={s.key}
                        style={[styles.legendChip, { backgroundColor: s.color + '15', borderColor: s.color + '40' }]}
                    >
                        <View style={[styles.legendDot, { backgroundColor: s.color }]} />
                        <Text style={[styles.legendLabel, { color: s.color }]}>{s.label}</Text>
                        <Text style={[styles.legendReturn, { color: s.data[s.data.length - 1]?.value >= 0 ? c.success : c.danger }]}>
                            {getReturn(s)}
                        </Text>
                        {s.removable && (
                            <TouchableOpacity onPress={() => removeStock(s.key)} hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}>
                                <Ionicons name="close-circle" size={14} color={s.color + '80'} />
                            </TouchableOpacity>
                        )}
                    </View>
                ))}
            </ScrollView>

            {/* Chart */}
            {loading ? (
                <View style={[styles.loadingContainer, { borderColor: c.border, height }]}>
                    <ActivityIndicator size="small" color={Colors.brand.secondary} />
                    <Text style={[styles.loadingText, { color: c.textTertiary }]}>Loading...</Text>
                </View>
            ) : error ? (
                <View style={[styles.errorContainer, { borderColor: c.border }]}>
                    <Text style={{ color: c.textTertiary, fontSize: FontSize.sm }}>{error}</Text>
                    <TouchableOpacity style={[styles.retryBtn, { backgroundColor: Colors.brand.secondary }]} onPress={loadData}>
                        <Text style={{ color: '#fff', fontSize: FontSize.xs, fontWeight: '600' }}>Retry</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <View style={[styles.chartWrapper, { height, borderColor: c.border }]}>
                    {Platform.OS === 'web' ? (
                        <iframe
                            srcDoc={chartHtml}
                            style={{
                                width: '100%',
                                height: '100%',
                                border: 'none',
                                backgroundColor: bgColor,
                                borderRadius: 10,
                            } as any}
                        />
                    ) : WebView ? (
                        <WebView
                            key={`comp-${symbol}-${range}-${allSeries.map(s => s.key).join(',')}`}
                            source={{ html: chartHtml }}
                            style={{ flex: 1, backgroundColor: bgColor }}
                            javaScriptEnabled
                            domStorageEnabled
                            scrollEnabled={false}
                            bounces={false}
                            originWhitelist={['*']}
                            mixedContentMode="always"
                        />
                    ) : (
                        <View style={[styles.loadingContainer, { borderColor: c.border }]}>
                            <Text style={{ color: c.textTertiary }}>Chart unavailable</Text>
                        </View>
                    )}
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: Spacing.xl,
    },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
        gap: 8,
    },
    rangeScroll: {
        flex: 1,
    },
    rangeRow: {
        flexDirection: 'row',
        gap: 5,
    },
    rangeBtn: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: BorderRadius.sm,
        borderWidth: 1,
    },
    rangeText: {
        fontSize: FontSize.xs,
        fontWeight: '600',
    },
    addBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: BorderRadius.sm,
        borderWidth: 1,
    },
    // Add panel
    addPanel: {
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        padding: 8,
        marginBottom: 6,
    },
    searchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        borderWidth: 1,
        borderRadius: BorderRadius.sm,
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    searchInput: {
        flex: 1,
        fontSize: 13,
        paddingVertical: 2,
        fontWeight: '500',
    },
    goBtn: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 4,
    },
    quickRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 4,
        marginTop: 6,
    },
    quickChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 4,
        borderWidth: 1,
    },
    // Legend
    legendScroll: {
        marginBottom: 6,
    },
    legendRow: {
        flexDirection: 'row',
        gap: 6,
        paddingRight: 8,
    },
    legendChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        borderWidth: 1,
    },
    legendDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    legendLabel: {
        fontSize: 10,
        fontWeight: '600',
    },
    legendReturn: {
        fontSize: 10,
        fontWeight: '700',
    },
    // Chart
    chartWrapper: {
        borderRadius: BorderRadius.md,
        overflow: 'hidden',
        borderWidth: 1,
    },
    loadingContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        minHeight: 200,
    },
    loadingText: {
        fontSize: FontSize.xs,
        marginTop: Spacing.sm,
    },
    errorContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        paddingVertical: Spacing['3xl'],
        gap: Spacing.md,
    },
    retryBtn: {
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderRadius: BorderRadius.sm,
    },
});
