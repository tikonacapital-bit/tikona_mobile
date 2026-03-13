/**
 * Refund Request Logic
 *
 * Handles pro-rata refund calculation and Supabase CRUD operations
 * for user-initiated refund requests.
 *
 * Refund formula:
 *   monthly_value = total_paid / 12
 *   months_used   = ceil(months since subscription started)
 *   refund_amount = floor(monthly_value × remaining_months)
 */

import { supabase } from '@/lib/supabase';
import { PLAN_PRICES } from '@/lib/types';
import type { RefundRequest } from '@/lib/types';

// ─── Admin Config ─────────────────────────────────────────────────────────────
const ADMIN_EMAIL = 'sumitpoddar@tikonacapital.com';

// ─── Refund Calculation ───────────────────────────────────────────────────────

export interface RefundBreakdown {
    totalPaid: number;
    monthlyValue: number;
    monthsUsed: number;
    monthsRemaining: number;
    refundAmount: number;
}

/**
 * Calculate pro-rata refund based on plan and subscription start date.
 * Uses amountPaid (actual payment) if available, else falls back to PLAN_PRICES.
 * Only full remaining months are refunded (partial current month is NOT refunded).
 */
export function calculateRefund(plan: string, startedAt: string, amountPaid?: number | null): RefundBreakdown {
    const totalPaid = amountPaid ?? PLAN_PRICES[plan] ?? 0;
    const monthlyValue = totalPaid / 12;

    // Calculate months elapsed since subscription started
    const startDate = new Date(startedAt);
    const now = new Date();

    const yearDiff = now.getFullYear() - startDate.getFullYear();
    const monthDiff = now.getMonth() - startDate.getMonth();
    const dayDiff = now.getDate() - startDate.getDate();

    // Total months difference — round up partial months as "used"
    let monthsUsed = yearDiff * 12 + monthDiff;
    if (dayDiff > 0) {
        monthsUsed += 1; // partial month counts as used
    }
    // At minimum 1 month is considered used
    monthsUsed = Math.max(1, monthsUsed);

    const monthsRemaining = Math.max(0, 12 - monthsUsed);
    const refundAmount = Math.floor(monthlyValue * monthsRemaining);

    return {
        totalPaid,
        monthlyValue: Math.round(monthlyValue * 100) / 100,
        monthsUsed,
        monthsRemaining,
        refundAmount,
    };
}

// ─── Supabase Operations ──────────────────────────────────────────────────────

/**
 * Fetch the user's most recent refund request (if any).
 */
export async function getRefundRequest(userId: string): Promise<RefundRequest | null> {
    const { data, error } = await supabase
        .from('refund_requests')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) {
        console.warn('Error fetching refund request:', error.message);
        return null;
    }
    return data as RefundRequest | null;
}

/**
 * Submit a new refund request.
 * Returns the created refund request or null on error.
 */
export async function submitRefundRequest(params: {
    userId: string;
    subscriptionId: string;
    plan: string;
    startedAt: string;
    amountPaid?: number | null;
    upiId: string;
    reason?: string;
}): Promise<{ success: boolean; data?: RefundRequest; error?: string }> {
    const { userId, subscriptionId, plan, startedAt, amountPaid, upiId, reason } = params;

    // Calculate refund breakdown
    const breakdown = calculateRefund(plan, startedAt, amountPaid);

    if (breakdown.refundAmount <= 0) {
        return {
            success: false,
            error: 'No refundable amount remaining. The subscription period has been fully used.',
        };
    }

    // Check for existing pending request
    const existing = await getRefundRequest(userId);
    if (existing && (existing.status === 'pending' || existing.status === 'approved')) {
        return {
            success: false,
            error: `You already have a ${existing.status} refund request.`,
        };
    }

    // Insert refund request
    const { data, error } = await supabase
        .from('refund_requests')
        .insert({
            user_id: userId,
            subscription_id: subscriptionId,
            plan,
            total_paid: breakdown.totalPaid,
            months_used: breakdown.monthsUsed,
            months_remaining: breakdown.monthsRemaining,
            refund_amount: breakdown.refundAmount,
            status: 'pending',
            upi_id: upiId,
            reason: reason || null,
        })
        .select()
        .single();

    if (error) {
        console.warn('Error submitting refund request:', error.message);
        return { success: false, error: error.message };
    }

    // Notify admin (fire-and-forget, don't block the user)
    notifyAdmin(data as RefundRequest).catch((e) =>
        console.warn('Admin notification failed:', e)
    );

    return { success: true, data: data as RefundRequest };
}

// ─── Admin Notification ───────────────────────────────────────────────────────

/**
 * Notify the admin about a new refund request.
 * Uses the Supabase Edge Function endpoint for sending email.
 * Falls back silently if the function isn't deployed yet.
 */
async function notifyAdmin(request: RefundRequest): Promise<void> {
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';

    if (!supabaseUrl) {
        console.log('[Refund] No Supabase URL configured, skipping admin notification.');
        return;
    }

    try {
        const response = await fetch(`${supabaseUrl}/functions/v1/refund-action`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || ''}`,
            },
            body: JSON.stringify({
                admin_email: ADMIN_EMAIL,
                request_id: request.id,
                user_id: request.user_id,
                plan: request.plan,
                refund_amount: request.refund_amount,
                total_paid: request.total_paid,
                months_used: request.months_used,
                months_remaining: request.months_remaining,
                upi_id: request.upi_id,
                reason: request.reason,
            }),
        });

        if (!response.ok) {
            console.warn('[Refund] Admin notification endpoint returned:', response.status);
        }
    } catch (err) {
        // Edge function may not be deployed yet — that's okay
        console.log('[Refund] Admin notification skipped (edge function not available).');
    }
}

/**
 * Format currency in INR
 */
export function formatINR(amount: number): string {
    return '₹' + amount.toLocaleString('en-IN');
}
