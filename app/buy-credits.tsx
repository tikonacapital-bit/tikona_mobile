import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, BorderRadius, FontSize } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

const DUMMY_PLANS = [
    {
        id: 'pack_100',
        title: 'Starter Pack',
        credits: 100,
        price: '₹99',
        popular: false,
        desc: 'Perfect for occasional research.',
    },
    {
        id: 'pack_500',
        title: 'Pro Pack',
        credits: 500,
        price: '₹399',
        popular: true,
        desc: 'Most popular for active investors.',
    },
    {
        id: 'pack_2000',
        title: 'Whale Pack',
        credits: 2000,
        price: '₹1499',
        popular: false,
        desc: 'Best value for heavy users.',
    }
];

export default function BuyCreditsScreen() {
    const theme = useColorScheme();
    const c = Colors[theme];
    const isDark = theme === 'dark';
    const { userId, wallet, refreshWallet } = useAuth();
    const [isProcessing, setIsProcessing] = React.useState<string | null>(null);

    const handleBuy = async (plan: typeof DUMMY_PLANS[0]) => {
        setIsProcessing(plan.id);
        
        try {
            // 1. Open mock payment gateway (similar to TradeBox/Razorpay)
            // Uncomment the next line to see the actual browser popup for the demo:
            // await WebBrowser.openBrowserAsync('https://razorpay.com/payment-link-demo');
            
            // 2. FOR TESTING: We bypass webhooks and directly run the backend RPC 
            // so you can actually get the credits to test the app right now!
            if (userId) {
                const { error } = await supabase.rpc('increment_ai_credits', {
                    p_user_id: userId,
                    p_amount: plan.credits,
                    p_transaction_type: 'top_up',
                    p_metadata: { plan_id: plan.id }
                });
                
                if (error) {
                    console.error('RPC Error:', error);
                    throw new Error('Failed to add credits securely.');
                }
            }
            
            Alert.alert(
                'Test Credit Granted!',
                `Successfully purchased ${plan.credits} credits! Wallet updated in the database.`,
                [{ 
                    text: 'Perfect', 
                    onPress: () => {
                        refreshWallet();
                    }
                }]
            );
        } catch (e) {
            Alert.alert('Payment Failed', 'Could not secure the credits. Check console.');
        } finally {
            setIsProcessing(null);
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
            <View style={[styles.header, { borderBottomColor: c.border }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
                    <Ionicons name="chevron-back" size={24} color={c.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: c.text }]}>Buy AI Credits</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.walletBox}>
                    <Ionicons name="flash" size={32} color={Colors.brand.accent} />
                    <Text style={[styles.balanceTitle, { color: c.textTertiary }]}>Current Balance</Text>
                    <Text style={[styles.balanceValue, { color: c.text }]}>{wallet?.credits_balance ?? 0} Credits</Text>
                </View>

                <Text style={[styles.sectionTitle, { color: c.text }]}>Select a Top-up Plan</Text>

                <View style={styles.plansContainer}>
                    {DUMMY_PLANS.map((plan) => (
                        <View key={plan.id} style={[styles.planCard, { backgroundColor: c.surface, borderColor: plan.popular ? Colors.brand.primary : c.border }]}>
                            {plan.popular && (
                                <View style={styles.popularBadge}>
                                    <Text style={styles.popularText}>MOST POPULAR</Text>
                                </View>
                            )}
                            
                            <View style={styles.planHeader}>
                                <View>
                                    <Text style={[styles.planTitle, { color: c.text }]}>{plan.title}</Text>
                                    <View style={styles.creditsRow}>
                                        <Ionicons name="flash-outline" size={16} color={Colors.brand.primary} />
                                        <Text style={[styles.planCredits, { color: Colors.brand.primary }]}>{plan.credits} Credits</Text>
                                    </View>
                                </View>
                                <Text style={[styles.planPrice, { color: c.text }]}>{plan.price}</Text>
                            </View>
                            
                            <Text style={[styles.planDesc, { color: c.textSecondary }]}>{plan.desc}</Text>
                            
                            <TouchableOpacity 
                                style={[styles.buyBtn, { backgroundColor: Colors.brand.primary, opacity: isProcessing ? 0.6 : 1 }]}
                                onPress={() => handleBuy(plan)}
                                disabled={!!isProcessing}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.buyBtnText}>
                                    {isProcessing === plan.id ? 'Processing...' : 'Buy Now'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    ))}
                </View>

                {/* ── Explanation Section ── */}
                <View style={[styles.infoBox, { backgroundColor: isDark ? c.surfaceElevated : '#EFF6FF', borderColor: c.border }]}>
                    <View style={styles.infoHeader}>
                        <Ionicons name="information-circle" size={18} color={Colors.brand.secondary} />
                        <Text style={[styles.infoBoxTitle, { color: Colors.brand.secondary }]}>How are credits calculated?</Text>
                    </View>
                    
                    <View style={styles.infoRow}>
                        <Text style={styles.infoDot}>•</Text>
                        <Text style={[styles.infoText, { color: c.textSecondary }]}>
                            <Text style={{fontWeight: '700', color: c.text}}>1 Credit</Text> is deducted for each Text message sent to the Sector AI or Report AI.
                        </Text>
                    </View>
                    
                    <View style={styles.infoRow}>
                        <Text style={styles.infoDot}>•</Text>
                        <Text style={[styles.infoText, { color: c.textSecondary }]}>
                            <Text style={{fontWeight: '700', color: c.text}}>2 Credits</Text> are deducted for Voice Mode interactions (covers AI processing + Audio generation).
                        </Text>
                    </View>

                    <View style={styles.infoRow}>
                        <Text style={styles.infoDot}>•</Text>
                        <Text style={[styles.infoText, { color: c.textSecondary }]}>
                            Credits <Text style={{fontWeight: '700', color: c.text}}>never expire</Text> and carry over to the next month. Subscription plans will automatically grant a bundle of free credits each month.
                        </Text>
                    </View>
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

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
    walletBox: {
        alignItems: 'center',
        padding: Spacing['2xl'],
        marginBottom: Spacing['2xl'],
    },
    balanceTitle: { fontSize: FontSize.sm, fontWeight: '600', marginTop: Spacing.sm, marginBottom: 4 },
    balanceValue: { fontSize: FontSize['3xl'], fontWeight: '800' },
    sectionTitle: { fontSize: FontSize.lg, fontWeight: '700', marginBottom: Spacing.lg },
    plansContainer: { gap: Spacing.lg },
    planCard: {
        borderRadius: BorderRadius.xl,
        borderWidth: 2,
        padding: Spacing.xl,
        position: 'relative',
    },
    popularBadge: {
        position: 'absolute',
        top: -12,
        right: 20,
        backgroundColor: Colors.brand.primary,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 4,
        borderRadius: BorderRadius.full,
    },
    popularText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
    planHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: Spacing.sm,
    },
    planTitle: { fontSize: FontSize.lg, fontWeight: '700', marginBottom: 4 },
    creditsRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    planCredits: { fontSize: FontSize.base, fontWeight: '600' },
    planPrice: { fontSize: FontSize.xl, fontWeight: '800' },
    planDesc: { fontSize: FontSize.sm, marginBottom: Spacing.lg },
    buyBtn: {
        borderRadius: BorderRadius.lg,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buyBtnText: { color: '#fff', fontSize: FontSize.md, fontWeight: '700' },
    
    infoBox: {
        marginTop: Spacing.xl,
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
