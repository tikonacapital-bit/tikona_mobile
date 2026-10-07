import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';

// Two sentences, each its own block: the market-risk warning on top, the SEBI/NISM note directly below.
const RISK_WARNING =
    'Investment in the securities market is subject to market risks. Read all the related documents carefully before investing.';
const REGISTRATION_NOTE =
    'Registration granted by SEBI, and certification from NISM in no way guarantee performance of the intermediary or provide any assurance of returns to investors.';

// Web only: wraps long lines into evenly sized rows instead of leaving a lone word on the last line.
const balanced = Platform.OS === 'web' ? ({ textWrap: 'balance' } as any) : null;

/**
 * Market-risk disclaimer: centered two-sentence text plus a "Regulatory & Compliance" link that opens the
 * full documents list. Sits directly on the page background (no panel). `compact` is the phone version.
 */
export function RegulatoryFooter({ compact = false }: { compact?: boolean }) {
    const isDark = useColorScheme() === 'dark';
    const { width: winW } = useWindowDimensions();
    // Desktop: text spans the card's full width (860, or the window minus page padding). Size the type so each
    // sentence fits on its own line (regular-weight second sentence is ~160 chars ≈ 75 × font-size px wide); never below 11px.
    const textW = Math.min(860, winW - 48);
    const textSize = Math.max(11, Math.min(12.5, Math.floor((textW / 75) * 10) / 10));
    const textColor = isDark ? '#F3F4F6' : '#1F2A44';
    const linkColor = isDark ? '#7B9FD4' : '#1F4690';
    return (
        <View style={compact ? styles.wrapCompact : styles.wrap}>
            <Text style={[compact ? styles.warningCompact : [styles.line, { fontSize: textSize, lineHeight: Math.round(textSize * 1.6) }], { color: textColor }, balanced]}>
                {RISK_WARNING}
            </Text>
            <Text style={[compact ? styles.noteCompact : [styles.line, { fontSize: textSize, lineHeight: Math.round(textSize * 1.6), marginTop: 4 }], { color: textColor }, balanced]}>
                {REGISTRATION_NOTE}
            </Text>
            <TouchableOpacity onPress={() => router.push('/regulatory')} activeOpacity={0.7} style={styles.linkRow}>
                <Text style={[styles.link, { color: linkColor }, compact && { fontSize: 14 }]}>Regulatory & Compliance</Text>
                <Ionicons name="arrow-forward" size={compact ? 14 : 16} color={linkColor} />
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    // Desktop: same width (860) as the onboarding card above it, so the text lines up with the card
    wrap: { width: 860, maxWidth: '100%', alignSelf: 'center', alignItems: 'center', marginTop: 22 },
    // Both sentences share one style: same size, regular weight, same color
    line: { fontWeight: '400', textAlign: 'center', width: '100%' },

    // Phone
    wrapCompact: { width: '100%', alignItems: 'center' },
    warningCompact: { fontSize: 12, lineHeight: 17, fontWeight: '400', textAlign: 'center' },
    noteCompact: { fontSize: 12, lineHeight: 17, fontWeight: '400', textAlign: 'center', marginTop: 6 },

    linkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, paddingVertical: 4 },
    link: { fontSize: 16, fontWeight: '700', textDecorationLine: 'underline' },
});
