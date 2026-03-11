import React from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity,
    Platform, Linking, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Colors, Spacing, BorderRadius, FontSize } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { PLANS } from '@/lib/types';
import { Card, ResponsiveScrollView } from '@/components/ui';

type PlanKey = 'midcap_wealth' | 'smallcap_alpha' | 'sme_emerging' | 'all_in_growth';

const planOrder: PlanKey[] = ['midcap_wealth', 'smallcap_alpha', 'sme_emerging', 'all_in_growth'];

const planMeta: Record<PlanKey, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
    midcap_wealth:  { icon: 'trending-up',  color: Colors.brand.secondary },
    smallcap_alpha: { icon: 'flash',         color: Colors.brand.gold },
    sme_emerging:   { icon: 'business',      color: '#8B5CF6' },
    all_in_growth:  { icon: 'rocket',        color: Colors.brand.accent },
};

export default function SubscriptionScreen() {
    const theme = useColorScheme();
    const c = Colors[theme];
    const { subscription } = useAuth();
    const currentPlan = subscription?.plan as PlanKey | undefined;

    const handleSelectPlan = (planKey: PlanKey) => {
        const url = PLANS[planKey].tradeboxUrl;
        if (!url) {
            Alert.alert('Coming Soon', 'This plan is currently under development. Stay tuned!');
            return;
        }

        if (Platform.OS === 'web') {
            window.open(url, '_blank', 'noopener,noreferrer');
            return;
        }

        // Native (Android/iOS): Open in Chrome/Safari
        // This is strictly required because Tradebox uses Clerk/Google Auth
        // which completely blocks login attempts inside in-app WebViews for security.
        Linking.openURL(url).catch(() =>
            Alert.alert('Error', 'Could not open the link. Please try again.')
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: c.background }]}>

            {/* Header */}
            <View style={[styles.header, { backgroundColor: Colors.brand.primary }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={22} color="#fff" />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={styles.headerTitle}>Choose Your Plan</Text>
                    <Text style={styles.headerSubtitle}>Unlock premium research content</Text>
                </View>
            </View>

            {/* Current Plan Banner */}
            {currentPlan && (
                <View style={[styles.activeBanner, { backgroundColor: c.successBg, borderColor: c.success + '40' }]}>
                    <Ionicons name="checkmark-circle" size={18} color={c.success} />
                    <Text style={[styles.activeBannerText, { color: c.success }]}>
                        You're on the <Text style={{ fontWeight: '700' }}>{PLANS[currentPlan]?.name}</Text> plan
                        {subscription?.expires_at ? ` · Expires ${new Date(subscription.expires_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
                    </Text>
                </View>
            )}

            <ResponsiveScrollView contentContainerStyle={styles.content}>
                
                {/* Info banner explaining the external redirect */}
                <View style={[styles.infoBanner, { backgroundColor: c.cardBg, borderColor: c.border }]}>
                    <Ionicons name="shield-checkmark" size={18} color={Colors.brand.secondary} />
                    <Text style={[styles.infoBannerText, { color: c.textSecondary }]}>
                        To ensure security, payment and KYC will be securely handled in your phone's browser.
                    </Text>
                </View>

                {/* Plans */}
                {planOrder.map((planKey) => {
                    const plan = PLANS[planKey];
                    const { icon, color } = planMeta[planKey];
                    const isCurrent = planKey === currentPlan;
                    const isHighlight = planKey === 'all_in_growth';
                    const isComingSoon = !plan.tradeboxUrl;

                    return (
                        <Card key={planKey} theme={theme} style={[styles.planCard, isHighlight && { borderColor: color, borderWidth: 2 }]}>
                            {isHighlight && (
                                <View style={[styles.popularBadge, { backgroundColor: color }]}>
                                    <Text style={styles.popularText}>BEST VALUE</Text>
                                </View>
                            )}

                            {isComingSoon && !isHighlight && (
                                <View style={[styles.popularBadge, { backgroundColor: c.textTertiary }]}>
                                    <Text style={styles.popularText}>COMING SOON</Text>
                                </View>
                            )}

                            <View style={styles.planHeader}>
                                <View style={[styles.planIconCircle, { backgroundColor: color + '15' }]}>
                                    <Ionicons name={icon} size={24} color={color} />
                                </View>
                                <View style={{ flex: 1, marginLeft: 14 }}>
                                    <Text style={[styles.planName, { color: c.text }]}>{plan.name}</Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                                        <Text style={[styles.planPrice, { color }]}>{plan.price}</Text>
                                        <Text style={[styles.planPeriod, { color: c.textTertiary }]}>{plan.period}</Text>
                                    </View>
                                </View>
                                {isCurrent && (
                                    <View style={[styles.currentBadge, { backgroundColor: c.successBg }]}>
                                        <Text style={{ color: c.success, fontSize: 10, fontWeight: '700' }}>ACTIVE</Text>
                                    </View>
                                )}
                            </View>

                            {/* Plan Description */}
                            <Text style={[styles.planDescription, { color: c.textSecondary }]}>
                                {plan.description}
                            </Text>

                            <View style={styles.featureList}>
                                {plan.features.map((f: string, i: number) => (
                                    <View key={i} style={styles.featureRow}>
                                        <Ionicons name="checkmark-circle" size={15} color={c.success} />
                                        <Text style={[styles.featureText, { color: c.text }]}>{f}</Text>
                                    </View>
                                ))}
                                {plan.limitations.map((l: string, i: number) => (
                                    <View key={`l-${i}`} style={styles.featureRow}>
                                        <Ionicons name="close-circle" size={15} color={c.textTertiary} />
                                        <Text style={[styles.featureText, { color: c.textTertiary }]}>{l}</Text>
                                    </View>
                                ))}
                            </View>

                            <TouchableOpacity
                                style={[
                                    styles.planButton,
                                    isCurrent
                                        ? { backgroundColor: c.borderLight }
                                        : isComingSoon
                                            ? { backgroundColor: c.border }
                                            : { backgroundColor: color },
                                ]}
                                onPress={() => !isCurrent && handleSelectPlan(planKey)}
                                disabled={isCurrent}
                                activeOpacity={0.85}
                            >
                                {!isCurrent && !isComingSoon && <Ionicons name="open-outline" size={18} color="#fff" />}
                                {isComingSoon && !isCurrent && <Ionicons name="time-outline" size={18} color={c.textSecondary} />}
                                <Text style={[styles.planBtnText, { color: isCurrent ? c.textTertiary : isComingSoon ? c.textSecondary : '#fff' }]}>
                                    {isCurrent ? 'Current Plan' : isComingSoon ? 'Coming Soon' : `Get ${plan.name} · ${plan.price}`}
                                </Text>
                            </TouchableOpacity>

                            {!isCurrent && !isComingSoon && (
                                <Text style={[styles.payNote, { color: c.textTertiary }]}>
                                    Opens secure browser checkout
                                </Text>
                            )}
                        </Card>
                    );
                })}

                <View style={{ height: 40 }} />
            </ResponsiveScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
        paddingTop: Platform.select({ ios: 58, web: 20, default: 44 }),
        paddingBottom: 20, paddingHorizontal: Spacing.xl,
        borderBottomLeftRadius: BorderRadius['2xl'],
        borderBottomRightRadius: BorderRadius['2xl'],
    },
    backBtn: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.12)' },
    headerTitle: { fontSize: FontSize.xl, fontWeight: '700', color: '#fff' },
    headerSubtitle: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.65)', marginTop: 2 },
    activeBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: Spacing.xl, marginTop: Spacing.lg, padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1 },
    activeBannerText: { fontSize: FontSize.sm, flex: 1 },
    infoBanner: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        padding: Spacing.md, borderRadius: BorderRadius.md,
        borderWidth: 1, marginBottom: Spacing.lg,
    },
    infoBannerText: { fontSize: FontSize.sm, flex: 1, lineHeight: 20 },
    content: { padding: Spacing.xl },
    planCard: { padding: Spacing.xl, marginBottom: Spacing.lg, overflow: 'hidden', position: 'relative' },
    popularBadge: { position: 'absolute', top: 0, right: 0, paddingHorizontal: 12, paddingVertical: 5, borderBottomLeftRadius: BorderRadius.sm },
    popularText: { color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 1 },
    planHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm },
    planIconCircle: { width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    planName: { fontSize: FontSize.lg, fontWeight: '700' },
    planPrice: { fontSize: FontSize['2xl'], fontWeight: '800' },
    planPeriod: { fontSize: FontSize.sm, marginLeft: 2 },
    planDescription: { fontSize: FontSize.sm, lineHeight: 20, marginBottom: Spacing.lg },
    currentBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: BorderRadius.full },
    featureList: { marginBottom: Spacing.lg },
    featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 9 },
    featureText: { fontSize: FontSize.sm, flex: 1 },
    planButton: { height: 52, borderRadius: BorderRadius.md, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 8 },
    planBtnText: { fontSize: FontSize.base, fontWeight: '700' },
    payNote: { fontSize: 11, textAlign: 'center', marginTop: Spacing.sm },
});
