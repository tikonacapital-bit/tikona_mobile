import { Card, ResponsiveScrollView } from '@/components/ui';
import { BorderRadius, Colors, FontSize, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { PLANS } from '@/lib/types';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import {
    ActivityIndicator,
    Alert, AppState,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    Linking
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

type PlanKey = 'midcap_wealth' | 'smallcap_alpha' | 'sme_emerging' | 'all_in_growth';

const planOrder: PlanKey[] = ['midcap_wealth', 'smallcap_alpha', 'sme_emerging', 'all_in_growth'];

const planMeta: Record<PlanKey, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
    midcap_wealth: { icon: 'trending-up', color: Colors.brand.secondary },
    smallcap_alpha: { icon: 'flash', color: Colors.brand.gold },
    sme_emerging: { icon: 'business', color: Colors.brand.primary },
    all_in_growth: { icon: 'rocket', color: Colors.brand.accent },
};

// Deep link that Tradebox should redirect to after successful payment.
// Set this same URL in Tradebox Dashboard → Service settings → Redirect URL.
const PAYMENT_REDIRECT_URL = 'tikonamobile://payment-success';

export default function SubscriptionScreen() {
    const theme = useColorScheme();
    const c = Colors[theme];
    const { subscription, refreshUserData } = useAuth();
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [selectingPlan, setSelectingPlan] = useState<PlanKey | null>(null);
    const currentPlan = subscription?.plan as PlanKey | undefined;
    const prevPlanRef = useRef<string | undefined>(currentPlan);
    const isRedirectingRef = useRef(false);
    const hasInitiatedPaymentRef = useRef(false);

    // ── Auto-refresh when returning from Tradebox ──
    // When user pays on Tradebox and comes back, we re-fetch subscription data.
    // If your backend/webhook has written the subscription to Supabase,
    // it will be detected here automatically.
    const handleAppFocus = useCallback(async () => {
        if (!isRedirectingRef.current) return;
        isRedirectingRef.current = false;
        setIsRefreshing(true);

        // The webhook might take a few seconds to process the payment from Tradebox.
        // We will poll for the update 3 times.
        try {
            for (let i = 0; i < 3; i++) {
                await new Promise(resolve => setTimeout(resolve, i === 0 ? 1500 : 2000));
                await refreshUserData();
                // We can't easily break out of the loop here without reading the latest state,
                // but fetching user data 3 times over 5 seconds is perfectly fine and ensures
                // we catch the webhook's update even if it's delayed.
            }
        } finally {
            setIsRefreshing(false);
        }
    }, [refreshUserData]);

    useEffect(() => {
        if (Platform.OS === 'web') {
            const onVisChange = () => {
                if (document.visibilityState === 'visible') handleAppFocus();
            };
            document.addEventListener('visibilitychange', onVisChange);
            return () => document.removeEventListener('visibilitychange', onVisChange);
        } else {
            const sub = AppState.addEventListener('change', (state) => {
                if (state === 'active') handleAppFocus();
            });
            return () => sub.remove();
        }
    }, [handleAppFocus]);

    // Detect subscription changes and show success
    useEffect(() => {
        const prevPlan = prevPlanRef.current;
        const newPlan = subscription?.plan;
        prevPlanRef.current = newPlan;

        // ONLY trigger success if they actually clicked 'Get Plan' and the plan changed to active
        if (hasInitiatedPaymentRef.current && newPlan && newPlan !== prevPlan) {
            hasInitiatedPaymentRef.current = false;
            // A new subscription was detected!
            const planName = PLANS[newPlan as PlanKey]?.name || newPlan;
            Alert.alert(
                '🎉 Payment Successful!',
                `You're now subscribed to ${planName}. Enjoy premium research access!`,
                [{
                    text: 'Awesome!',
                    style: 'default',
                    onPress: () => router.replace('/(tabs)')
                }]
            );
        }
    }, [subscription?.plan]);

    const handleSelectPlan = async (planKey: PlanKey) => {
        if (selectingPlan || isRefreshing) return; // prevent double-tap
        const url = PLANS[planKey].tradeboxUrl;
        if (!url) {
            Alert.alert('Coming Soon', 'This plan is currently under development. Stay tuned!');
            return;
        }

        isRedirectingRef.current = true;
        hasInitiatedPaymentRef.current = true;

        if (Platform.OS === 'web') {
            window.open(url, '_blank', 'noopener,noreferrer');
            return;
        }

        setSelectingPlan(planKey);
        try {
            // openAuthSessionAsync watches for PAYMENT_REDIRECT_URL and auto-closes
            // the browser the moment Tradebox redirects to tikonamobile://payment-success.
            // Configure that redirect URL in Tradebox Dashboard → Service → Redirect URL.
            await WebBrowser.openAuthSessionAsync(url, PAYMENT_REDIRECT_URL, {
                showTitle: false,
            });
            // Browser closed (redirect or manual close) — AppState 'active' fires
            // and handleAppFocus() polls for the subscription update.
        } catch {
            isRedirectingRef.current = false;
            hasInitiatedPaymentRef.current = false;
            Alert.alert('Error', 'Could not open the secure payment browser. Please try again.');
        } finally {
            setSelectingPlan(null);
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: c.background }]}>

            {/* Premium Header */}
            <View>
                <LinearGradient
                    colors={[Colors.brand.primary, '#1e3a8a']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.header}
                >
                    <View style={styles.headerTop}>
                        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                            <Ionicons name="chevron-back" size={24} color="#fff" />
                        </TouchableOpacity>
                        
                        {isRefreshing ? (
                            <View style={styles.headerBadge}>
                                <ActivityIndicator size="small" color="#fff" />
                                <Text style={styles.headerBadgeText}>UPDATING...</Text>
                            </View>
                        ) : (
                            <View style={styles.headerBadge}>
                                <Ionicons name="shield-checkmark" size={12} color="rgba(255,255,255,0.8)" />
                                <Text style={styles.headerBadgeText}>SECURE CHECKOUT</Text>
                            </View>
                        )}
                    </View>
                    <View style={styles.headerTextWrapper}>
                        <Text style={styles.headerTitle}>Subscription Plans</Text>
                        <Text style={styles.headerSubtitle}>Wealth creation through expert research</Text>
                    </View>
                </LinearGradient>
            </View>

            {/* Current Plan Banner */}
            {currentPlan && (
                <View style={[styles.activeBanner, { backgroundColor: c.background, borderColor: c.success + '40' }]}>
                    <LinearGradient
                        colors={[c.success, c.success + 'CC']}
                        style={styles.activeIndicator}
                    >
                        <Ionicons name="checkmark-sharp" size={14} color="#fff" />
                    </LinearGradient>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.activeBannerTitle, { color: c.text }]}>
                            Current: <Text style={{ fontWeight: '800', color: c.success }}>{PLANS[currentPlan]?.name}</Text>
                        </Text>
                        {subscription?.expires_at && (
                            <Text style={[styles.activeBannerSub, { color: c.textTertiary }]}>
                                Membership active until {new Date(subscription.expires_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </Text>
                        )}
                        {currentPlan && PLANS[currentPlan as PlanKey]?.telegramUrl && (
                            <TouchableOpacity
                                style={{
                                    marginTop: 10,
                                    backgroundColor: '#0088cc',
                                    paddingVertical: 8,
                                    paddingHorizontal: 12,
                                    borderRadius: 8,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    alignSelf: 'flex-start',
                                    gap: 6
                                }}
                                onPress={() => Linking.openURL((PLANS[currentPlan as PlanKey] as any).telegramUrl)}
                            >
                                <Ionicons name="paper-plane" size={14} color="#fff" />
                                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>Join PRO Telegram Group</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            )}

            <ResponsiveScrollView contentContainerStyle={styles.content}>

                {/* Floating Info Banner */}
                <View style={[styles.infoBanner, { backgroundColor: c.surface, borderColor: c.border }]}>
                    <View style={[styles.infoIconBox, { backgroundColor: Colors.brand.secondary + '15' }]}>
                        <Ionicons name="lock-closed" size={18} color={Colors.brand.secondary} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.infoBannerTitle, { color: c.text }]}>Secure Transaction</Text>
                        <Text style={[styles.infoBannerSub, { color: c.textTertiary }]}>
                            Checkout and KYC will be handled via Tradebox's secure payment gateway.
                        </Text>
                    </View>
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
                                    <Text style={[styles.planName, { color: c.text }]} numberOfLines={2}>{plan.name}</Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap' }}>
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
                                        ? { backgroundColor: c.successBg, borderColor: c.success + '20', borderWidth: 1 }
                                        : isComingSoon
                                            ? { backgroundColor: c.border }
                                            : { backgroundColor: color, opacity: selectingPlan === planKey ? 0.7 : 1 },
                                ]}
                                onPress={() => !isCurrent && !isComingSoon && handleSelectPlan(planKey)}
                                disabled={isCurrent || isComingSoon || !!selectingPlan || isRefreshing}
                                activeOpacity={0.85}
                            >
                                {selectingPlan === planKey ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <>
                                        <Text style={[styles.planBtnText, { color: isCurrent ? c.success : isComingSoon ? c.textSecondary : '#fff' }]}>
                                            {isCurrent ? 'Current Subscribed Plan' : isComingSoon ? 'Coming Soon' : 'Subscribe Now'}
                                        </Text>
                                        {!isCurrent && !isComingSoon && <Ionicons name="arrow-forward" size={18} color="#fff" />}
                                        {isCurrent && <Ionicons name="checkmark-circle" size={18} color={c.success} />}
                                    </>
                                )}
                            </TouchableOpacity>

                            {!isCurrent && !isComingSoon && (
                                <View style={styles.payNoteRow}>
                                    <Ionicons name="lock-closed" size={10} color={c.textTertiary} />
                                    <Text style={[styles.payNoteText, { color: c.textTertiary }]}>
                                        Redirects to Secure Tradebox Checkout
                                    </Text>
                                </View>
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
        paddingTop: Platform.select({ ios: 58, web: 24, default: 48 }),
        paddingBottom: 50,
        paddingHorizontal: Spacing.xl,
        borderBottomLeftRadius: BorderRadius['3xl'],
        borderBottomRightRadius: BorderRadius['3xl'],
    },
    headerTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: Spacing.xl,
    },
    backBtn: {
        width: 44,
        height: 44,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.15)',
    },
    headerBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: BorderRadius.full,
    },
    headerBadgeText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#fff',
        letterSpacing: 0.5,
    },
    headerTextWrapper: {
        marginTop: Spacing.sm,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '800',
        color: '#fff',
        letterSpacing: -0.5,
    },
    headerSubtitle: {
        fontSize: FontSize.md,
        color: 'rgba(255,255,255,0.7)',
        marginTop: 4,
        fontWeight: '500',
    },
    activeBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginHorizontal: Spacing.xl,
        marginTop: -25,
        padding: 16,
        borderRadius: BorderRadius.xl,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 4,
        zIndex: 10,
    },
    activeIndicator: {
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    activeBannerTitle: {
        fontSize: FontSize.sm,
        fontWeight: '600',
    },
    activeBannerSub: {
        fontSize: 11,
        marginTop: 2,
    },
    infoBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 16,
        borderRadius: BorderRadius.xl,
        borderWidth: 1,
        marginBottom: Spacing.xl,
    },
    infoIconBox: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    infoBannerTitle: {
        fontSize: FontSize.sm,
        fontWeight: '700',
    },
    infoBannerSub: {
        fontSize: FontSize.xs,
        lineHeight: 16,
        marginTop: 2,
    },
    content: { padding: Spacing.xl },
    planCard: {
        padding: 20,
        marginBottom: Spacing.xl,
        overflow: 'hidden',
        position: 'relative',
        borderRadius: BorderRadius['2xl'],
    },
    popularBadge: {
        position: 'absolute',
        top: 0,
        right: 0,
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderBottomLeftRadius: 16,
    },
    popularText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.8,
    },
    planHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    planIconCircle: {
        width: 52,
        height: 52,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    planName: {
        fontSize: 20,
        fontWeight: '800',
        letterSpacing: -0.3,
    },
    planPrice: {
        fontSize: 24,
        fontWeight: '800',
    },
    planPeriod: {
        fontSize: FontSize.sm,
        marginLeft: 4,
    },
    planDescription: {
        fontSize: 15,
        lineHeight: 22,
        marginBottom: 20,
    },
    currentBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: BorderRadius.full,
    },
    featureList: {
        marginBottom: 24,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.03)',
    },
    featureRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 12,
    },
    featureText: {
        fontSize: 14,
        flex: 1,
        fontWeight: '500',
    },
    planButton: {
        height: 56,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'row',
        gap: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 2,
    },
    planBtnText: {
        fontSize: 16,
        fontWeight: '800',
    },
    payNoteRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginTop: 12,
    },
    payNoteText: {
        fontSize: 11,
        fontWeight: '600',
    },
});
