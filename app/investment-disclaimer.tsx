import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { ResponsiveScrollView } from '@/components/ui';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DISCLAIMER_KEY = 'tikona_disclaimer_accepted';

/**
 * InvestmentDisclaimerScreen
 *
 * Mandatory first-time disclaimer acceptance flow required by Google Play
 * for financial services apps. Users must scroll through and explicitly
 * accept the investment risk disclaimer before accessing research content.
 *
 * This addresses the "Financial Services" policy requirement where apps
 * providing investment recommendations must clearly disclaim risks.
 */
export default function InvestmentDisclaimerScreen() {
    const theme = useColorScheme();
    const c = Colors[theme];
    const isDark = theme === 'dark';
    const [hasScrolledToEnd, setHasScrolledToEnd] = useState(false);

    const handleAccept = useCallback(async () => {
        try {
            await AsyncStorage.setItem(DISCLAIMER_KEY, new Date().toISOString());
        } catch (e) {
            // Fail silently — worst case they'll see it again
        }
        router.replace('/(tabs)');
    }, []);

    const handleDecline = useCallback(() => {
        router.back();
    }, []);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
            <LinearGradient
                colors={isDark ? ['#0f172a', '#1e293b'] : [Colors.brand.primary, '#1e3a8a']}
                style={styles.header}
            >
                <View style={styles.headerIcon}>
                    <Ionicons name="shield-checkmark" size={32} color="#fff" />
                </View>
                <Text style={styles.headerTitle}>Investment Risk Disclosure</Text>
                <Text style={styles.headerSubtitle}>Please read carefully before proceeding</Text>
            </LinearGradient>

            <ResponsiveScrollView
                contentContainerStyle={styles.content}
                onScroll={({ nativeEvent }) => {
                    const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
                    const isNearBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 100;
                    if (isNearBottom && !hasScrolledToEnd) {
                        setHasScrolledToEnd(true);
                    }
                }}
                scrollEventThrottle={400}
            >
                <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
                    {/* SEBI Badge */}
                    <View style={[styles.sebiBadge, { backgroundColor: isDark ? 'rgba(31,70,144,0.15)' : 'rgba(31,70,144,0.06)', borderColor: Colors.brand.primary + '25' }]}>
                        <Ionicons name="ribbon" size={16} color={Colors.brand.primary} />
                        <View>
                            <Text style={[styles.sebiBadgeTitle, { color: c.text }]}>SEBI Registered Research Analyst</Text>
                            <Text style={[styles.sebiBadgeReg, { color: c.textTertiary }]}>Reg. No: INH000009807 · BSE: 5595</Text>
                        </View>
                    </View>

                    {/* Disclaimer Content */}
                    <View style={styles.section}>
                        <View style={[styles.warningBox, { backgroundColor: isDark ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.05)', borderColor: '#ef4444' + '25' }]}>
                            <Ionicons name="warning" size={20} color="#ef4444" />
                            <Text style={[styles.warningText, { color: isDark ? '#fca5a5' : '#dc2626' }]}>
                                Investment in securities market is subject to market risks. Read all the related documents carefully before investing.
                            </Text>
                        </View>
                    </View>

                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, { color: c.text }]}>Nature of Service</Text>
                        <Text style={[styles.sectionBody, { color: c.textSecondary }]}>
                            Tikona Capital provides equity research reports and analysis prepared by SEBI-registered research analysts. Our reports contain general research opinions and are intended for informational and educational purposes only.
                        </Text>
                    </View>

                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, { color: c.text }]}>Not Investment Advice</Text>
                        <Text style={[styles.sectionBody, { color: c.textSecondary }]}>
                            The information, analysis, and recommendations provided through this App do NOT constitute personalized investment advice, an offer to buy or sell securities, or a solicitation of any transaction. The research reports are general in nature and do not take into account your individual financial situation, investment objectives, or risk tolerance.
                        </Text>
                    </View>

                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, { color: c.text }]}>Risk Factors</Text>
                        <Text style={[styles.sectionBody, { color: c.textSecondary }]}>
                            You acknowledge and understand the following risks:
                        </Text>
                        <View style={styles.riskList}>
                            {[
                                'Past performance of any security or investment strategy does not guarantee future results.',
                                'Stock prices and market conditions can be volatile and unpredictable.',
                                'You may lose part or all of your invested capital.',
                                'Small-cap and SME stocks carry higher risk due to lower liquidity and higher volatility.',
                                'AI-generated insights are for informational purposes and should not be solely relied upon for investment decisions.',
                                'Target prices mentioned in reports are estimates and may not be achieved.',
                            ].map((risk, i) => (
                                <View key={i} style={styles.riskItem}>
                                    <Ionicons name="alert-circle" size={14} color={Colors.brand.secondary} style={{ marginTop: 3 }} />
                                    <Text style={[styles.riskText, { color: c.textSecondary }]}>{risk}</Text>
                                </View>
                            ))}
                        </View>
                    </View>

                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, { color: c.text }]}>Your Responsibility</Text>
                        <Text style={[styles.sectionBody, { color: c.textSecondary }]}>
                            You are solely responsible for your own investment decisions. We strongly recommend consulting with a qualified financial advisor before making any investment. Always conduct your own due diligence and research before investing in any security.
                        </Text>
                    </View>

                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, { color: c.text }]}>SEBI Registration Disclaimer</Text>
                        <Text style={[styles.sectionBody, { color: c.textSecondary }]}>
                            Registration granted by SEBI and certification from NISM in no way guarantee performance of the intermediary or provide any assurance of returns to investors. SEBI registration should not be construed as an endorsement by SEBI of the quality of service provided.
                        </Text>
                    </View>

                    <View style={[styles.divider, { backgroundColor: c.border }]} />

                    <Text style={[styles.confirmText, { color: c.text }]}>
                        By tapping "I Understand & Accept", you confirm that you have read, understood, and agree to the above disclaimers and risk disclosures.
                    </Text>
                </View>
            </ResponsiveScrollView>

            {/* Bottom Action Bar */}
            <View style={[styles.bottomBar, {
                backgroundColor: c.surface,
                borderTopColor: c.border,
                paddingBottom: Platform.OS === 'ios' ? 34 : 20,
            }]}>
                <TouchableOpacity
                    onPress={handleDecline}
                    style={[styles.declineBtn, { borderColor: c.border }]}
                    activeOpacity={0.7}
                >
                    <Text style={[styles.declineBtnText, { color: c.textSecondary }]}>Decline</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={handleAccept}
                    style={[styles.acceptBtn, { opacity: hasScrolledToEnd ? 1 : 0.5 }]}
                    disabled={!hasScrolledToEnd}
                    activeOpacity={0.85}
                >
                    <LinearGradient
                        colors={[Colors.brand.primary, '#1e3a8a']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.acceptBtnGrad}
                    >
                        <Ionicons name="checkmark-circle" size={18} color="#fff" />
                        <Text style={styles.acceptBtnText}>I Understand & Accept</Text>
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

