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
}

export default function TradingViewChart({ symbol, theme, height = 400 }: TradingViewChartProps) {
    const tvTheme = theme === 'dark' ? 'dark' : 'light';
    const tvSymbol = `NSE:${symbol}`;
    const src = `https://s.tradingview.com/widgetembed/?symbol=${encodeURIComponent(tvSymbol)}&interval=D&theme=${tvTheme}&style=1&locale=en&timezone=Asia%2FKolkata&withdateranges=1&hidesidetoolbar=1&saveimage=0`;

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
