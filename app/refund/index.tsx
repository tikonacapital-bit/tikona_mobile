import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity,
    Platform, TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Colors, Spacing, BorderRadius, FontSize } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { PLANS, PLAN_PRICES } from '@/lib/types';
import type { RefundRequest } from '@/lib/types';
import { Card, ResponsiveScrollView } from '@/components/ui';
import {
    calculateRefund,
    getRefundRequest,
    submitRefundRequest,
    formatINR,
} from '@/lib/refund';
import type { RefundBreakdown } from '@/lib/refund';

type PlanKey = keyof typeof PLANS;

export default function RefundScreen() {
    const theme = useColorScheme();
    const c = Colors[theme];
    const { userId, subscription } = useAuth();

    const [breakdown, setBreakdown] = useState<RefundBreakdown | null>(null);
    const [existingRequest, setExistingRequest] = useState<RefundRequest | null>(null);
    const [upiId, setUpiId] = useState('');
    const [reason, setReason] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // ── Fetch existing refund request on mount ──
    const loadData = useCallback(async () => {
        if (!userId || !subscription) {
            setLoading(false);
            return;
        }
        try {
            // Check for existing request
            const existing = await getRefundRequest(userId);
            setExistingRequest(existing);

            // Calculate refund breakdown
            if (subscription.started_at && subscription.plan) {
                const calc = calculateRefund(subscription.plan, subscription.started_at, subscription.amount_paid);
                setBreakdown(calc);
            }
        } catch (e) {
            console.warn('Error loading refund data:', e);
        } finally {
            setLoading(false);
        }
    }, [userId, subscription]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // ── Submit refund request ──
    const handleSubmit = async () => {
        if (!userId || !subscription) return;
        if (!upiId.trim()) {
            Alert.alert('Required Field', 'Please enter your UPI ID so we can process your refund.');
            return;
        }

        Alert.alert(
            'Confirm Refund Request',
            `Are you sure you want to request a refund of ${formatINR(breakdown?.refundAmount || 0)}? This will be reviewed by our team.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Yes, Request Refund',
                    style: 'destructive',
                    onPress: async () => {
                        setSubmitting(true);
                        try {
                            const result = await submitRefundRequest({
                                userId,
                                subscriptionId: subscription.id,
                                plan: subscription.plan,
                                startedAt: subscription.started_at,
                                amountPaid: subscription.amount_paid,
                                upiId: upiId.trim(),
                                reason: reason.trim() || undefined,
                            });

                            if (result.success) {
                                Alert.alert(
                                    '✅ Request Submitted',
                                    'Your refund request has been submitted. Our team will review it within 2-3 business days.',
                                    [{ text: 'OK', onPress: () => loadData() }]
                                );
                            } else {
                                Alert.alert('Error', result.error || 'Something went wrong. Please try again.');
                            }
                        } catch (e: any) {
                            Alert.alert('Error', e.message || 'Something went wrong.');
                        } finally {
                            setSubmitting(false);
                        }
                    },
                },
            ]
        );
    };

    // ── Status badge color mapping ──
    const statusConfig: Record<string, { color: string; bg: string; icon: keyof typeof Ionicons.glyphMap; label: string }> = {
        pending: { color: c.warning, bg: c.warningBg, icon: 'time', label: 'Under Review' },
        approved: { color: c.success, bg: c.successBg, icon: 'checkmark-circle', label: 'Approved' },
        rejected: { color: c.danger, bg: c.dangerBg, icon: 'close-circle', label: 'Rejected' },
        processed: { color: c.success, bg: c.successBg, icon: 'checkmark-done-circle', label: 'Processed' },
    };

    // ── Loading state ──
    if (loading) {
        return (
            <View style={[styles.container, { backgroundColor: c.background }]}>
                <View style={[styles.header, { backgroundColor: Colors.brand.primary }]}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={22} color="#fff" />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.headerTitle}>Request Refund</Text>
                    </View>
                </View>
                <View style={styles.centerLoader}>
                    <ActivityIndicator size="large" color={Colors.brand.secondary} />
                </View>
            </View>
        );
    }

    // ── No subscription ──
    if (!subscription || !subscription.is_active) {
        return (
            <View style={[styles.container, { backgroundColor: c.background }]}>
                <View style={[styles.header, { backgroundColor: Colors.brand.primary }]}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={22} color="#fff" />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.headerTitle}>Request Refund</Text>
                    </View>
                </View>
                <View style={styles.centerLoader}>
                    <View style={[styles.emptyIcon, { backgroundColor: c.borderLight }]}>
                        <Ionicons name="receipt-outline" size={32} color={c.textTertiary} />
                    </View>
                    <Text style={[styles.emptyTitle, { color: c.text }]}>No Active Subscription</Text>
                    <Text style={[styles.emptySubtitle, { color: c.textSecondary }]}>
                        You don't have an active subscription to request a refund for.
                    </Text>
                    <TouchableOpacity
                        style={[styles.emptyBtn, { backgroundColor: Colors.brand.secondary }]}
                        onPress={() => router.push('/subscription')}
                    >
                        <Text style={styles.emptyBtnText}>View Plans</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    const planKey = subscription.plan as PlanKey;
    const planInfo = PLANS[planKey];
    const hasExisting = existingRequest && (existingRequest.status === 'pending' || existingRequest.status === 'approved');

    return (
        <View style={[styles.container, { backgroundColor: c.background }]}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: Colors.brand.primary }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={22} color="#fff" />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={styles.headerTitle}>Request Refund</Text>
                    <Text style={styles.headerSubtitle}>Pro-rata refund calculation</Text>
                </View>
            </View>

            <ResponsiveScrollView contentContainerStyle={styles.content}>

                {/* ── Existing Request Status ── */}
                {existingRequest && (
                    <Card theme={theme} style={styles.statusCard}>
                        <View style={[styles.statusBanner, { backgroundColor: statusConfig[existingRequest.status]?.bg || c.borderLight }]}>
                            <Ionicons
                                name={statusConfig[existingRequest.status]?.icon || 'time'}
                                size={20}
                                color={statusConfig[existingRequest.status]?.color || c.textTertiary}
                            />
                            <View style={{ flex: 1, marginLeft: 10 }}>
                                <Text style={[styles.statusLabel, { color: statusConfig[existingRequest.status]?.color || c.text }]}>
                                    {statusConfig[existingRequest.status]?.label || existingRequest.status}
                                </Text>
                                <Text style={[styles.statusDate, { color: c.textSecondary }]}>
                                    Requested on {new Date(existingRequest.created_at).toLocaleDateString('en-IN', {
                                        day: 'numeric', month: 'short', year: 'numeric'
                                    })}
                                </Text>
                            </View>
                            <Text style={[styles.statusAmount, { color: statusConfig[existingRequest.status]?.color || c.text }]}>
                                {formatINR(existingRequest.refund_amount)}
                            </Text>
                        </View>

                        {existingRequest.status === 'pending' && (
                            <View style={[styles.infoRow, { borderTopColor: c.borderLight }]}>
                                <Ionicons name="information-circle" size={16} color={c.textTertiary} />
                                <Text style={[styles.infoText, { color: c.textSecondary }]}>
                                    Your request is under review. We'll update you within 2-3 business days.
                                </Text>
                            </View>
                        )}

                        {existingRequest.status === 'rejected' && existingRequest.admin_notes && (
                            <View style={[styles.infoRow, { borderTopColor: c.borderLight }]}>
                                <Ionicons name="chatbubble-ellipses" size={16} color={c.danger} />
                                <Text style={[styles.infoText, { color: c.textSecondary }]}>
                                    <Text style={{ fontWeight: '600' }}>Admin note: </Text>
                                    {existingRequest.admin_notes}
                                </Text>
                            </View>
                        )}

                        {existingRequest.status === 'approved' && (
                            <View style={[styles.infoRow, { borderTopColor: c.borderLight }]}>
                                <Ionicons name="checkmark-done" size={16} color={c.success} />
                                <Text style={[styles.infoText, { color: c.textSecondary }]}>
                                    Your refund has been approved! The amount will be credited to your account soon.
                                </Text>
                            </View>
                        )}
                    </Card>
                )}

                {/* ── Subscription Info Card ── */}
                <Card theme={theme} style={styles.card}>
                    <View style={styles.cardHeader}>
                        <View style={[styles.planIcon, { backgroundColor: Colors.brand.secondary + '15' }]}>
                            <Ionicons name="diamond" size={20} color={Colors.brand.secondary} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.cardTitle, { color: c.text }]}>Your Subscription</Text>
                            <Text style={[styles.planName, { color: Colors.brand.secondary }]}>
                                {planInfo?.name || subscription.plan}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.detailRows}>
                        <View style={[styles.detailRow, { borderBottomColor: c.borderLight }]}>
                            <Text style={[styles.detailLabel, { color: c.textSecondary }]}>Started</Text>
                            <Text style={[styles.detailValue, { color: c.text }]}>
                                {new Date(subscription.started_at).toLocaleDateString('en-IN', {
                                    day: 'numeric', month: 'long', year: 'numeric'
                                })}
                            </Text>
                        </View>
                        {subscription.expires_at && (
                            <View style={[styles.detailRow, { borderBottomColor: c.borderLight }]}>
                                <Text style={[styles.detailLabel, { color: c.textSecondary }]}>Expires</Text>
                                <Text style={[styles.detailValue, { color: c.text }]}>
                                    {new Date(subscription.expires_at).toLocaleDateString('en-IN', {
                                        day: 'numeric', month: 'long', year: 'numeric'
                                    })}
                                </Text>
                            </View>
                        )}
                        <View style={styles.detailRow}>
                            <Text style={[styles.detailLabel, { color: c.textSecondary }]}>Amount Paid</Text>
                            <Text style={[styles.detailValue, { color: c.text, fontWeight: '700' }]}>
                                {formatINR(subscription.amount_paid ?? PLAN_PRICES[subscription.plan] ?? 0)}
                            </Text>
                        </View>
                    </View>
                </Card>

                {/* ── Refund Breakdown Card ── */}
                {breakdown && (
                    <Card theme={theme} style={styles.card}>
                        <View style={styles.cardHeader}>
                            <View style={[styles.planIcon, { backgroundColor: Colors.brand.accent + '15' }]}>
                                <Ionicons name="calculator" size={20} color={Colors.brand.accent} />
                            </View>
                            <Text style={[styles.cardTitle, { color: c.text }]}>Refund Breakdown</Text>
                        </View>

                        <View style={styles.detailRows}>
                            <View style={[styles.detailRow, { borderBottomColor: c.borderLight }]}>
                                <Text style={[styles.detailLabel, { color: c.textSecondary }]}>Total Paid</Text>
                                <Text style={[styles.detailValue, { color: c.text }]}>{formatINR(breakdown.totalPaid)}</Text>
                            </View>
                            <View style={[styles.detailRow, { borderBottomColor: c.borderLight }]}>
                                <Text style={[styles.detailLabel, { color: c.textSecondary }]}>Monthly Value</Text>
                                <Text style={[styles.detailValue, { color: c.text }]}>{formatINR(breakdown.monthlyValue)}</Text>
                            </View>
                            <View style={[styles.detailRow, { borderBottomColor: c.borderLight }]}>
                                <Text style={[styles.detailLabel, { color: c.textSecondary }]}>Months Used</Text>
                                <Text style={[styles.detailValue, { color: c.danger }]}>{breakdown.monthsUsed} months</Text>
                            </View>
                            <View style={[styles.detailRow, { borderBottomColor: c.borderLight }]}>
                                <Text style={[styles.detailLabel, { color: c.textSecondary }]}>Months Remaining</Text>
                                <Text style={[styles.detailValue, { color: c.success }]}>{breakdown.monthsRemaining} months</Text>
                            </View>
                        </View>

                        {/* Refund Amount Highlight */}
                        <View style={[styles.refundAmountBox, { backgroundColor: c.successBg, borderColor: c.success + '30' }]}>
                            <Text style={[styles.refundAmountLabel, { color: c.success }]}>Eligible Refund Amount</Text>
                            <Text style={[styles.refundAmountValue, { color: c.success }]}>
                                {formatINR(breakdown.refundAmount)}
                            </Text>
                        </View>

                        {breakdown.refundAmount <= 0 && (
                            <View style={[styles.noRefundBanner, { backgroundColor: c.warningBg }]}>
                                <Ionicons name="warning" size={16} color={c.warning} />
                                <Text style={[styles.noRefundText, { color: c.warning }]}>
                                    No refundable amount remaining. The subscription period has been fully used.
                                </Text>
                            </View>
                        )}
                    </Card>
                )}

                {/* ── Reason Input + Submit (only if no existing pending/approved request) ── */}
                {!hasExisting && breakdown && breakdown.refundAmount > 0 && (
                    <>
                        <Card theme={theme} style={styles.card}>
                            <Text style={[styles.inputLabel, { color: c.text }]}>
                                Your UPI ID <Text style={{ color: c.danger }}>*</Text>
                            </Text>
                            <TextInput
                                style={[styles.textInput, {
                                    backgroundColor: c.inputBg,
                                    borderColor: c.inputBorder,
                                    color: c.text,
                                    minHeight: 48,
                                    marginBottom: Spacing.lg
                                }]}
                                placeholder="e.g. 9876543210@ybl"
                                placeholderTextColor={c.textTertiary}
                                value={upiId}
                                onChangeText={setUpiId}
                                autoCapitalize="none"
                                keyboardType="email-address"
                            />

                            <Text style={[styles.inputLabel, { color: c.text }]}>
                                Reason for Refund <Text style={{ color: c.textTertiary, fontWeight: '400' }}>(optional)</Text>
                            </Text>
                            <TextInput
                                style={[styles.textInput, {
                                    backgroundColor: c.inputBg,
                                    borderColor: c.inputBorder,
                                    color: c.text,
                                    minHeight: 100
                                }]}
                                placeholder="Tell us why you'd like a refund..."
                                placeholderTextColor={c.textTertiary}
                                multiline
                                numberOfLines={4}
                                textAlignVertical="top"
                                value={reason}
                                onChangeText={setReason}
                                maxLength={500}
                            />
                            <Text style={[styles.charCount, { color: c.textTertiary }]}>
                                {reason.length}/500
                            </Text>
                        </Card>

                        {/* Submit Button */}
                        <TouchableOpacity
                            style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
                            onPress={handleSubmit}
                            disabled={submitting}
                            activeOpacity={0.85}
                        >
                            {submitting ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <>
                                    <Ionicons name="arrow-undo" size={20} color="#fff" />
                                    <Text style={styles.submitBtnText}>
                                        Submit Refund Request · {formatINR(breakdown.refundAmount)}
                                    </Text>
                                </>
                            )}
                        </TouchableOpacity>

                        {/* Disclaimer */}
                        <View style={[styles.disclaimer, { backgroundColor: c.cardBg, borderColor: c.border }]}>
                            <Ionicons name="information-circle" size={16} color={c.textTertiary} />
                            <Text style={[styles.disclaimerText, { color: c.textTertiary }]}>
                                Your request will be reviewed by our team within 2-3 business days. 
                                Once approved, the refund will be processed to your original payment method.
                            </Text>
                        </View>
                    </>
                )}

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
    backBtn: {
        width: 36, height: 36, borderRadius: 10,
        justifyContent: 'center', alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.12)',
    },
    headerTitle: { fontSize: FontSize.xl, fontWeight: '700', color: '#fff' },
    headerSubtitle: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.65)', marginTop: 2 },
    content: { padding: Spacing.xl },

    // ── Center loader / empty ──
    centerLoader: {
        flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing['3xl'],
    },
    emptyIcon: {
        width: 64, height: 64, borderRadius: 32,
        justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.lg,
    },
    emptyTitle: { fontSize: FontSize.lg, fontWeight: '700', marginBottom: Spacing.sm },
    emptySubtitle: { fontSize: FontSize.sm, textAlign: 'center', lineHeight: 20, marginBottom: Spacing.xl },
    emptyBtn: {
        paddingHorizontal: Spacing['2xl'], paddingVertical: Spacing.md,
        borderRadius: BorderRadius.md,
    },
    emptyBtnText: { color: '#fff', fontSize: FontSize.base, fontWeight: '600' },

    // ── Status card ──
    statusCard: { marginBottom: Spacing.lg, overflow: 'hidden' },
    statusBanner: {
        flexDirection: 'row', alignItems: 'center',
        padding: Spacing.lg,
    },
    statusLabel: { fontSize: FontSize.base, fontWeight: '700' },
    statusDate: { fontSize: FontSize.xs, marginTop: 2 },
    statusAmount: { fontSize: FontSize.xl, fontWeight: '800' },
    infoRow: {
        flexDirection: 'row', alignItems: 'flex-start', gap: 8,
        paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
        borderTopWidth: 1,
    },
    infoText: { fontSize: FontSize.sm, flex: 1, lineHeight: 19 },

    // ── Cards ──
    card: { padding: Spacing.xl, marginBottom: Spacing.lg },
    cardHeader: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
        marginBottom: Spacing.lg,
    },
    cardTitle: { fontSize: FontSize.lg, fontWeight: '700' },
    planIcon: {
        width: 40, height: 40, borderRadius: 12,
        justifyContent: 'center', alignItems: 'center',
    },
    planName: { fontSize: FontSize.sm, fontWeight: '600', marginTop: 2 },

    // ── Detail rows ──
    detailRows: { marginBottom: Spacing.md },
    detailRow: {
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1,
    },
    detailLabel: { fontSize: FontSize.sm },
    detailValue: { fontSize: FontSize.sm, fontWeight: '600' },

    // ── Refund amount highlight ──
    refundAmountBox: {
        padding: Spacing.lg, borderRadius: BorderRadius.md, borderWidth: 1,
        alignItems: 'center',
    },
    refundAmountLabel: { fontSize: FontSize.sm, fontWeight: '600', marginBottom: 4 },
    refundAmountValue: { fontSize: FontSize['2xl'], fontWeight: '800' },

    // ── No refund banner ──
    noRefundBanner: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        padding: Spacing.md, borderRadius: BorderRadius.md, marginTop: Spacing.md,
    },
    noRefundText: { fontSize: FontSize.sm, flex: 1, lineHeight: 19 },

    // ── Input ──
    inputLabel: { fontSize: FontSize.base, fontWeight: '600', marginBottom: Spacing.sm },
    textInput: {
        borderWidth: 1, borderRadius: BorderRadius.md,
        padding: Spacing.md, fontSize: FontSize.sm,
        lineHeight: 20,
    },
    charCount: { fontSize: FontSize.xs, textAlign: 'right', marginTop: 4 },

    // ── Submit ──
    submitBtn: {
        height: 54, borderRadius: BorderRadius.md,
        backgroundColor: Colors.brand.primary,
        justifyContent: 'center', alignItems: 'center',
        flexDirection: 'row', gap: 8, marginBottom: Spacing.lg,
    },
    submitBtnDisabled: { opacity: 0.6 },
    submitBtnText: { color: '#fff', fontSize: FontSize.base, fontWeight: '700' },

    // ── Disclaimer ──
    disclaimer: {
        flexDirection: 'row', alignItems: 'flex-start', gap: 8,
        padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1,
    },
    disclaimerText: { fontSize: FontSize.xs, flex: 1, lineHeight: 17 },
});
