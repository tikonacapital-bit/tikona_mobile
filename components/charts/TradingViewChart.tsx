import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, AppState, Platform } from 'react-native';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import type { ThemeMode } from '@/constants/theme';

// Conditionally import WebView only on native
let WebView: any = null;
if (Platform.OS !== 'web') {
    try {
        WebView = require('react-native-webview').WebView;
    } catch { }
}

interface TradingViewChartProps {
    symbol: string;
    theme: ThemeMode;
    height?: number;
}

interface CandleData {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

const INTERVALS = [
    { label: '1D', range: '1d', interval: '5m', refreshMs: 30000 },
    { label: '1W', range: '5d', interval: '15m', refreshMs: 30000 },
    { label: '1M', range: '1mo', interval: '1d', refreshMs: 60000 },
    { label: '3M', range: '3mo', interval: '1d', refreshMs: 60000 },
    { label: '6M', range: '6mo', interval: '1wk', refreshMs: 120000 },
    { label: '1Y', range: '1y', interval: '1wk', refreshMs: 120000 },
];

// CORS proxy for web — Yahoo Finance doesn't send CORS headers
const CORS_PROXY = 'https://corsproxy.io/?url=';

// Check if Indian market is open (Mon-Fri, 9:15 AM - 3:30 PM IST)
function isMarketOpen(): boolean {
    const now = new Date();
    const istOffset = 5.5 * 60;
    const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
    const istMinutes = utcMinutes + istOffset;
    const istHours = Math.floor(istMinutes / 60) % 24;
    const istMins = istMinutes % 60;

    const day = now.getUTCDay();
    const istDay = istHours < (now.getUTCHours()) ? (day + 1) % 7 : day;

    if (istDay === 0 || istDay === 6) return false;
    const timeInMinutes = istHours * 60 + istMins;
    return timeInMinutes >= 9 * 60 + 15 && timeInMinutes <= 15 * 60 + 30;
}

async function fetchChartData(symbol: string, range: string, interval: string): Promise<CandleData[]> {
    const yahooSymbol = `${symbol}.NS`;
    const baseUrls = [
        `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?range=${range}&interval=${interval}&includePrePost=false`,
        `https://query2.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?range=${range}&interval=${interval}&includePrePost=false`,
    ];

    // On web, route through CORS proxy; on native, hit Yahoo directly
    const urls = Platform.OS === 'web'
        ? baseUrls.map(u => CORS_PROXY + encodeURIComponent(u))
        : baseUrls;

    let lastError: Error | null = null;

    for (const url of urls) {
        try {
            const res = await fetch(url, {
                headers: Platform.OS === 'web'
                    ? {}   // CORS proxy handles headers
                    : { 'User-Agent': 'Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36' },
            });

            if (!res.ok) continue;

            const json = await res.json();
            const result = json.chart?.result?.[0];
            if (!result?.timestamp) continue;

            const timestamps = result.timestamp;
            const quote = result.indicators.quote[0];
            const candles: CandleData[] = [];

            for (let i = 0; i < timestamps.length; i++) {
                if (quote.open[i] == null || quote.close[i] == null) continue;
                candles.push({
                    time: timestamps[i],
                    open: quote.open[i],
                    high: quote.high[i],
                    low: quote.low[i],
                    close: quote.close[i],
                    volume: quote.volume[i] || 0,
                });
            }

            if (candles.length > 0) return candles;
        } catch (e: any) {
            lastError = e;
        }
    }

    throw lastError || new Error('Failed to fetch chart data');
}

function buildChartHtml(opts: {
    symbol: string;
    candleJson: string;
    volumeJson: string;
    lastCandle: CandleData;
    priceChange: number;
    pctChange: number;
    bgColor: string;
    textColor: string;
    gridColor: string;
    upColor: string;
    downColor: string;
    borderColor: string;
    crosshairColor: string;
    range: string;
}): string {
    return `<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <script src="https://unpkg.com/lightweight-charts@4.1.3/dist/lightweight-charts.standalone.production.js"><\/script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { width: 100%; height: 100%; overflow: hidden; background: ${opts.bgColor}; font-family: -apple-system, BlinkMacSystemFont, sans-serif; }
        #chart { width: 100%; height: calc(100% - 40px); }
        #info { height: 40px; display: flex; align-items: center; padding: 0 12px; gap: 10px; }
        .symbol { color: ${opts.textColor}; font-size: 13px; font-weight: 700; }
        .price { font-size: 13px; font-weight: 700; }
        .change { font-size: 11px; font-weight: 600; }
        .green { color: ${opts.upColor}; }
        .red { color: ${opts.downColor}; }
    </style>
</head>
<body>
    <div id="info">
        <span class="symbol">${opts.symbol}</span>
        <span class="price ${opts.priceChange >= 0 ? 'green' : 'red'}" id="priceEl">\u20B9${opts.lastCandle.close.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
        <span class="change ${opts.priceChange >= 0 ? 'green' : 'red'}" id="changeEl">${opts.priceChange >= 0 ? '+' : ''}${opts.priceChange.toFixed(2)} (${opts.pctChange.toFixed(2)}%)</span>
    </div>
    <div id="chart"></div>
    <script>
        var candleData = ${opts.candleJson};
        var volumeData = ${opts.volumeJson};

        var container = document.getElementById('chart');
        var chart = LightweightCharts.createChart(container, {
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
                mode: LightweightCharts.CrosshairMode.Normal,
                vertLine: { color: '${opts.crosshairColor}', width: 1, style: 2, labelBackgroundColor: '${opts.crosshairColor}' },
                horzLine: { color: '${opts.crosshairColor}', width: 1, style: 2, labelBackgroundColor: '${opts.crosshairColor}' },
            },
            rightPriceScale: {
                borderColor: '${opts.borderColor}',
                scaleMargins: { top: 0.1, bottom: 0.2 },
            },
            timeScale: {
                borderColor: '${opts.borderColor}',
                timeVisible: ${opts.range === '1d' || opts.range === '5d' ? 'true' : 'false'},
                secondsVisible: false,
            },
            handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
            handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
        });

        var candleSeries = chart.addCandlestickSeries({
            upColor: '${opts.upColor}',
            downColor: '${opts.downColor}',
            borderUpColor: '${opts.upColor}',
            borderDownColor: '${opts.downColor}',
            wickUpColor: '${opts.upColor}',
            wickDownColor: '${opts.downColor}',
        });
        candleSeries.setData(candleData);

        var volumeSeries = chart.addHistogramSeries({
            priceFormat: { type: 'volume' },
            priceScaleId: '',
        });
        volumeSeries.priceScale().applyOptions({
            scaleMargins: { top: 0.85, bottom: 0 },
        });
        volumeSeries.setData(volumeData);

        chart.timeScale().fitContent();

        chart.subscribeCrosshairMove(function(param) {
            if (!param.time || !param.seriesData) return;
            var data = param.seriesData.get(candleSeries);
            if (!data) return;
            var el = document.getElementById('priceEl');
            var chgEl = document.getElementById('changeEl');
            el.textContent = '\u20B9' + data.close.toLocaleString('en-IN', { maximumFractionDigits: 2 });
            var chg = data.close - data.open;
            var pct = (chg / data.open) * 100;
            el.className = 'price ' + (chg >= 0 ? 'green' : 'red');
            chgEl.textContent = (chg >= 0 ? '+' : '') + chg.toFixed(2) + ' (' + pct.toFixed(2) + '%)';
            chgEl.className = 'change ' + (chg >= 0 ? 'green' : 'red');
        });

        new ResizeObserver(function(entries) {
            var rect = entries[0].contentRect;
            chart.applyOptions({ width: rect.width, height: rect.height });
        }).observe(container);
    <\/script>
</body>
</html>`;
}

/* ─── Main Export ─── */
export default function TradingViewChart({
    symbol,
    theme,
    height = 400,
}: TradingViewChartProps) {
    const c = Colors[theme];
    const [activeIdx, setActiveIdx] = useState(2);
    const [chartData, setChartData] = useState<CandleData[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [marketOpen, setMarketOpen] = useState(isMarketOpen());
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const { range, interval, refreshMs } = INTERVALS[activeIdx];
    const bgColor = theme === 'dark' ? '#0C0F14' : '#FFFFFF';
    const textColor = theme === 'dark' ? '#F0F1F3' : '#111827';
    const gridColor = theme === 'dark' ? '#1F2937' : '#F3F4F6';
    const upColor = theme === 'dark' ? '#34D399' : '#059669';
    const downColor = theme === 'dark' ? '#F87171' : '#DC2626';
    const borderColor = theme === 'dark' ? '#1F2937' : '#E5E7EB';
    const crosshairColor = theme === 'dark' ? '#9CA3AF' : '#6B7280';

    const loadData = useCallback(async (showLoading = false) => {
        if (showLoading) setLoading(true);
        setError(null);

        try {
            const data = await fetchChartData(symbol, range, interval);
            setChartData(data);
            setLastUpdated(new Date());
        } catch (err: any) {
            if (showLoading) setError(err.message || 'Failed to load');
        } finally {
            if (showLoading) setLoading(false);
        }
    }, [symbol, range, interval]);

    // Initial fetch + auto-refresh
    useEffect(() => {
        loadData(true);

        const startPolling = () => {
            if (timerRef.current) clearInterval(timerRef.current);
            timerRef.current = setInterval(() => {
                const open = isMarketOpen();
                setMarketOpen(open);
                if (open) loadData(false);
            }, refreshMs);
        };

        startPolling();

        // Only listen to AppState on native
        let sub: any = null;
        if (Platform.OS !== 'web') {
            sub = AppState.addEventListener('change', (state) => {
                if (state === 'active') {
                    setMarketOpen(isMarketOpen());
                    loadData(false);
                    startPolling();
                } else {
                    if (timerRef.current) clearInterval(timerRef.current);
                }
            });
        }

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            if (sub) sub.remove();
        };
    }, [loadData, refreshMs]);

    const renderIntervalSelector = () => (
        <View style={styles.intervalRow}>
            {INTERVALS.map((item, idx) => {
                const isActive = activeIdx === idx;
                return (
                    <TouchableOpacity
                        key={item.label}
                        style={[styles.intervalBtn, { backgroundColor: isActive ? Colors.brand.secondary : c.surfaceElevated, borderColor: isActive ? Colors.brand.secondary : c.border }]}
                        onPress={() => setActiveIdx(idx)}
                        activeOpacity={0.7}
                    >
                        <Text style={[styles.intervalText, { color: isActive ? '#FFFFFF' : c.textSecondary }]}>{item.label}</Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );

    if (loading) {
        return (
            <View style={[styles.container, { height: height / 2 }]}>
                {renderIntervalSelector()}
                <View style={[styles.loadingContainer, { backgroundColor: bgColor, borderColor: c.border }]}>
                    <ActivityIndicator size="large" color={Colors.brand.secondary} />
                    <Text style={[styles.loadingText, { color: c.textSecondary }]}>Loading {symbol}...</Text>
                </View>
            </View>
        );
    }

    if (error || !chartData) {
        return (
            <View style={styles.container}>
                {renderIntervalSelector()}
                <View style={[styles.errorContainer, { borderColor: c.border }]}>
                    <Text style={{ color: c.textTertiary, fontSize: FontSize.sm, textAlign: 'center' }}>
                        {error || 'No data available'}
                    </Text>
                    <TouchableOpacity
                        style={[styles.retryBtn, { backgroundColor: Colors.brand.secondary }]}
                        onPress={() => loadData(true)}
                    >
                        <Text style={{ color: '#fff', fontSize: FontSize.xs, fontWeight: '600' }}>Retry</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    // Prepare data for chart HTML
    const candleJson = JSON.stringify(chartData.map(d => ({
        time: d.time, open: d.open, high: d.high, low: d.low, close: d.close,
    })));

    const volumeJson = JSON.stringify(chartData.map(d => ({
        time: d.time, value: d.volume,
        color: d.close >= d.open ? `${upColor}30` : `${downColor}30`,
    })));

    const lastCandle = chartData[chartData.length - 1];
    const firstCandle = chartData[0];
    const priceChange = lastCandle.close - firstCandle.open;
    const pctChange = (priceChange / firstCandle.open) * 100;

    const chartHtml = buildChartHtml({
        symbol, candleJson, volumeJson, lastCandle,
        priceChange, pctChange,
        bgColor, textColor, gridColor, upColor, downColor, borderColor, crosshairColor,
        range,
    });

    const lastUpdateStr = lastUpdated
        ? lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        : '';

    return (
        <View style={styles.container}>
            {/* Interval Selector + Status */}
            <View style={styles.topRow}>
                {renderIntervalSelector()}
                <View style={styles.statusRow}>
                    <View style={styles.liveIndicator}>
                        <View style={[styles.liveDot, { backgroundColor: marketOpen ? '#34D399' : '#6B7280' }]} />
                        <Text style={[styles.liveText, { color: marketOpen ? '#34D399' : c.textTertiary }]}>
                            {marketOpen ? 'LIVE' : 'CLOSED'}
                        </Text>
                    </View>
                    {lastUpdateStr ? (
                        <Text style={[styles.updatedText, { color: c.textTertiary }]}>{lastUpdateStr}</Text>
                    ) : null}
                    <TouchableOpacity onPress={() => loadData(false)} style={styles.refreshBtn} activeOpacity={0.7}>
                        <Text style={{ color: Colors.brand.secondary, fontSize: 14 }}>⟳</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Chart */}
            <View style={[styles.chartWrapper, { height, borderColor: c.border }]}>
                {Platform.OS === 'web' ? (
                    // Web: render lightweight-charts HTML in an iframe via srcDoc
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
                    // Native: render in WebView
                    <WebView
                        key={`${symbol}-${range}-${interval}-${chartData.length}`}
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
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: Spacing.lg,
    },
    intervalRow: {
        flexDirection: 'row',
        gap: 6,
        marginBottom: Spacing.sm,
        flexWrap: 'wrap',
    },
    intervalBtn: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: BorderRadius.sm,
        borderWidth: 1,
    },
    intervalText: {
        fontSize: FontSize.xs,
        fontWeight: '600',
    },
    chartWrapper: {
        borderRadius: BorderRadius.md,
        overflow: 'hidden',
        borderWidth: 1,
    },
    loadingContainer: {
        flex: 1,
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
    topRow: {
        marginBottom: Spacing.sm,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 6,
    },
    liveIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    liveDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    liveText: {
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    updatedText: {
        fontSize: 10,
    },
    refreshBtn: {
        padding: 4,
    },
});
