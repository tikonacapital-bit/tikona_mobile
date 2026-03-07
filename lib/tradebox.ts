/**
 * Tradebox KYC Integration
 *
 * Tradebox is our 3rd-party KYC provider.
 * When a user successfully pays via Razorpay, we call Tradebox API
 * to initiate KYC verification simultaneously.
 *
 * Flow:
 *   1. User pays → Razorpay success
 *   2. saveSubscription() stores payment in Supabase
 *   3. initiateTradeboxKyc() → sends user data to Tradebox API
 *   4. Tradebox returns a KYC reference ID → stored in kyc table
 *   5. KYC status is polled / updated via webhook (backend)
 */

import { supabase } from '@/lib/supabase';

// ─── Tradebox API Config ──────────────────────────────────────────────────────
// Set EXPO_PUBLIC_TRADEBOX_API_KEY and EXPO_PUBLIC_TRADEBOX_API_URL in your .env
const TRADEBOX_API_URL = process.env.EXPO_PUBLIC_TRADEBOX_API_URL || '';
const TRADEBOX_API_KEY = process.env.EXPO_PUBLIC_TRADEBOX_API_KEY || '';

export interface TradeboxKycPayload {
    userId: string;
    fullName: string;
    email: string;
    phone?: string;
    razorpayPaymentId: string;
    plan: string;
}

export interface TradeboxKycResult {
    success: boolean;
    kycReferenceId?: string;
    kycStatus?: 'initiated' | 'pending' | 'approved' | 'rejected';
    error?: string;
}

// ─── Main: Start Tradebox KYC ─────────────────────────────────────────────────
export async function initiateTradeboxKyc(payload: TradeboxKycPayload): Promise<TradeboxKycResult> {
    try {
        // Step 1: Call Tradebox API to initiate KYC
        let kycReferenceId: string | undefined;
        let kycStatus: 'initiated' | 'pending' = 'initiated';

        if (TRADEBOX_API_URL && TRADEBOX_API_KEY) {
            const response = await fetch(`${TRADEBOX_API_URL}/api/kyc/initiate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${TRADEBOX_API_KEY}`,
                    'X-Api-Key': TRADEBOX_API_KEY,
                },
                body: JSON.stringify({
                    customer_id: payload.userId,
                    full_name: payload.fullName,
                    email: payload.email,
                    phone: payload.phone || '',
                    payment_id: payload.razorpayPaymentId,
                    plan: payload.plan,
                }),
            });

            if (!response.ok) {
                const errBody = await response.text();
                console.warn('Tradebox API error:', errBody);
                // Don't fail hard — still save KYC record locally
            } else {
                const data = await response.json();
                kycReferenceId = data?.reference_id || data?.kyc_id || data?.id;
                kycStatus = data?.status || 'initiated';
            }
        } else {
            // Dev mode: Tradebox keys not configured — mark as pending
            console.log('[Tradebox] API keys not configured. Skipping live KYC call (dev mode).');
            kycReferenceId = `DEV_KYC_${Date.now()}`;
        }

        // Step 2: Save KYC record in Supabase
        const { error: dbError } = await supabase.from('kyc').upsert({
            user_id: payload.userId,
            full_name: payload.fullName,
            aadhar_pan: '',                          // Tradebox handles document collection
            bank_account: '',                        // Tradebox handles bank verification
            ifsc_code: '',
            status: 'pending',                       // Tradebox will update via webhook
            tradebox_reference_id: kycReferenceId,  // Store Tradebox's reference ID
            razorpay_payment_id: payload.razorpayPaymentId,
            kyc_initiated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

        if (dbError) {
            console.warn('KYC db save error:', dbError.message);
            return { success: false, error: dbError.message };
        }

        return {
            success: true,
            kycReferenceId,
            kycStatus,
        };
    } catch (err: any) {
        console.warn('Tradebox KYC failed:', err.message);
        return { success: false, error: err.message };
    }
}

// ─── Get KYC Status ───────────────────────────────────────────────────────────
export async function getTradeboxKycStatus(userId: string): Promise<{
    status: 'not_initiated' | 'pending' | 'approved' | 'rejected';
    referenceId?: string;
}> {
    const { data } = await supabase
        .from('kyc')
        .select('status, tradebox_reference_id')
        .eq('user_id', userId)
        .maybeSingle();

    if (!data) return { status: 'not_initiated' };
    return {
        status: (data.status as any) || 'pending',
        referenceId: data.tradebox_reference_id,
    };
}
