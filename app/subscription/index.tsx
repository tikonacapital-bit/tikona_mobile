import { Card, ResponsiveScrollView } from '@/components/ui';
import { SubscriptionComparison } from '@/components/SubscriptionComparison';
import { BorderRadius, Colors, FontSize, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { PLANS } from '@/lib/types';
import { getAuthenticatedSupabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useAuth as useClerkAuth } from '@clerk/clerk-expo';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import {
    ActivityIndicator,
    Alert, AppState, Animated,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

type PlanKey = 'midcap_wealth' | 'smallcap_alpha' | 'sme_emerging' | 'all_in_growth';

const planOrder: PlanKey[] = ['midcap_wealth', 'smallcap_alpha', 'sme_emerging', 'all_in_growth'];

const planMeta: Record<PlanKey, { icon: keyof typeof Ionicons.glyphMap; color: string; gradient: string[] }> = {
    midcap_wealth:  { icon: 'trending-up', color: '#3A5BA0', gradient: ['#1F4690', '#3A5BA0'] },
    smallcap_alpha: { icon: 'flash',       color: '#F59E0B', gradient: ['#D97706', '#F59E0B'] },
    sme_emerging:   { icon: 'business',    color: '#8B5CF6', gradient: ['#7C3AED', '#8B5CF6'] },
    all_in_growth:  { icon: 'rocket',      color: '#F97316', gradient: ['#EA580C', '#F97316'] },
};

const PAYMENT_REDIRECT_URL = 'tikonamobile://payment-success';

export default function SubscriptionScreen() {
    const theme = useColorScheme();
    const c = Colors[theme];
    const isDark = theme === 'dark';
    const { subscription, refreshUserData, userId } = useAuth();
    const { getToken } = useClerkAuth();
    const { isWideWeb } = useResponsiveLayout();
    const subscriptionRef = useRef(subscription);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [selectingPlan, setSelectingPlan] = useState<PlanKey | null>(null);
    const currentPlan = subscription?.plan as PlanKey | undefined;
    useEffect(() => { subscriptionRef.current = subscription; }, [subscription]);

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
            Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
        ]).start();
    }, []);

    const prevPlanRef = useRef<string | undefined>(currentPlan);
    const isRedirectingRef = useRef(false);
    const hasInitiatedPaymentRef = useRef(false);

    const handleAppFocus = useCallback(async () => {
        if (!isRedirectingRef.current) return;
        isRedirectingRef.current = false;
        setIsRefreshing(true);
        try {
            for (let i = 0; i < 3; i++) {
                await new Promise(resolve => setTimeout(resolve, i === 0 ? 1500 : 2000));
                await refreshUserData();
                if (subscriptionRef.current?.is_active) break;
            }
        } finally { setIsRefreshing(false); }
    }, [refreshUserData]);

    useEffect(() => {
        if (Platform.OS === 'web') {
            const onVisChange = () => { if (document.visibilityState === 'visible') handleAppFocus(); };
            document.addEventListener('visibilitychange', onVisChange);
            return () => document.removeEventListener('visibilitychange', onVisChange);
        } else {
            const sub = AppState.addEventListener('change', (s) => { if (s === 'active') handleAppFocus(); });
            return () => sub.remove();
        }
    }, [handleAppFocus]);

    useEffect(() => {
        const prevPlan = prevPlanRef.current;
        const newPlan = subscription?.plan;
        prevPlanRef.current = newPlan;
        if (hasInitiatedPaymentRef.current && newPlan && newPlan !== prevPlan) {
            hasInitiatedPaymentRef.current = false;
            const planName = PLANS[newPlan as PlanKey]?.name || newPlan;
            Alert.alert('🎉 Payment Successful!',
                `You're now subscribed to ${planName}. Enjoy premium research access!`,
                [{ text: 'Awesome!', onPress: () => router.replace('/(tabs)') }]);
        }
    }, [subscription?.plan]);

    const handleSelectPlan = async (planKey: PlanKey) => {
        if (selectingPlan || isRefreshing) return;
        const url = PLANS[planKey].tradeboxUrl;
        if (!url) { Alert.alert('Coming Soon', 'This plan is coming soon. Stay tuned!'); return; }
        if (userId) {
            try {
                const token = await getToken({ template: 'supabase' });
                const client = getAuthenticatedSupabase(token);
                await client.from('pending_payments').upsert({ user_id: userId, plan: planKey }, { onConflict: 'user_id' });
            } catch (_) { }
        }
        isRedirectingRef.current = true;
        hasInitiatedPaymentRef.current = true;
        if (Platform.OS === 'web') { window.open(url, '_blank', 'noopener,noreferrer'); return; }
        setSelectingPlan(planKey);
        try {
            await WebBrowser.openAuthSessionAsync(url, PAYMENT_REDIRECT_URL, { showTitle: false });
        } catch {
            isRedirectingRef.current = false;
            hasInitiatedPaymentRef.current = false;
            Alert.alert('Error', 'Could not open the secure payment browser. Please try again.');
        } finally { setSelectingPlan(null); }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // WEB PREMIUM LAYOUT
    // ─────────────────────────────────────────────────────────────────────────
    if (isWideWeb) {
        return (
            <View style={[webStyles.root, { backgroundColor: isDark ? '#080C14' : '#F0F4FF' }]}>
                {/* ── Sticky Navbar ── */}
                <View style={[webStyles.navbar, {
                    backgroundColor: isDark ? 'rgba(8,12,20,0.85)' : 'rgba(255,255,255,0.85)',
                    borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(31,70,144,0.08)',
                }, Platform.OS === 'web' ? { backdropFilter: 'blur(20px)' } as any : {}]}>
                    <View style={webStyles.navbarInner}>
                        <TouchableOpacity onPress={() => router.back()} style={[webStyles.navBack, { borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(31,70,144,0.15)' }]}>
                            <Ionicons name="chevron-back" size={16} color={c.text} />
                            <Text style={[webStyles.navBackText, { color: c.text }]}>Back</Text>
                        </TouchableOpacity>

                        {isRefreshing ? (
                            <View style={webStyles.navRight}>
                                <ActivityIndicator size="small" color={Colors.brand.secondary} />
                                <Text style={[webStyles.navBadgeText, { color: c.textSecondary }]}>Syncing…</Text>
                            </View>
                        ) : (
                            <View style={[webStyles.navRight, webStyles.navBadge, {
                                backgroundColor: 'rgba(52,211,153,0.1)',
                                borderColor: 'rgba(52,211,153,0.25)',
                            }]}>
                                <Ionicons name="shield-checkmark" size={13} color="#34D399" />
                                <Text style={[webStyles.navBadgeText, { color: '#34D399' }]}>Secure Checkout</Text>
                            </View>
                        )}
                    </View>
                </View>

                <ResponsiveScrollView contentContainerStyle={webStyles.scrollContent}>
                    {/* ── Hero ── */}
                    <Animated.View style={[webStyles.hero, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                        {/* Background orbs */}
                        {Platform.OS === 'web' && (
                            <>
                                <View style={[webStyles.orb, webStyles.orbLeft, { backgroundColor: 'rgba(31,70,144,0.18)' }]} />
                                <View style={[webStyles.orb, webStyles.orbRight, { backgroundColor: 'rgba(249,115,22,0.12)' }]} />
                            </>
                        )}

                        <View style={[webStyles.heroBadge, { backgroundColor: 'rgba(31,70,144,0.1)', borderColor: 'rgba(31,70,144,0.2)' }]}>
                            <Ionicons name="sparkles" size={13} color={Colors.brand.secondary} />
                            <Text style={[webStyles.heroBadgeText, { color: Colors.brand.secondary }]}>SEBI Registered Research Analyst · INH000069807</Text>
                        </View>

                        <Text style={[webStyles.heroTitle, { color: c.text }]}>
                            Research-Backed{'\n'}
                            <Text style={{ color: Colors.brand.secondary }}>Wealth Creation</Text>
                        </Text>
                        <Text style={[webStyles.heroSub, { color: c.textSecondary }]}>
                            Expert equity research with proven stock picks. Choose the plan that fits your investment style.
                        </Text>
                    </Animated.View>

                    {/* Active plan ribbon */}
                    {currentPlan && (
                        <View style={[webStyles.activeRibbon, { backgroundColor: 'rgba(52,211,153,0.08)', borderColor: 'rgba(52,211,153,0.2)' }]}>
                            <View style={webStyles.activeRibbonDot} />
                            <Text style={[webStyles.activeRibbonText, { color: '#34D399' }]}>
                                Active Plan: <Text style={{ fontWeight: '800' }}>{PLANS[currentPlan]?.name}</Text>
                                {subscription?.expires_at && (
                                    <Text style={{ fontWeight: '500', opacity: 0.8 }}>
                                        {'  ·  '}Valid until {new Date(subscription.expires_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                                    </Text>
                                )}
                            </Text>
                            {(PLANS[currentPlan as PlanKey] as any)?.telegramUrl && (
                                <TouchableOpacity
                                    style={webStyles.telegramBtn}
                                    onPress={() => Linking.openURL((PLANS[currentPlan as PlanKey] as any).telegramUrl)}
                                >
                                    <Ionicons name="paper-plane" size={12} color="#fff" />
                                    <Text style={webStyles.telegramBtnText}>Join Telegram</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    )}

                    {/* ── Plan Grid ── */}
                    <Animated.View style={[webStyles.grid, { opacity: fadeAnim }]}>
                        {planOrder.map((planKey, idx) => {
                            const plan = PLANS[planKey];
                            const meta = planMeta[planKey];
                            const isCurrent = planKey === currentPlan;
                            const isHighlight = planKey === 'all_in_growth';
                            const isComingSoon = !plan.tradeboxUrl;

                            return (
                                <View
                                    key={planKey}
                                    style={[
                                        webStyles.planCard,
                                        {
                                            backgroundColor: isDark ? '#111827' : '#ffffff',
                                            borderColor: isHighlight
                                                ? meta.color + '50'
                                                : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(31,70,144,0.08)',
                                        },
                                        isHighlight && {
                                            ...(Platform.OS === 'web' ? {
                                                boxShadow: `0 0 0 2px ${meta.color}40, 0 20px 60px rgba(249,115,22,0.15)`,
                                            } as any : {}),
                                        },
                                        Platform.OS === 'web' ? {
                                            boxShadow: isDark
                                                ? '0 4px 40px rgba(0,0,0,0.4)'
                                                : '0 4px 40px rgba(31,70,144,0.08)',
                                            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                                        } as any : {},
                                    ]}
                                >
                                    {/* Highlight badge */}
                                    {isHighlight && (
                                        <LinearGradient
                                            colors={meta.gradient as any}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 0 }}
                                            style={webStyles.bestBadge}
                                        >
                                            <Ionicons name="star" size={10} color="#fff" />
                                            <Text style={webStyles.bestBadgeText}>BEST VALUE</Text>
                                        </LinearGradient>
                                    )}
                                    {isComingSoon && !isHighlight && (
                                        <View style={[webStyles.bestBadge, { backgroundColor: '#6B7280' }]}>
                                            <Text style={webStyles.bestBadgeText}>COMING SOON</Text>
                                        </View>
                                    )}

                                    {/* Plan icon */}
                                    <LinearGradient
                                        colors={meta.gradient as any}
                                        style={webStyles.planIconGrad}
                                    >
                                        <Ionicons name={meta.icon} size={22} color="#fff" />
                                    </LinearGradient>

                                    {/* Plan title + price */}
                                    <Text style={[webStyles.planName, { color: c.text }]}>{plan.name}</Text>
                                    <Text style={[webStyles.planDesc, { color: c.textSecondary }]}>{plan.description}</Text>

                                    <View style={webStyles.priceRow}>
                                        <Text style={[webStyles.planPrice, { color: meta.color }]}>{plan.price}</Text>
                                        <Text style={[webStyles.planPeriod, { color: c.textTertiary }]}>{plan.period}</Text>
                                        {isCurrent && (
                                            <View style={[webStyles.activePill, { backgroundColor: 'rgba(52,211,153,0.1)', borderColor: 'rgba(52,211,153,0.3)' }]}>
                                                <View style={[webStyles.activeDot, { backgroundColor: '#34D399' }]} />
                                                <Text style={{ color: '#34D399', fontSize: 11, fontWeight: '700' }}>ACTIVE</Text>
                                            </View>
                                        )}
                                    </View>

                                    {/* Divider */}
                                    <View style={[webStyles.divider, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }]} />

                                    {/* Features */}
                                    <View style={webStyles.featureList}>
                                        {plan.features.map((f: string, i: number) => (
                                            <View key={i} style={webStyles.featureRow}>
                                                <View style={[webStyles.checkCircle, { backgroundColor: meta.color + '15' }]}>
                                                    <Ionicons name="checkmark" size={11} color={meta.color} />
                                                </View>
                                                <Text style={[webStyles.featureText, { color: c.text }]}>{f}</Text>
                                            </View>
                                        ))}
                                    </View>

                                    {/* CTA Button */}
                                    {isCurrent ? (
                                        <View style={[webStyles.ctaBtn, { backgroundColor: 'rgba(52,211,153,0.08)', borderWidth: 1, borderColor: 'rgba(52,211,153,0.3)' }]}>
                                            <Ionicons name="checkmark-circle" size={18} color="#34D399" />
                                            <Text style={[webStyles.ctaBtnText, { color: '#34D399' }]}>Current Plan</Text>
                                        </View>
                                    ) : isComingSoon ? (
                                        <View style={[webStyles.ctaBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F3F4F6' }]}>
                                            <Text style={[webStyles.ctaBtnText, { color: c.textTertiary }]}>Coming Soon</Text>
                                        </View>
                                    ) : (
                                        <TouchableOpacity
                                            onPress={() => handleSelectPlan(planKey)}
                                            disabled={!!selectingPlan || isRefreshing}
                                            activeOpacity={0.85}
                                        >
                                            <LinearGradient
                                                colors={meta.gradient as any}
                                                start={{ x: 0, y: 0 }}
                                                end={{ x: 1, y: 0 }}
                                                style={[webStyles.ctaBtn, { opacity: selectingPlan === planKey ? 0.7 : 1 }]}
                                            >
                                                {selectingPlan === planKey ? (
                                                    <ActivityIndicator size="small" color="#fff" />
                                                ) : (
                                                    <>
                                                        <Text style={[webStyles.ctaBtnText, { color: '#fff' }]}>Get Started</Text>
                                                        <Ionicons name="arrow-forward" size={16} color="#fff" />
                                                    </>
                                                )}
                                            </LinearGradient>
                                        </TouchableOpacity>
                                    )}

                                    {!isCurrent && !isComingSoon && (
                                        <View style={webStyles.secureRow}>
                                            <Ionicons name="lock-closed" size={11} color={c.textTertiary} />
                                            <Text style={[webStyles.secureText, { color: c.textTertiary }]}>Secure Tradebox Checkout</Text>
                                        </View>
                                    )}
                                </View>
                            );
                        })}
                    </Animated.View>

                    {/* ── Money-back / trust section ── */}
                    <View style={[webStyles.guaranteeCard, {
                        backgroundColor: isDark ? '#111827' : '#fff',
                        borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(31,70,144,0.08)',
                        ...(Platform.OS === 'web' ? { boxShadow: isDark ? '0 4px 40px rgba(0,0,0,0.3)' : '0 4px 40px rgba(31,70,144,0.06)' } as any : {}),
                    }]}>
                        <LinearGradient colors={['#1F4690', '#3A5BA0']} style={webStyles.guaranteeIcon}>
                            <Ionicons name="shield-checkmark" size={26} color="#fff" />
                        </LinearGradient>
                        <View style={{ flex: 1 }}>
                            <Text style={[webStyles.guaranteeTitle, { color: c.text }]}>100% Satisfaction Guarantee</Text>
                            <Text style={[webStyles.guaranteeSub, { color: c.textSecondary }]}>
                                Not satisfied? We offer a prorated refund based on unused months. Your trust is our priority.
                            </Text>
                        </View>
                        <View style={[webStyles.sebiTag, {
                            backgroundColor: isDark ? 'rgba(31,70,144,0.15)' : 'rgba(31,70,144,0.07)',
                            borderColor: 'rgba(31,70,144,0.2)',
                        }]}>
                            <Ionicons name="ribbon" size={14} color={Colors.brand.secondary} />
                            <Text style={[webStyles.sebiTagText, { color: Colors.brand.secondary }]}>SEBI RA · INH000069807</Text>
                        </View>
                    </View>

                    <SubscriptionComparison />
                    <View style={{ height: 80 }} />
                </ResponsiveScrollView>
            </View>
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MOBILE LAYOUT
    // ─────────────────────────────────────────────────────────────────────────
    return (
        <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>

            {/* Mobile header */}
            <LinearGradient
                colors={['#1F4690', '#1e3a8a']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.mobileHeader}
            >
                <View style={styles.mobileHeaderRow}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Ionicons name="chevron-back" size={22} color="#fff" />
                    </TouchableOpacity>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.mobileHeaderTitle}>Subscription Plans</Text>
                        <Text style={styles.mobileHeaderSub}>Wealth creation through expert research</Text>
                    </View>
                    {isRefreshing ? (
                        <ActivityIndicator size="small" color="#fff" />
                    ) : (
                        <View style={styles.headerBadge}>
                            <Ionicons name="shield-checkmark" size={11} color="rgba(255,255,255,0.8)" />
                            <Text style={styles.headerBadgeText}>SECURE</Text>
                        </View>
                    )}
                </View>
            </LinearGradient>

            {/* Current plan banner */}
            {currentPlan && (
                <View style={[styles.activeBanner, { backgroundColor: c.background, borderColor: c.success + '40' }]}>
                    <LinearGradient colors={[c.success, c.success + 'CC']} style={styles.activeIndicator}>
                        <Ionicons name="checkmark-sharp" size={13} color="#fff" />
                    </LinearGradient>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.activeBannerTitle, { color: c.text }]}>
                            Current: <Text style={{ fontWeight: '800', color: c.success }}>{PLANS[currentPlan]?.name}</Text>
                        </Text>
                        {subscription?.expires_at && (
                            <Text style={[styles.activeBannerSub, { color: c.textTertiary }]}>
                                Active until {new Date(subscription.expires_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </Text>
                        )}
                        {(PLANS[currentPlan as PlanKey] as any)?.telegramUrl && (
                            <TouchableOpacity
                                style={styles.telegramBtn}
                                onPress={() => Linking.openURL((PLANS[currentPlan as PlanKey] as any).telegramUrl)}
                            >
                                <Ionicons name="paper-plane" size={13} color="#fff" />
                                <Text style={styles.telegramBtnText}>Join PRO Telegram Group</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            )}

            <ResponsiveScrollView contentContainerStyle={styles.mobileContent}>
                {/* Secure info strip */}
                <View style={[styles.infoBanner, { backgroundColor: c.surface, borderColor: c.border }]}>
                    <View style={[styles.infoIconBox, { backgroundColor: Colors.brand.secondary + '15' }]}>
                        <Ionicons name="lock-closed" size={16} color={Colors.brand.secondary} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.infoBannerTitle, { color: c.text }]}>Secure Transaction</Text>
                        <Text style={[styles.infoBannerSub, { color: c.textTertiary }]}>Checkout via Tradebox's secure payment gateway.</Text>
                    </View>
                </View>

                {planOrder.map((planKey) => {
                    const plan = PLANS[planKey];
                    const meta = planMeta[planKey];
                    const isCurrent = planKey === currentPlan;
                    const isHighlight = planKey === 'all_in_growth';
                    const isComingSoon = !plan.tradeboxUrl;

                    return (
                        <Card key={planKey} theme={theme} style={[styles.planCard, isHighlight && { borderColor: meta.color + '60', borderWidth: 2 }]}>
                            {isHighlight && (
                                <LinearGradient colors={meta.gradient as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.popularBadge}>
                                    <Ionicons name="star" size={9} color="#fff" />
                                    <Text style={styles.popularText}>BEST VALUE</Text>
                                </LinearGradient>
                            )}
                            {isComingSoon && !isHighlight && (
                                <View style={[styles.popularBadge, { backgroundColor: '#6B7280' }]}>
                                    <Text style={styles.popularText}>COMING SOON</Text>
                                </View>
                            )}

                            <View style={styles.planHeader}>
                                <LinearGradient colors={meta.gradient as any} style={styles.planIconCircle}>
                                    <Ionicons name={meta.icon} size={20} color="#fff" />
                                </LinearGradient>
                                <View style={{ flex: 1, marginLeft: 12 }}>
                                    <Text style={[styles.planName, { color: c.text }]} numberOfLines={2}>{plan.name}</Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap' }}>
                                        <Text style={[styles.planPrice, { color: meta.color }]}>{plan.price}</Text>
                                        <Text style={[styles.planPeriod, { color: c.textTertiary }]}>{plan.period}</Text>
                                    </View>
                                </View>
                                {isCurrent && (
                                    <View style={[styles.currentBadge, { backgroundColor: c.successBg }]}>
                                        <Text style={{ color: c.success, fontSize: 10, fontWeight: '700' }}>ACTIVE</Text>
                                    </View>
                                )}
                            </View>

                            <Text style={[styles.planDescription, { color: c.textSecondary }]}>{plan.description}</Text>

                            <View style={[styles.featureList, { borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }]}>
                                {plan.features.map((f: string, i: number) => (
                                    <View key={i} style={styles.featureRow}>
                                        <View style={[styles.checkCircle, { backgroundColor: meta.color + '15' }]}>
                                            <Ionicons name="checkmark" size={11} color={meta.color} />
                                        </View>
                                        <Text style={[styles.featureText, { color: c.text }]}>{f}</Text>
                                    </View>
                                ))}
                            </View>

                            <TouchableOpacity
                                style={[styles.planButton]}
                                onPress={() => !isCurrent && !isComingSoon && handleSelectPlan(planKey)}
                                disabled={isCurrent || isComingSoon || !!selectingPlan || isRefreshing}
                                activeOpacity={0.85}
                            >
                                {isCurrent ? (
                                    <View style={[styles.planButtonInner, { backgroundColor: c.successBg }]}>
                                        <Ionicons name="checkmark-circle" size={16} color={c.success} />
                                        <Text style={[styles.planBtnText, { color: c.success }]}>Current Plan</Text>
                                    </View>
                                ) : isComingSoon ? (
                                    <View style={[styles.planButtonInner, { backgroundColor: c.border }]}>
                                        <Text style={[styles.planBtnText, { color: c.textSecondary }]}>Coming Soon</Text>
                                    </View>
                                ) : (
                                    <LinearGradient
                                        colors={meta.gradient as any}
                                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                                        style={[styles.planButtonInner, { opacity: selectingPlan === planKey ? 0.7 : 1 }]}
                                    >
                                        {selectingPlan === planKey ? (
                                            <ActivityIndicator size="small" color="#fff" />
                                        ) : (
                                            <>
                                                <Text style={[styles.planBtnText, { color: '#fff' }]}>Subscribe Now</Text>
                                                <Ionicons name="arrow-forward" size={16} color="#fff" />
                                            </>
                                        )}
                                    </LinearGradient>
                                )}
                            </TouchableOpacity>

                            {!isCurrent && !isComingSoon && (
                                <View style={styles.payNoteRow}>
                                    <Ionicons name="lock-closed" size={10} color={c.textTertiary} />
                                    <Text style={[styles.payNoteText, { color: c.textTertiary }]}>Secure Tradebox Checkout</Text>
                                </View>
                            )}
                        </Card>
                    );
                })}

                <SubscriptionComparison />
                <View style={{ height: 40 }} />
            </ResponsiveScrollView>
        </SafeAreaView>
    );
}

// ─── Web Styles ───────────────────────────────────────────────────────────────
const webStyles = StyleSheet.create({
    root: { flex: 1 },

    // Navbar
    navbar: {
        height: 64,
        justifyContent: 'center',
        borderBottomWidth: 1,
        paddingHorizontal: 32,
        ...(Platform.OS === 'web' ? { position: 'sticky', top: 0, zIndex: 200 } as any : {}),
    },
    navbarInner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        maxWidth: 1200,
        width: '100%',
        alignSelf: 'center',
    },
    navBack: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 8,
        borderWidth: 1,
    },
    navBackText: { fontSize: 14, fontWeight: '600' },
    navCenter: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    navLogoGrad: {
        width: 30, height: 30, borderRadius: 8,
        justifyContent: 'center', alignItems: 'center',
    },
    navTitle: { fontSize: 16, fontWeight: '700' },
    navRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    navBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
    navBadgeText: { fontSize: 13, fontWeight: '600' },

    // Scroll content
    scrollContent: {
        paddingHorizontal: 40,
        paddingTop: 60,
        paddingBottom: 80,
        maxWidth: 1200,
        width: '100%',
        alignSelf: 'center',
    },

    // Hero
    hero: { alignItems: 'center', marginBottom: 48, position: 'relative' },
    orb: {
        position: 'absolute',
        width: 400,
        height: 400,
        borderRadius: 200,
        ...(Platform.OS === 'web' ? { filter: 'blur(80px)' } as any : {}),
    },
    orbLeft: { left: -100, top: -60 },
    orbRight: { right: -100, top: -30 },
    heroBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
        marginBottom: 20,
    },
    heroBadgeText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
    heroTitle: {
        fontSize: 52,
        fontWeight: '800',
        textAlign: 'center',
        letterSpacing: -1.5,
        lineHeight: 60,
        marginBottom: 16,
    },
    heroSub: {
        fontSize: 17,
        textAlign: 'center',
        maxWidth: 520,
        lineHeight: 26,
        marginBottom: 32,
    },
    trustRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 10,
    },
    trustItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 20,
        borderWidth: 1,
    },
    trustText: { fontSize: 13, fontWeight: '600' },

    // Active plan ribbon
    activeRibbon: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 32,
        flexWrap: 'wrap',
    },
    activeRibbonDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#34D399' },
    activeRibbonText: { fontSize: 14, fontWeight: '600', flex: 1 },

    // Telegram button (shared between layouts)
    telegramBtn: {
        backgroundColor: '#0088cc',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
    telegramBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

    // Grid
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 24,
        marginBottom: 40,
    },

    // Plan card
    planCard: {
        flex: 1,
        flexBasis: '45%',
        minWidth: 280,
        borderRadius: 20,
        borderWidth: 1,
        padding: 28,
        position: 'relative',
        overflow: 'hidden',
    },
    bestBadge: {
        position: 'absolute',
        top: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderBottomLeftRadius: 16,
    },
    bestBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
    planIconGrad: {
        width: 52, height: 52,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    planName: { fontSize: 20, fontWeight: '800', marginBottom: 4, letterSpacing: -0.3 },
    planDesc: { fontSize: 14, lineHeight: 20, marginBottom: 16 },
    priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginBottom: 20, flexWrap: 'wrap' },
    planPrice: { fontSize: 32, fontWeight: '800', letterSpacing: -1 },
    planPeriod: { fontSize: 14 },
    activePill: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        paddingHorizontal: 10, paddingVertical: 4,
        borderRadius: 20, borderWidth: 1, marginLeft: 8,
    },
    activeDot: { width: 6, height: 6, borderRadius: 3 },
    divider: { height: 1, marginBottom: 20 },
    featureList: { marginBottom: 24, gap: 10 },
    featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    checkCircle: { width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
    featureText: { fontSize: 14, fontWeight: '500', flex: 1 },
    ctaBtn: {
        height: 52,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'row',
        gap: 8,
    },
    ctaBtnText: { fontSize: 15, fontWeight: '800' },
    secureRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 10 },
    secureText: { fontSize: 12, fontWeight: '500' },

    // Guarantee card
    guaranteeCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 20,
        borderRadius: 20,
        borderWidth: 1,
        padding: 24,
        marginBottom: 40,
        flexWrap: 'wrap',
    },
    guaranteeIcon: {
        width: 56, height: 56,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    guaranteeTitle: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
    guaranteeSub: { fontSize: 14, lineHeight: 20, maxWidth: 500 },
    sebiTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 12,
        borderWidth: 1,
    },
    sebiTagText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
});

// ─── Mobile Styles ────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: { flex: 1 },
    mobileHeader: {
        paddingTop: Platform.select({ ios: 4, default: 12 }),
        paddingBottom: 14,
        paddingHorizontal: Spacing.xl,
    },
    mobileHeaderRow: { flexDirection: 'row', alignItems: 'center' },
    mobileHeaderTitle: { fontSize: 18, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
    mobileHeaderSub: { fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 1 },
    backBtn: {
        width: 38, height: 38, borderRadius: 12,
        justifyContent: 'center', alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.15)',
    },
    headerBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999,
    },
    headerBadgeText: { fontSize: 9, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
    activeBanner: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        marginHorizontal: Spacing.xl, marginTop: 12, marginBottom: 4,
        padding: 14, borderRadius: BorderRadius.xl, borderWidth: 1,
    },
    activeIndicator: { width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
    activeBannerTitle: { fontSize: FontSize.sm, fontWeight: '600' },
    activeBannerSub: { fontSize: 11, marginTop: 2 },
    telegramBtn: {
        marginTop: 8, backgroundColor: '#0088cc',
        paddingVertical: 6, paddingHorizontal: 10,
        borderRadius: 8, flexDirection: 'row', alignItems: 'center',
        alignSelf: 'flex-start', gap: 5,
    },
    telegramBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
    mobileContent: { padding: Spacing.xl },
    infoBanner: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        padding: 14, borderRadius: BorderRadius.xl, borderWidth: 1, marginBottom: Spacing.xl,
    },
    infoIconBox: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    infoBannerTitle: { fontSize: FontSize.sm, fontWeight: '700' },
    infoBannerSub: { fontSize: FontSize.xs, lineHeight: 16, marginTop: 1 },
    planCard: {
        padding: 18, marginBottom: Spacing.xl,
        overflow: 'hidden', position: 'relative', borderRadius: BorderRadius['2xl'],
    },
    popularBadge: {
        position: 'absolute', top: 0, right: 0,
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 12, paddingVertical: 5, borderBottomLeftRadius: 16,
    },
    popularText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
    planHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    planIconCircle: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    planName: { fontSize: 17, fontWeight: '800', letterSpacing: -0.2 },
    planPrice: { fontSize: 22, fontWeight: '800' },
    planPeriod: { fontSize: FontSize.sm, marginLeft: 4 },
    planDescription: { fontSize: 13, lineHeight: 20, marginBottom: 16 },
    currentBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: BorderRadius.full },
    featureList: { marginBottom: 18, paddingTop: 14, borderTopWidth: 1, gap: 10 },
    featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    checkCircle: { width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
    featureText: { fontSize: 13, flex: 1, fontWeight: '500' },
    planButton: { borderRadius: 14, overflow: 'hidden' },
    planButtonInner: {
        height: 48, flexDirection: 'row',
        justifyContent: 'center', alignItems: 'center', gap: 8,
    },
    planBtnText: { fontSize: 15, fontWeight: '800' },
    payNoteRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 10 },
    payNoteText: { fontSize: 11, fontWeight: '600' },
});
