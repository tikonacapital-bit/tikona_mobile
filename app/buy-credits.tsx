import { BorderRadius, Colors, FontSize, Spacing } from '@/constants/theme';
import { useAlert } from '@/context/AlertContext';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef } from 'react';
import {
    ActivityIndicator,
    AppState,
    Linking,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// ─── Display conversion: 1 display credit = ₹1 ─────────────────────────────
// Internally tokens are stored at ~502 tokens per ₹1. We divide raw token
// balance by this constant so users see a ₹-equivalent number everywhere.
const TOKENS_PER_DISPLAY_CREDIT = 502;
const toDisplayCredits = (tokens: number) => Math.round(tokens / TOKENS_PER_DISPLAY_CREDIT);
const formatDisplayCredits = (dc: number) =>
    dc >= 1000000 ? `${(dc / 1000000).toFixed(1)}M` : dc >= 1000 ? `${(dc / 1000).toFixed(1)}K` : `${dc}`;

// ─── Credit Plans ───────────────────────────────────────────────────────────
// `credits` = actual tokens granted (backend). Labels show ₹-equivalent for users.
const CREDIT_PLANS = [
    {
        id: 'pack_299',
        title: 'Starter Pack',
        credits: 150000,
        creditsLabel: '300',
        price: '₹299',
        amountPaise: 29900,
        pricePerCredit: '~30 chats',
        popular: false,
        icon: 'flash-outline' as const,
        desc: 'Perfect for occasional research queries.',
        gradient: ['#6366f1', '#8b5cf6'],
        tradeboxUrl: 'https://tradeboxlive.com/view/services/69d8e777e2c321d96b8b252c',
    },
    {
        id: 'pack_999',
        title: 'Pro Pack',
        credits: 600000,
        creditsLabel: '1,100',
        price: '₹999',
        amountPaise: 99900,
        pricePerCredit: '~110 chats',
        popular: true,
        icon: 'diamond-outline' as const,
        desc: 'Most popular for active investors.',
        gradient: ['#f59e0b', '#ef4444'],
        savings: '10% Extra',
        tradeboxUrl: 'https://tradeboxlive.com/view/services/69d8e809e2c321d96b8b25d0',
    },
    {
        id: 'pack_4999',
        title: 'Whale Pack',
        credits: 3750000,
        creditsLabel: '6,250',
        price: '₹4,999',
        amountPaise: 499900,
        pricePerCredit: '~625 chats',
        popular: false,
        icon: 'rocket-outline' as const,
        desc: 'Best value for power users.',
        gradient: ['#10b981', '#059669'],
        savings: '25% Extra',
        tradeboxUrl: 'https://tradeboxlive.com/view/services/69d8e87be2c321d96b8b267a',
    },
];

export default function BuyCreditsScreen() {
    const theme = useColorScheme();
    const c = Colors[theme];
    const isDark = theme === 'dark';
    const { userId, user, wallet, refreshWallet } = useAuth();
    const { showAlert } = useAlert();
    const userEmail = user?.primaryEmailAddress?.emailAddress || '';

    const [isProcessing, setIsProcessing] = React.useState<string | null>(null);
    const [isRefreshing, setIsRefreshing] = React.useState(false);

    // ── Track payment redirect so we can poll on return ─────────────────
    const isRedirectingRef = useRef(false);
    const prevBalanceRef = useRef<number>(wallet?.credits_balance ?? 0);
    const walletBalanceRef = useRef<number>(wallet?.credits_balance ?? 0);

    // Keep refs in sync — but only update prevBalance when NOT polling
    useEffect(() => {
        walletBalanceRef.current = wallet?.credits_balance ?? 0;
        if (!isRefreshing) {
            prevBalanceRef.current = wallet?.credits_balance ?? 0;
        }
    }, [wallet?.credits_balance, isRefreshing]);

    // ── Poll refreshWallet when user returns from Tradebox ──────────────
    const handleAppFocus = useCallback(async () => {
        if (!isRedirectingRef.current) return;
        isRedirectingRef.current = false;
        setIsRefreshing(true);

        const balanceBefore = prevBalanceRef.current;

        try {
            for (let i = 0; i < 5; i++) {
                await new Promise(resolve => setTimeout(resolve, i === 0 ? 2000 : 3000));
                await refreshWallet();
                // Check early — no need to keep polling if credits arrived
                if (walletBalanceRef.current > balanceBefore) break;
            }
        } finally {
            setIsRefreshing(false);
            // Read from ref (always latest) instead of closure (stale)
            const newBalance = walletBalanceRef.current;
            if (newBalance > balanceBefore) {
                const added = toDisplayCredits(newBalance - balanceBefore);
                showAlert(
                    '🎉 Credits Added!',
                    `${formatDisplayCredits(added)} credits have been added to your account.`,
                    [{ text: 'Awesome!' }]
                );
            }
        }
    }, [refreshWallet, showAlert]);

    useEffect(() => {
        if (Platform.OS === 'web') {
            const onVisChange = () => {
                if (document.visibilityState === 'visible') handleAppFocus();
            };
            document.addEventListener('visibilitychange', onVisChange);
            return () => document.removeEventListener('visibilitychange', onVisChange);
        } else {
            const sub = AppState.addEventListener('change', (s) => {
                if (s === 'active') handleAppFocus();
            });
            return () => sub.remove();
        }
    }, [handleAppFocus]);

    // ── Handle Purchase ─────────────────────────────────────────────────────────
    const handleBuy = async (plan: typeof CREDIT_PLANS[0]) => {
        if (isProcessing) return;
        setIsProcessing(plan.id);

        try {
            if (!userId) {
                showAlert('Login Required', 'Please login to continue.', [{ text: 'OK' }]);
                return;
            }

            // ── Store pending purchase so webhook can match this user ────
            // We store the user's registered email so the webhook can find
            // them even if they enter a different email on Tradebox.
            try {
                await supabase
                    .from('pending_credit_purchases')
                    .upsert(
                        {
                            user_id: userId,
                            plan_id: plan.id,
                            credits: plan.credits,
                            amount_paise: plan.amountPaise,
                            email: userEmail,
                            status: 'pending',
                        },
                        { onConflict: 'user_id' }
                    );
            } catch (e) {
                console.warn('[BuyCredits] Could not store pending purchase:', e);
                // Non-blocking — proceed to payment even if this fails
            }

            const redirectUrl = plan.tradeboxUrl;
            if (redirectUrl) {
                // Mark that we're redirecting so polling kicks in on return
                isRedirectingRef.current = true;

                if (Platform.OS === 'web') {
                    window.open(redirectUrl, '_blank', 'noopener,noreferrer');
                } else {
                    Linking.openURL(redirectUrl);
                }
            } else {
                showAlert('Error', 'Payment link not found.');
            }

        } catch (e) {
            console.error('[BuyCredits] Error:', e);
            showAlert('Payment Failed', 'Could not open payment link. Please try again.');
        } finally {
            setIsProcessing(null);
        }
    };

    const currentBalance = wallet?.credits_balance ?? 0;
    const displayBalance = formatDisplayCredits(toDisplayCredits(currentBalance));

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
            {/* ── Header ────────────────────────────────────────────────────── */}
            <View style={[styles.header, { borderBottomColor: c.border }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
                    <Ionicons name="chevron-back" size={24} color={c.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: c.text }]}>Buy AI Credits</Text>
                <View style={{ width: 40 }}>
                    {isRefreshing && <ActivityIndicator size="small" color={Colors.brand.primary} />}
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

                {/* ── Wallet Balance Card ─────────────────────────────────── */}
                <View style={[styles.walletCard, { backgroundColor: isDark ? '#1e1b4b' : '#EEF2FF', borderColor: isDark ? '#312e81' : '#c7d2fe' }]}>
                    <View style={styles.walletIconRow}>
                        <View style={[styles.walletIconBg, { backgroundColor: Colors.brand.accent + '22' }]}>
                            <Ionicons name="flash" size={28} color={Colors.brand.accent} />
                        </View>
                    </View>
                    <Text style={[styles.balanceLabel, { color: isDark ? '#a5b4fc' : '#6366f1' }]}>Current Balance</Text>
                    <Text style={[styles.balanceValue, { color: c.text }]}>
                        {displayBalance}
                    </Text>
                    <Text style={[styles.balanceUnit, { color: c.textTertiary }]}>AI Credits</Text>
                </View>

                {/* ── Syncing indicator ──────────────────────────────────── */}
                {isRefreshing && (
                    <View style={[styles.pollingBadge, { backgroundColor: isDark ? '#1e3a5f' : '#dbeafe' }]}>
                        <ActivityIndicator size="small" color={Colors.brand.primary} />
                        <Text style={[styles.pollingText, { color: isDark ? '#93c5fd' : '#1d4ed8' }]}>
                            Checking for payment… this may take a moment
                        </Text>
                    </View>
                )}

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
                                {plan.savings && (
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
                                                {plan.creditsLabel} Credits
                                            </Text>
                                            <Text style={[styles.perCredit, { color: c.textTertiary }]}>
                                                ({plan.pricePerCredit})
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
                                            backgroundColor: plan.popular ? Colors.brand.primary : isDark ? '#1F2937' : '#f3f4f6',
                                            opacity: isProcessing ? 0.6 : 1,
                                        },
                                    ]}
                                    onPress={() => handleBuy(plan)}
                                    disabled={!!isProcessing}
                                    activeOpacity={0.8}
                                >
                                    {isActive ? (
                                        <ActivityIndicator size="small" color={plan.popular ? '#fff' : c.tint} />
                                    ) : (
                                        <View style={styles.buyBtnContent}>
                                            <Ionicons
                                                name="card-outline"
                                                size={18}
                                                color={plan.popular ? '#fff' : c.tint}
                                            />
                                            <Text
                                                style={[
                                                    styles.buyBtnText,
                                                    { color: plan.popular ? '#fff' : c.tint },
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
                        Secured by Tradebox • 256-bit SSL Encrypted
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
                            1 credit = ₹1. Credits are deducted based on the <Text style={{ fontWeight: '700', color: c.text }}>exact amount of AI processing</Text> used for each message.
                        </Text>
                    </View>

                    <View style={styles.infoRow}>
                        <Text style={styles.infoDot}>•</Text>
                        <Text style={[styles.infoText, { color: c.textSecondary }]}>
                            A typical text chat uses <Text style={{ fontWeight: '700', color: c.text }}>~10 credits</Text>.
                            Longer conversations with more context cost more.
                        </Text>
                    </View>

                    <View style={styles.infoRow}>
                        <Text style={styles.infoDot}>•</Text>
                        <Text style={[styles.infoText, { color: c.textSecondary }]}>
                            Credits <Text style={{ fontWeight: '700', color: c.text }}>never expire</Text> and carry
                            over. New users start with <Text style={{ fontWeight: '700', color: c.text }}>100 free credits</Text>.
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

                    <View style={styles.infoRow}>
                        <Text style={styles.infoDot}>•</Text>
                        <Text style={[styles.infoText, { color: c.textSecondary }]}>
                            In case of emergency, contact support at{' '}
                            <Text
                                style={{ fontWeight: '700', color: Colors.brand.primary, textDecorationLine: 'underline' }}
                                onPress={() => Linking.openURL('mailto:contact@tikonacapital.com')}
                            >
                                contact@tikonacapital.com
                            </Text>.
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
        gap: 8,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: BorderRadius.lg,
        marginBottom: Spacing.lg,
    },
    pollingText: { fontSize: 12, fontWeight: '600', flex: 1 },

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
        left: 20,
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
