/**
 * KYC Status Screen
 *
 * KYC is now initiated AUTOMATICALLY by Tradebox when a user subscribes via Razorpay.
 * This screen shows the current KYC status and guides the user accordingly.
 */

import React from 'react';
import {
    View, Text, StyleSheet, ScrollView,
    TouchableOpacity, Linking, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Colors, Spacing, BorderRadius, FontSize } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuth } from '@/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

type KycStatus = 'not_initiated' | 'pending' | 'approved' | 'rejected' | undefined;

const STATUS_CONFIG: Record<string, {
    icon: keyof typeof Ionicons.glyphMap;
    iconColor: string;
    bgColor: string;
    title: string;
    description: string;
}> = {
    approved: {
        icon: 'shield-checkmark',
        iconColor: '#22c55e',
        bgColor: '#22c55e15',
        title: 'KYC Verified ✓',
        description: 'Your identity has been verified by Tradebox. You have full access to all features.',
    },
    pending: {
        icon: 'time',
        iconColor: '#f59e0b',
        bgColor: '#f59e0b15',
        title: 'KYC Under Review',
        description: 'Tradebox is verifying your identity. This usually takes 24–48 hours. You\'ll be notified once it\'s complete.',
    },
    rejected: {
        icon: 'close-circle',
        iconColor: '#ef4444',
        bgColor: '#ef444415',
        title: 'KYC Rejected',
        description: 'Your KYC verification was rejected by Tradebox. Please contact support for assistance.',
    },
    not_initiated: {
        icon: 'shield-outline',
        iconColor: '#6b7280',
        bgColor: '#6b728015',
        title: 'KYC Not Started',
        description: 'KYC is initiated automatically when you subscribe. Choose a plan to get started.',
    },
};

export default function KycStatusScreen() {
    const theme = useColorScheme();
    const c = Colors[theme];
    const { kyc, subscription } = useAuth();

    const status: string = kyc?.status || (subscription ? 'pending' : 'not_initiated');
    const config = STATUS_CONFIG[status] || STATUS_CONFIG['not_initiated'];
    const hasSubscription = !!subscription?.is_active;

    return (
        <ScrollView
            style={[styles.container, { backgroundColor: c.background }]}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
        >
            {/* Back Button */}
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                <Ionicons name="arrow-back" size={22} color={c.text} />
            </TouchableOpacity>

            {/* Status Icon */}
            <View style={[styles.iconCircle, { backgroundColor: config.bgColor }]}>
                <Ionicons name={config.icon} size={52} color={config.iconColor} />
            </View>

            <Text style={[styles.title, { color: c.text }]}>{config.title}</Text>
            <Text style={[styles.description, { color: c.textSecondary }]}>{config.description}</Text>

            {/* Tradebox Badge */}
            <View style={[styles.tradeboxBadge, { backgroundColor: c.surface, borderColor: c.border }]}>
                <Ionicons name="business" size={16} color={Colors.brand.secondary} />
                <Text style={[styles.tradeboxText, { color: c.textSecondary }]}>
                    KYC powered by <Text style={{ color: Colors.brand.secondary, fontWeight: '700' }}>Tradebox</Text>
                </Text>
            </View>

            {/* Timeline Steps */}
            <View style={[styles.timelineCard, { backgroundColor: c.surface, borderColor: c.border }]}>
                <Text style={[styles.timelineTitle, { color: c.text }]}>How it works</Text>

                <TimelineStep
                    step={1}
                    title="Subscribe to a Plan"
                    desc="Choose Basic or Premium and pay securely via Razorpay."
                    done={hasSubscription}
                    theme={theme}
                />
                <TimelineStep
                    step={2}
                    title="KYC Auto-Initiated"
                    desc="Tradebox automatically starts your KYC verification right after payment."
                    done={!!kyc}
                    active={hasSubscription && !kyc}
                    theme={theme}
                />
                <TimelineStep
                    step={3}
                    title="Document Verification"
                    desc="Tradebox verifies your PAN/Aadhaar and bank details (24–48 hrs)."
                    done={kyc?.status === 'approved'}
                    active={kyc?.status === 'pending'}
                    theme={theme}
                />
                <TimelineStep
                    step={4}
                    title="Full Access Unlocked"
                    desc="Once KYC is approved, you get complete access to all platform features."
                    done={kyc?.status === 'approved'}
                    theme={theme}
                    isLast
                />
            </View>

            {/* Action Buttons */}
            {!hasSubscription && (
                <TouchableOpacity
                    style={[styles.primaryBtn, { backgroundColor: Colors.brand.primary }]}
                    onPress={() => router.push('/subscription')}
                    activeOpacity={0.85}
                >
                    <Ionicons name="diamond" size={18} color="#fff" />
                    <Text style={styles.primaryBtnText}>Subscribe to Start KYC</Text>
                </TouchableOpacity>
            )}

            {status === 'rejected' && (
                <TouchableOpacity
                    style={[styles.secondaryBtn, { backgroundColor: c.surface, borderColor: c.border }]}
                    onPress={() => Linking.openURL('mailto:support@tikonacapital.com')}
                    activeOpacity={0.85}
                >
                    <Ionicons name="mail-outline" size={18} color={Colors.brand.secondary} />
                    <Text style={[styles.secondaryBtnText, { color: Colors.brand.secondary }]}>
                        Contact Support
                    </Text>
                </TouchableOpacity>
            )}

            {status === 'pending' && (
                <View style={[styles.infoBox, { backgroundColor: Colors.brand.secondary + '12', borderColor: Colors.brand.secondary + '30' }]}>
                    <Ionicons name="information-circle" size={18} color={Colors.brand.secondary} />
                    <Text style={[styles.infoText, { color: c.textSecondary }]}>
                        You'll receive a notification and email when your KYC is approved. No action needed right now.
                    </Text>
                </View>
            )}

            <View style={{ height: 40 }} />
        </ScrollView>
    );
}

