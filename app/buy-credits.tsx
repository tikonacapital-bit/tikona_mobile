import { BorderRadius, Colors, FontSize, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useCallback, useEffect, useRef } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// ─── Credit Plans ──────────────────────────────────────────────────────────────
const CREDIT_PLANS = [
    {
        id: 'pack_100',
        title: 'Starter Pack',
        credits: 100,
        price: '₹99',
        pricePerCredit: '₹0.99',
        popular: false,
        icon: 'flash-outline' as const,
        desc: 'Perfect for occasional research.',
        gradient: ['#6366f1', '#8b5cf6'],
    },
    {
        id: 'pack_500',
        title: 'Pro Pack',
        credits: 500,
        price: '₹399',
        pricePerCredit: '₹0.80',
        popular: true,
        icon: 'diamond-outline' as const,
        desc: 'Most popular for active investors.',
        gradient: ['#f59e0b', '#ef4444'],
        savings: 'Save 19%',
    },
    {
        id: 'pack_2000',
        title: 'Whale Pack',
        credits: 2000,
        price: '₹1,499',
        pricePerCredit: '₹0.75',
        popular: false,
        icon: 'rocket-outline' as const,
        desc: 'Best value for power users.',
        gradient: ['#10b981', '#059669'],
        savings: 'Save 24%',
    },
];

// ─── Polling Config ────────────────────────────────────────────────────────────
const POLL_INTERVAL_MS = 3000;     // check every 3 seconds
const MAX_POLL_DURATION_MS = 120000; // stop after 2 minutes