/**
 * Check whether the user has already accepted the investment disclaimer.
 * Called from _layout.tsx to determine whether to redirect new sessions.
 */
export async function hasAcceptedDisclaimer(): Promise<boolean> {
    try {
        const val = await AsyncStorage.getItem(DISCLAIMER_KEY);
        return !!val;
    } catch {
        return false;
    }
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        paddingTop: Platform.select({ ios: 20, web: 24, default: 16 }),
        paddingBottom: 28,
        paddingHorizontal: Spacing.xl,
        alignItems: 'center',
    },
    headerIcon: {
        width: 56, height: 56, borderRadius: 28,
        backgroundColor: 'rgba(255,255,255,0.15)',
        justifyContent: 'center', alignItems: 'center',
        marginBottom: Spacing.md,
    },
    headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff', textAlign: 'center' },
    headerSubtitle: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.7)', marginTop: 4, textAlign: 'center' },
    content: { padding: Spacing.xl, paddingBottom: 120 },
    card: {
        borderRadius: BorderRadius.xl,
        borderWidth: 1,
        padding: Spacing.xl,
        ...(Platform.OS === 'web' ? { maxWidth: 640, alignSelf: 'center', width: '100%' } as any : {}),
    },
    sebiBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        padding: Spacing.md, borderRadius: BorderRadius.lg, borderWidth: 1,
        marginBottom: Spacing.xl,
    },
    sebiBadgeTitle: { fontSize: FontSize.sm, fontWeight: '700' },
    sebiBadgeReg: { fontSize: FontSize.xs, marginTop: 1 },
    section: { marginBottom: Spacing.xl },
    sectionTitle: { fontSize: FontSize.md, fontWeight: '700', marginBottom: Spacing.sm },
    sectionBody: { fontSize: FontSize.sm, lineHeight: 22 },
    warningBox: {
        flexDirection: 'row', alignItems: 'flex-start', gap: 10,
        padding: Spacing.lg, borderRadius: BorderRadius.lg, borderWidth: 1,
    },
    warningText: { flex: 1, fontSize: FontSize.sm, fontWeight: '600', lineHeight: 22 },
    riskList: { marginTop: Spacing.sm, gap: 10 },
    riskItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    riskText: { flex: 1, fontSize: FontSize.sm, lineHeight: 20 },
    divider: { height: 1, marginVertical: Spacing.lg },
    confirmText: { fontSize: FontSize.sm, fontWeight: '600', lineHeight: 22, textAlign: 'center' },
    bottomBar: {
        flexDirection: 'row', gap: 12,
        paddingHorizontal: Spacing.xl, paddingTop: 16,
        borderTopWidth: 1,
    },
    declineBtn: {
        flex: 1, height: 50, borderRadius: BorderRadius.lg,
        justifyContent: 'center', alignItems: 'center',
        borderWidth: 1.5,
    },
    declineBtnText: { fontSize: FontSize.base, fontWeight: '600' },
    acceptBtn: { flex: 2 },
    acceptBtnGrad: {
        height: 50, borderRadius: BorderRadius.lg,
        justifyContent: 'center', alignItems: 'center',
        flexDirection: 'row', gap: 8,
    },
    acceptBtnText: { color: '#fff', fontSize: FontSize.base, fontWeight: '700' },
});