// ── Timeline Step Component ──────────────────────────────────────────────────
function TimelineStep({ step, title, desc, done, active, isLast, theme }: {
    step: number;
    title: string;
    desc: string;
    done?: boolean;
    active?: boolean;
    isLast?: boolean;
    theme: 'light' | 'dark';
}) {
    const c = Colors[theme];
    const dotColor = done ? '#22c55e' : active ? Colors.brand.secondary : c.border;
    const dotBg = done ? '#22c55e15' : active ? Colors.brand.secondary + '15' : c.borderLight;

    return (
        <View style={styles.timelineRow}>
            <View style={styles.timelineLeft}>
                <View style={[styles.timelineDot, { backgroundColor: dotBg, borderColor: dotColor }]}>
                    {done
                        ? <Ionicons name="checkmark" size={14} color="#22c55e" />
                        : <Text style={[styles.timelineStepNum, { color: dotColor }]}>{step}</Text>
                    }
                </View>
                {!isLast && <View style={[styles.timelineLine, { backgroundColor: done ? '#22c55e40' : c.border }]} />}
            </View>
            <View style={styles.timelineRight}>
                <Text style={[styles.timelineStepTitle, { color: done ? '#22c55e' : active ? Colors.brand.secondary : c.text }]}>
                    {title}
                </Text>
                <Text style={[styles.timelineStepDesc, { color: c.textSecondary }]}>{desc}</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { paddingHorizontal: Spacing['2xl'], paddingTop: Platform.select({ ios: 58, web: 20, default: 44 }), paddingBottom: 40, alignItems: 'center' },
    backBtn: { alignSelf: 'flex-start', marginBottom: Spacing.xl, width: 40, height: 40, justifyContent: 'center' },
    iconCircle: { width: 100, height: 100, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.xl },
    title: { fontSize: FontSize['2xl'], fontWeight: '800', textAlign: 'center', marginBottom: 10 },
    description: { fontSize: FontSize.base, textAlign: 'center', lineHeight: 22, maxWidth: 300, marginBottom: Spacing.xl },
    tradeboxBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        paddingHorizontal: 16, paddingVertical: 10,
        borderRadius: BorderRadius.full, borderWidth: 1,
        marginBottom: Spacing['2xl'],
    },
    tradeboxText: { fontSize: FontSize.sm },
    timelineCard: {
        width: '100%', borderRadius: BorderRadius.xl,
        borderWidth: 1, padding: Spacing.xl,
        marginBottom: Spacing.xl,
    },
    timelineTitle: { fontSize: FontSize.md, fontWeight: '700', marginBottom: Spacing.lg },
    timelineRow: { flexDirection: 'row', gap: 14, marginBottom: 4 },
    timelineLeft: { alignItems: 'center', width: 32 },
    timelineDot: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
    timelineStepNum: { fontSize: 13, fontWeight: '700' },
    timelineLine: { width: 2, flex: 1, minHeight: 16, marginVertical: 4 },
    timelineRight: { flex: 1, paddingBottom: 20 },
    timelineStepTitle: { fontSize: FontSize.base, fontWeight: '700', marginBottom: 4 },
    timelineStepDesc: { fontSize: FontSize.sm, lineHeight: 18 },
    primaryBtn: {
        width: '100%', height: 54, borderRadius: BorderRadius.lg,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
        marginBottom: Spacing.md,
    },
    primaryBtnText: { color: '#fff', fontSize: FontSize.md, fontWeight: '700' },
    secondaryBtn: {
        width: '100%', height: 54, borderRadius: BorderRadius.lg,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 10, borderWidth: 1.5, marginBottom: Spacing.md,
    },
    secondaryBtnText: { fontSize: FontSize.md, fontWeight: '600' },
    infoBox: {
        flexDirection: 'row', gap: 10, padding: Spacing.lg,
        borderRadius: BorderRadius.md, borderWidth: 1, width: '100%',
    },
    infoText: { fontSize: FontSize.sm, lineHeight: 20, flex: 1 },
});
