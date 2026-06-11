import React from 'react';
import { View, Platform, StyleSheet } from 'react-native';
import { BorderRadius } from '@/constants/theme';
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
    range?: '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | '2Y' | '3Y' | '5Y' | '10Y';
}

export default function TradingViewChart({ symbol, theme, height = 400, range = '1Y' }: TradingViewChartProps) {
    const tvTheme = theme === 'dark' ? 'dark' : 'light';
    const tvSymbol = `NSE:${symbol}`;

    let timeframeParam = '12M';
    let intervalParam = 'D';

    if (range === '1D') {
        timeframeParam = '1D';
        intervalParam = '5';
    } else if (range === '1W') {
        timeframeParam = '5D';
        intervalParam = '30';
    } else if (range === '1M') {
        timeframeParam = '1M';
        intervalParam = 'D';
    } else if (range === '3M') {
        timeframeParam = '3M';
        intervalParam = 'D';
    } else if (range === '6M') {
        timeframeParam = '6M';
        intervalParam = 'D';
    } else if (range === '1Y') {
        timeframeParam = '12M';
        intervalParam = 'D';
    } else if (range === '2Y') {
        timeframeParam = '24M';
        intervalParam = 'D';
    } else if (range === '3Y') {
        timeframeParam = '36M';
        intervalParam = 'D';
    } else if (range === '5Y') {
        timeframeParam = '60M';
        intervalParam = 'D';
    } else if (range === '10Y') {
        timeframeParam = 'all';
        intervalParam = 'W';
    }

    const src = `https://s.tradingview.com/widgetembed/?symbol=${encodeURIComponent(tvSymbol)}&interval=${intervalParam}&theme=${tvTheme}&style=3&locale=en&timezone=Asia%2FKolkata&withdateranges=0&hidesidetoolbar=1&hidetoptoolbar=1&hidelegend=1&saveimage=0&timeframe=${timeframeParam}`;

    return (
        <View style={[styles.wrapper, { height }]}>
            {Platform.OS === 'web' ? (
                <iframe
                    src={src}
                    style={{ width: '100%', height: '100%', border: 'none' } as any}
                />
            ) : WebView ? (
                <WebView
                    source={{ uri: src }}
                    style={styles.webview}
                    javaScriptEnabled
                    domStorageEnabled
                    scrollEnabled={false}
                    bounces={false}
                    originWhitelist={['*']}
                />
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        borderRadius: BorderRadius.md,
        overflow: 'hidden',
    },
    webview: {
        flex: 1,
    },
});
