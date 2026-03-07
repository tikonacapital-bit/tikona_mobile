import React, { useState } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity,
    ActivityIndicator, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Colors, Spacing, BorderRadius, FontSize } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useAlert } from '@/context/AlertContext';
import { PLANS } from '@/lib/types';
import { Card, ResponsiveScrollView } from '@/components/ui';
import { RazorpayWebView, saveSubscription, type PlanKey, type PaymentResult } from '@/lib/razorpay';
import { initiateTradeboxKyc } from '@/lib/tradebox';

const planOrder: PlanKey[] = ['basic', 'premium'];

const planMeta: Record<PlanKey, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
    basic: { icon: 'star-outline', color: Colors.brand.secondary },
    premium: { icon: 'diamond', color: Colors.brand.gold },
};

export default function SubscriptionScreen() {
    const theme = useColorScheme();
    const c = Colors[theme];
    const { user, subscription, refreshUserData } = useAuth();
    const { showAlert } = useAlert();
    const currentPlan = (subscription?.plan || 'free') as 'free' | PlanKey;

    const [activePlan, setActivePlan] = useState<PlanKey | null>(null);
    const [savingPlan, setSavingPlan] = useState(false);
    const [savingMessage, setSavingMessage] = useState('Activating your plan…');

    const handlePaymentResult = async (result: PaymentResult) => {
        if (!activePlan || !user?.id) return;

        if (result.success && result.paymentId) {
            setSavingPlan(true);

            // ── Step 1: Save subscription ─────────────────────────────────────
            setSavingMessage('Activating your plan…');
            const { error } = await saveSubscription(user.id, activePlan, result.paymentId);

            if (error) {
                setSavingPlan(false);
                setActivePlan(null);
                showAlert(
                    'Almost there!',
                    `Payment was successful (ID: ${result.paymentId?.slice(-8)}) but we couldn't update your plan. Please contact support.`
                );
                return;
            }

            // ── Step 2: Trigger Tradebox KYC simultaneously ───────────────────
            setSavingMessage('Initiating KYC verification…');
            const kycResult = await initiateTradeboxKyc({
                userId: user.id,
                fullName: user.fullName || user.firstName || 'Investor',
                email: user.primaryEmailAddress?.emailAddress || '',
                phone: user.phoneNumbers?.[0]?.phoneNumber,
                razorpayPaymentId: result.paymentId,
                plan: activePlan,
            });

            // ── Step 3: Refresh app state ─────────────────────────────────────
            await refreshUserData();
            setSavingPlan(false);
            setActivePlan(null);

            // ── Step 4: Show result to user ───────────────────────────────────
            if (kycResult.success) {
                showAlert(
                    `🎉 Welcome to ${PLANS[activePlan].name}!`,
                    `Your ${PLANS[activePlan].name} plan is now active.\n\n✅ KYC verification has been initiated automatically via Tradebox. You'll be notified once it's complete.`,
                    [{ text: "Let's Go!", style: 'default', onPress: () => router.back() }],
                );
            } else {
                // Payment succeeded but KYC initiation failed — non-blocking
                showAlert(
                    `🎉 Welcome to ${PLANS[activePlan].name}!`,
                    `Your plan is active.\n\n⚠️ KYC initiation had an issue (${kycResult.error || 'unknown'}). Please complete KYC from your profile settings.`,
                    [{ text: "Let's Go!", style: 'default', onPress: () => router.back() }],
                );
            }
        } else if (result.error === 'cancelled') {
            setActivePlan(null);
        } else {
            setActivePlan(null);
            showAlert('Payment Failed', result.error || 'Something went wrong. Please try again.');
        }
    };

    const userName = user?.fullName || user?.firstName || 'Investor';
    const userEmail = user?.primaryEmailAddress?.emailAddress || '';

    return (
        <View style={[styles.container, { backgroundColor: c.background }]}>
            {/* Razorpay WebView Modal */}
            {activePlan && (
                <RazorpayWebView
                    visible={!!activePlan}
                    plan={activePlan}
                    userName={userName}
                    userEmail={userEmail}
                    onResult={handlePaymentResult}
                    theme={theme}
                />
            )}

            {/* Saving overlay */}
            {savingPlan && (
                <View style={styles.savingOverlay}>
                    <ActivityIndicator size="large" color={Colors.brand.secondary} />
                    <Text style={{ color: '#fff', marginTop: 12, fontSize: FontSize.base }}>{savingMessage}</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.5)', marginTop: 6, fontSize: FontSize.sm }}>
                        Please wait, do not close the app
                    </Text>
                </View>
            )}

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
            {currentPlan !== 'free' && (
                <View style={[styles.activeBanner, { backgroundColor: c.successBg, borderColor: c.success + '40' }]}>
                    <Ionicons name="checkmark-circle" size={18} color={c.success} />
                    <Text style={[styles.activeBannerText, { color: c.success }]}>
                        You're on the <Text style={{ fontWeight: '700' }}>{PLANS[currentPlan]?.name}</Text> plan
                        {subscription?.expires_at ? ` · Expires ${new Date(subscription.expires_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
                    </Text>
                </View>
            )}

            <ResponsiveScrollView contentContainerStyle={styles.content}>
                {/* Free Plan */}
                <Card theme={theme} style={styles.planCard}>
                    <View style={styles.planHeader}>
                        <View style={[styles.planIconCircle, { backgroundColor: '#6B728015' }]}>
                            <Ionicons name="flash-outline" size={24} color="#6B7280" />
                        </View>
                        <View style={{ flex: 1, marginLeft: 14 }}>
                            <Text style={[styles.planName, { color: c.text }]}>Free</Text>
                            <Text style={[styles.planPrice, { color: '#6B7280' }]}>₹0</Text>
                        </View>
                        {currentPlan === 'free' && (
                            <View style={[styles.currentBadge, { backgroundColor: c.successBg }]}>
                                <Text style={{ color: c.success, fontSize: 10, fontWeight: '700' }}>ACTIVE</Text>
                            </View>
                        )}
                    </View>
                    <View style={styles.featureList}>
                        {PLANS.free.features.map((f, i) => (
                            <View key={i} style={styles.featureRow}>
                                <Ionicons name="checkmark-circle" size={15} color={c.success} />
                                <Text style={[styles.featureText, { color: c.text }]}>{f}</Text>
                            </View>
                        ))}
                        {PLANS.free.limitations.map((l, i) => (
                            <View key={`l-${i}`} style={styles.featureRow}>
                                <Ionicons name="close-circle" size={15} color={c.textTertiary} />
                                <Text style={[styles.featureText, { color: c.textTertiary }]}>{l}</Text>
                            </View>
                        ))}
                    </View>
                </Card>

                {/* Paid Plans */}
                {planOrder.map((planKey) => {
                    const plan = PLANS[planKey];
                    const { icon, color } = planMeta[planKey];
                    const isCurrent = planKey === currentPlan;
                    const isHighlight = planKey === 'premium';

                    return (
                        <Card key={planKey} theme={theme} style={[styles.planCard, isHighlight && { borderColor: color, borderWidth: 2 }]}>
                            {isHighlight && (
                                <View style={[styles.popularBadge, { backgroundColor: color }]}>
                                    <Text style={styles.popularText}>MOST POPULAR</Text>
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

                            <View style={styles.featureList}>
                                {plan.features.map((f, i) => (
                                    <View key={i} style={styles.featureRow}>
                                        <Ionicons name="checkmark-circle" size={15} color={c.success} />
                                        <Text style={[styles.featureText, { color: c.text }]}>{f}</Text>
                                    </View>
                                ))}
                                {plan.limitations.map((l, i) => (
                                    <View key={`l-${i}`} style={styles.featureRow}>
                                        <Ionicons name="close-circle" size={15} color={c.textTertiary} />
                                        <Text style={[styles.featureText, { color: c.textTertiary }]}>{l}</Text>
                                    </View>
                                ))}
                            </View>

                            <TouchableOpacity
                                style={[styles.planButton, isCurrent ? { backgroundColor: c.borderLight } : { backgroundColor: color }]}
                                onPress={() => !isCurrent && setActivePlan(planKey)}
                                disabled={isCurrent}
                                activeOpacity={0.85}
                            >
                                {!isCurrent && <Ionicons name="card" size={18} color="#fff" />}
                                <Text style={[styles.planBtnText, { color: isCurrent ? c.textTertiary : '#fff' }]}>
                                    {isCurrent ? 'Current Plan' : `Pay ${plan.price} · ${plan.name}`}
                                </Text>
                            </TouchableOpacity>

                            {!isCurrent && (
                                <Text style={[styles.payNote, { color: c.textTertiary }]}>
                                    UPI, Cards, Netbanking · Secured by Razorpay
                                </Text>
                            )}
                        </Card>
                    );
                })}

                {/* Security row */}
                <View style={styles.securityRow}>
                    <Ionicons name="shield-checkmark" size={14} color={c.textTertiary} />
                    <Text style={[styles.securityText, { color: c.textTertiary }]}>
                        All payments are encrypted and secured by Razorpay. Cancel anytime.
                    </Text>
                </View>

                <View style={{ height: 40 }} />
            </ResponsiveScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    savingOverlay: {
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 999,
        justifyContent: 'center', alignItems: 'center',
    },
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
    content: { padding: Spacing.xl },
    planCard: { padding: Spacing.xl, marginBottom: Spacing.lg, overflow: 'hidden', position: 'relative' },
    popularBadge: { position: 'absolute', top: 0, right: 0, paddingHorizontal: 12, paddingVertical: 5, borderBottomLeftRadius: BorderRadius.sm },
    popularText: { color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 1 },
    planHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.lg },
    planIconCircle: { width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    planName: { fontSize: FontSize.lg, fontWeight: '700' },
    planPrice: { fontSize: FontSize['2xl'], fontWeight: '800' },
    planPeriod: { fontSize: FontSize.sm, marginLeft: 2 },
    currentBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: BorderRadius.full },
    featureList: { marginBottom: Spacing.lg },
    featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 9 },
    featureText: { fontSize: FontSize.sm, flex: 1 },
    planButton: { height: 52, borderRadius: BorderRadius.md, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 8 },
    planBtnText: { fontSize: FontSize.base, fontWeight: '700' },
    payNote: { fontSize: 11, textAlign: 'center', marginTop: Spacing.sm },
    securityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: Spacing.md },
    securityText: { fontSize: 11, textAlign: 'center' },
});