export default function BuyCreditsScreen() {
    const theme = useColorScheme();
    const c = Colors[theme];
    const isDark = theme === 'dark';
    const { userId, wallet, refreshWallet } = useAuth();

    const [isProcessing, setIsProcessing] = React.useState<string | null>(null);
    const [isPolling, setIsPolling] = React.useState(false);
    const [pollMessage, setPollMessage] = React.useState('');
    const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const pollStartRef = useRef<number>(0);

    // Animated pulse for balance
    const pulseAnim = useRef(new Animated.Value(1)).current;

    // Clean up polling on unmount
    useEffect(() => {
        return () => {
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
        };
    }, []);

    // Pulse animation when polling succeeds
    const triggerPulse = useCallback(() => {
        Animated.sequence([
            Animated.timing(pulseAnim, { toValue: 1.15, duration: 200, useNativeDriver: true }),
            Animated.timing(pulseAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        ]).start();
    }, [pulseAnim]);

    // ── Start polling wallet for updated balance ──────────────────────────────
    const startPolling = useCallback((expectedMinBalance: number) => {
        setIsPolling(true);
        setPollMessage('Waiting for Razorpay confirmation...');
        pollStartRef.current = Date.now();

        pollTimerRef.current = setInterval(async () => {
            const elapsed = Date.now() - pollStartRef.current;

            // Timeout guard
            if (elapsed > MAX_POLL_DURATION_MS) {
                if (pollTimerRef.current) clearInterval(pollTimerRef.current);
                setIsPolling(false);
                setPollMessage('');
                const msg = 'Payment is being processed. Credits will appear shortly — pull down to refresh.';
                if (Platform.OS === 'web') alert(msg);
                else Alert.alert('Still Processing', msg);
                return;
            }

            // Check balance
            await refreshWallet();
        }, POLL_INTERVAL_MS);
    }, [refreshWallet]);

    // Watch wallet changes during polling — stop when balance increases
    const prevBalanceRef = useRef<number>(wallet?.credits_balance ?? 0);
    useEffect(() => {
        const currentBalance = wallet?.credits_balance ?? 0;
        if (isPolling && currentBalance > prevBalanceRef.current) {
            // Credits arrived!
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
            setIsPolling(false);
            setPollMessage('');
            triggerPulse();

            const gained = currentBalance - prevBalanceRef.current;
            const msg = `🎉 ${gained} credits added! New balance: ${currentBalance}`;
            if (Platform.OS === 'web') alert(msg);
            else Alert.alert('Credits Added!', msg);

            prevBalanceRef.current = currentBalance;
        } else {
            prevBalanceRef.current = currentBalance;
        }
    }, [wallet?.credits_balance, isPolling, triggerPulse]);

    // ── Handle Purchase ─────────────────────────────────────────────────────────
    const handleBuy = async (plan: typeof CREDIT_PLANS[0]) => {
        if (isProcessing || isPolling) return;
        setIsProcessing(plan.id);

        try {
            if (!userId) {
                const msg = 'Please login to continue.';
                if (Platform.OS === 'web') alert(msg);
                else Alert.alert('Error', msg);
                return;
            }

            // Record current balance before payment
            prevBalanceRef.current = wallet?.credits_balance ?? 0;

            // 1. Create secure Razorpay payment link via edge function
            const { data, error } = await supabase.functions.invoke('create-razorpay-link', {
                body: { plan_id: plan.id },
            });

            if (error || !data?.payment_link) {
                console.error('[BuyCredits] Function error:', error || data);
                const msg = 'Could not generate payment link. Please try again.';
                if (Platform.OS === 'web') alert(msg);
                else Alert.alert('Payment Setup Failed', msg);
                return;
            }

            // 2. Open Razorpay checkout
            if (Platform.OS === 'web') {
                window.location.href = data.payment_link;
            } else {
                await WebBrowser.openAuthSessionAsync(
                    data.payment_link,
                    'tikonamobile://payment-success'
                );
            }

            // 3. Start polling for credit arrival
            const expectedMin = (wallet?.credits_balance ?? 0) + plan.credits;
            startPolling(expectedMin);

        } catch (e) {
            console.error('[BuyCredits] Error:', e);
            const msg = 'Could not open payment gateway.';
            if (Platform.OS === 'web') alert(msg);
            else Alert.alert('Payment Failed', msg);
        } finally {
            setIsProcessing(null);
        }
    };

    const currentBalance = wallet?.credits_balance ?? 0;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
            {/* ── Header ────────────────────────────────────────────────────── */}
            <View style={[styles.header, { borderBottomColor: c.border }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
                    <Ionicons name="chevron-back" size={24} color={c.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: c.text }]}>Buy AI Credits</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

                {/* ── Wallet Balance Card ─────────────────────────────────── */}
                <Animated.View style={[styles.walletCard, { backgroundColor: isDark ? '#1e1b4b' : '#EEF2FF', borderColor: isDark ? '#312e81' : '#c7d2fe', transform: [{ scale: pulseAnim }] }]}>
                    <View style={styles.walletIconRow}>
                        <View style={[styles.walletIconBg, { backgroundColor: Colors.brand.accent + '22' }]}>
                            <Ionicons name="flash" size={28} color={Colors.brand.accent} />
                        </View>
                        {isPolling && (
                            <View style={styles.pollingBadge}>
                                <ActivityIndicator size="small" color={Colors.brand.primary} />
                                <Text style={[styles.pollingText, { color: Colors.brand.primary }]}>
                                    {pollMessage || 'Checking...'}
                                </Text>
                            </View>
                        )}
                    </View>
                    <Text style={[styles.balanceLabel, { color: isDark ? '#a5b4fc' : '#6366f1' }]}>Current Balance</Text>
                    <Text style={[styles.balanceValue, { color: c.text }]}>{currentBalance.toLocaleString('en-IN')}</Text>
                    <Text style={[styles.balanceUnit, { color: c.textTertiary }]}>AI Credits</Text>
                </Animated.View>

                {/* ── Plans ─────────────────────────────────────────────── */}
                <Text style={[styles.sectionTitle, { color: c.text }]}>Top Up Your Credits</Text>

                <View style={styles.plansContainer}>
                    {CREDIT_PLANS.map((plan) => {
                        const isActive = isProcessing === plan.id;
                        return (
                            <View
                                key={plan.id}
                                style={[
                                    styles.planCard,
                                    {
                                        backgroundColor: c.surface,
                                        borderColor: plan.popular ? Colors.brand.primary : c.border,
                                        borderWidth: plan.popular ? 2 : 1,
                                    },
                                ]}
                            >
                                {/* Popular / Savings badge */}
                                {plan.popular && (
                                    <View style={styles.popularBadge}>
                                        <Text style={styles.popularText}>⭐ MOST POPULAR</Text>
                                    </View>
                                )}
                                {plan.savings && !plan.popular && (
                                    <View style={[styles.savingsBadge, { backgroundColor: '#10b981' }]}>
                                        <Text style={styles.savingsText}>{plan.savings}</Text>
                                    </View>
                                )}

                                <View style={styles.planHeader}>
                                    <View style={styles.planInfo}>
                                        <View style={styles.planTitleRow}>
                                            <Ionicons name={plan.icon} size={20} color={Colors.brand.primary} />
                                            <Text style={[styles.planTitle, { color: c.text }]}>{plan.title}</Text>
                                        </View>
                                        <View style={styles.creditsRow}>
                                            <Text style={[styles.planCredits, { color: Colors.brand.primary }]}>
                                                {plan.credits.toLocaleString('en-IN')} Credits
                                            </Text>
                                            <Text style={[styles.perCredit, { color: c.textTertiary }]}>
                                                ({plan.pricePerCredit}/credit)
                                            </Text>
                                        </View>
                                    </View>
                                    <Text style={[styles.planPrice, { color: c.text }]}>{plan.price}</Text>
                                </View>

                                <Text style={[styles.planDesc, { color: c.textSecondary }]}>{plan.desc}</Text>

                                <TouchableOpacity
                                    style={[
                                        styles.buyBtn,
                                        {
                                            backgroundColor: plan.popular ? Colors.brand.primary : isDark ? '#374151' : '#f3f4f6',
                                            opacity: isProcessing || isPolling ? 0.6 : 1,
                                        },
                                    ]}
                                    onPress={() => handleBuy(plan)}
                                    disabled={!!isProcessing || isPolling}
                                    activeOpacity={0.8}
                                >
                                    {isActive ? (
                                        <ActivityIndicator size="small" color={plan.popular ? '#fff' : Colors.brand.primary} />
                                    ) : (
                                        <View style={styles.buyBtnContent}>
                                            <Ionicons
                                                name="card-outline"
                                                size={18}
                                                color={plan.popular ? '#fff' : Colors.brand.primary}
                                            />
                                            <Text
                                                style={[
                                                    styles.buyBtnText,
                                                    { color: plan.popular ? '#fff' : Colors.brand.primary },
                                                ]}
                                            >
                                                Buy Now
                                            </Text>
                                        </View>
                                    )}
                                </TouchableOpacity>
                            </View>
                        );
                    })}
                </View>

                {/* ── Security Badge ─────────────────────────────────────── */}
                <View style={[styles.securityBadge, { backgroundColor: isDark ? '#064e3b' : '#ecfdf5', borderColor: isDark ? '#065f46' : '#a7f3d0' }]}>
                    <Ionicons name="shield-checkmark" size={18} color="#10b981" />
                    <Text style={[styles.securityText, { color: isDark ? '#6ee7b7' : '#065f46' }]}>
                        Secured by Razorpay • 256-bit SSL Encrypted
                    </Text>
                </View>

                {/* ── Explanation Section ────────────────────────────────── */}
                <View style={[styles.infoBox, { backgroundColor: isDark ? c.surfaceElevated : '#EFF6FF', borderColor: c.border }]}>
                    <View style={styles.infoHeader}>
                        <Ionicons name="information-circle" size={18} color={Colors.brand.secondary} />
                        <Text style={[styles.infoBoxTitle, { color: Colors.brand.secondary }]}>
                            How are credits calculated?
                        </Text>
                    </View>

                    <View style={styles.infoRow}>
                        <Text style={styles.infoDot}>•</Text>
                        <Text style={[styles.infoText, { color: c.textSecondary }]}>
                            <Text style={{ fontWeight: '700', color: c.text }}>1 Credit</Text> is deducted for each
                            Text message sent to the Sector AI or Report AI.
                        </Text>
                    </View>

                    <View style={styles.infoRow}>
                        <Text style={styles.infoDot}>•</Text>
                        <Text style={[styles.infoText, { color: c.textSecondary }]}>
                            <Text style={{ fontWeight: '700', color: c.text }}>2 Credits</Text> are deducted for
                            Voice Mode interactions (AI processing + Audio generation).
                        </Text>
                    </View>

                    <View style={styles.infoRow}>
                        <Text style={styles.infoDot}>•</Text>
                        <Text style={[styles.infoText, { color: c.textSecondary }]}>
                            Credits <Text style={{ fontWeight: '700', color: c.text }}>never expire</Text> and carry
                            over. Subscription plans also grant free monthly credits.
                        </Text>
                    </View>

                    <View style={styles.infoRow}>
                        <Text style={styles.infoDot}>•</Text>
                        <Text style={[styles.infoText, { color: c.textSecondary }]}>
                            After payment, credits are added{' '}
                            <Text style={{ fontWeight: '700', color: c.text }}>automatically within 30 seconds</Text>.
                            No manual activation needed.
                        </Text>
                    </View>
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.xl,
        paddingVertical: Spacing.md,
        borderBottomWidth: 1,
    },
    backBtn: { padding: Spacing.xs },
    headerTitle: { fontSize: FontSize.lg, fontWeight: '700' },
    content: { padding: Spacing.xl },

    // Wallet card
    walletCard: {
        borderRadius: BorderRadius.xl,
        borderWidth: 1,
        padding: Spacing['2xl'],
        marginBottom: Spacing['2xl'],
        alignItems: 'center',
    },
    walletIconRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        marginBottom: Spacing.md,
        width: '100%',
    },
    walletIconBg: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    balanceLabel: { fontSize: FontSize.sm, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' },
    balanceValue: { fontSize: 42, fontWeight: '800', marginTop: 4 },
    balanceUnit: { fontSize: FontSize.sm, fontWeight: '500', marginTop: 2 },

    // Polling indicator
    pollingBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: BorderRadius.full,
    },
    pollingText: { fontSize: 11, fontWeight: '600' },

    // Section
    sectionTitle: { fontSize: FontSize.lg, fontWeight: '700', marginBottom: Spacing.lg },

    // Plans
    plansContainer: { gap: Spacing.lg },
    planCard: {
        borderRadius: BorderRadius.xl,
        padding: Spacing.xl,
        position: 'relative',
    },
    popularBadge: {
        position: 'absolute',
        top: -12,
        right: 20,
        backgroundColor: Colors.brand.primary,
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: BorderRadius.full,
    },
    popularText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
    savingsBadge: {
        position: 'absolute',
        top: -10,
        right: 20,
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: BorderRadius.full,
    },
    savingsText: { color: '#fff', fontSize: 10, fontWeight: '800' },

    planHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: Spacing.sm,
    },
    planInfo: { flex: 1 },
    planTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 4,
    },
    planTitle: { fontSize: FontSize.lg, fontWeight: '700' },
    creditsRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    planCredits: { fontSize: FontSize.base, fontWeight: '600' },
    perCredit: { fontSize: FontSize.xs },
    planPrice: { fontSize: FontSize.xl, fontWeight: '800' },
    planDesc: { fontSize: FontSize.sm, marginBottom: Spacing.lg },

    buyBtn: {
        borderRadius: BorderRadius.lg,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buyBtnContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    buyBtnText: { fontSize: FontSize.md, fontWeight: '700' },

    // Security
    securityBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        paddingVertical: 10,
        paddingHorizontal: Spacing.lg,
        marginTop: Spacing.xl,
        marginBottom: Spacing.sm,
    },
    securityText: { fontSize: FontSize.xs, fontWeight: '600' },

    // Info box
    infoBox: {
        marginTop: Spacing.lg,
        padding: Spacing.lg,
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
    },
    infoHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: Spacing.md,
    },
    infoBoxTitle: {
        fontSize: FontSize.base,
        fontWeight: '700',
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        marginBottom: 8,
    },
    infoDot: {
        fontSize: 14,
        lineHeight: 20,
        color: Colors.brand.secondary,
        fontWeight: '900',
    },
    infoText: {
        flex: 1,
        fontSize: FontSize.sm,
        lineHeight: 20,
    },
});
