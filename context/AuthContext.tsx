import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { View, Platform } from 'react-native';
import { useUser, useClerk, useAuth as useClerkAuth } from '@clerk/clerk-expo';
import * as SecureStore from 'expo-secure-store';
import { supabase, getAuthenticatedSupabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import type { KycRecord, UserProfile, Subscription, RefundRequest } from '@/lib/types';

type AuthContextType = {
    userId: string | null;
    user: ReturnType<typeof useUser>['user'];
    isLoaded: boolean;
    isSignedIn: boolean;
    // Derived data
    kyc: KycRecord | null;
    profile: UserProfile | null;
    subscription: Subscription | null;
    refundRequest: RefundRequest | null;
    isLoadingData: boolean;
    dataError: boolean;
    // Actions
    refreshUserData: () => Promise<void>;
    signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
    userId: null,
    user: null,
    isLoaded: false,
    isSignedIn: false,
    kyc: null,
    profile: null,
    subscription: null,
    refundRequest: null,
    isLoadingData: true,
    dataError: false,
    refreshUserData: async () => { },
    signOut: async () => { },
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const { isLoaded, isSignedIn, userId: clerkUserId, getToken } = useClerkAuth();
    const { user } = useUser();
    const { signOut: clerkSignOut } = useClerk();

    const [kyc, setKyc] = useState<KycRecord | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [subscription, setSubscription] = useState<Subscription | null>(null);
    const [refundRequest, setRefundRequest] = useState<RefundRequest | null>(null);
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [dataError, setDataError] = useState(false);

    const getTokenRef = useRef(getToken);
    getTokenRef.current = getToken;
    const isFetchingRef = useRef(false);
    const lastSyncedEmailRef = useRef<string | null>(null);

    const fetchUserData = useCallback(async (userId: string, primaryEmail?: string) => {
        if (isFetchingRef.current) return;
        isFetchingRef.current = true;
        setIsLoadingData(true);
        try {
            setDataError(false);

            // Get a Clerk JWT for Supabase so RLS policies can identify the user
            const token = await getTokenRef.current({ template: 'supabase' });
            if (!token) {
                logger.warn('No Clerk token available — cannot fetch user data with RLS');
                setDataError(true);
                setIsLoadingData(false);
                return;
            }
            const client = getAuthenticatedSupabase(token);

            const [kycRes, profileRes, subRes, refundRes] = await Promise.all([
                client.from('kyc').select('id, user_id, full_name, aadhar_pan, bank_account, ifsc_code, status, tradebox_reference_id, razorpay_payment_id, kyc_initiated_at, created_at, updated_at').eq('user_id', userId).maybeSingle(),
                client.from('profiles').select('id, user_id, risk_score, risk_profile, profile_method, display_label, answers, email, created_at, updated_at').eq('user_id', userId).maybeSingle(),
                client.from('subscriptions').select('id, user_id, plan, started_at, expires_at, is_active, amount_paid, razorpay_payment_id, created_at, updated_at').eq('user_id', userId).maybeSingle(),
                client.from('refund_requests').select('id, user_id, subscription_id, plan, total_paid, months_used, months_remaining, refund_amount, upi_id, status, reason, admin_notes, reviewed_by, reviewed_at, created_at, updated_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
            ]);
            // Tradebox instant e-KYC: payment via Tradebox includes KYC.
            // Only paid plans go through Tradebox checkout (which includes KYC).
            // Free plan subscriptions are created locally after quiz — no Tradebox KYC happens there.
            const hasPaidSubscription = subRes.data?.is_active && subRes.data?.plan !== 'free';
            const kycData = hasPaidSubscription
                ? ({ status: 'approved' } as any)
                : (kycRes.data ?? null);

            setKyc(kycData);
            setProfile(profileRes.data ?? null);
            setSubscription(subRes.data ?? null);
            setRefundRequest(refundRes.data as RefundRequest | null ?? null);

            // Keep email synced in profiles — only if it actually changed
            if (primaryEmail && profileRes.data && primaryEmail !== lastSyncedEmailRef.current && primaryEmail !== profileRes.data.email) {
                lastSyncedEmailRef.current = primaryEmail;
                await client
                    .from('profiles')
                    .update({ email: primaryEmail })
                    .eq('user_id', userId);
            }
        } catch (e) {
            logger.warn('Failed to fetch user data:', e);
            setDataError(true);
        } finally {
            isFetchingRef.current = false;
            setIsLoadingData(false);
        }
    }, []);

    const refreshUserData = useCallback(async () => {
        if (user?.id) {
            const email = user.primaryEmailAddress?.emailAddress;
            await fetchUserData(user.id, email);
        }
    }, [user?.id, user?.primaryEmailAddress?.emailAddress, fetchUserData]);

    // Fetch user data when Clerk user changes
    useEffect(() => {
        if (isLoaded && isSignedIn && user?.id) {
            const email = user.primaryEmailAddress?.emailAddress;
            fetchUserData(user.id, email);
        } else if (isLoaded && !isSignedIn) {
            // Clear data when signed out
            setKyc(null);
            setProfile(null);
            setSubscription(null);
            setRefundRequest(null);
            setIsLoadingData(false);
        }
    }, [isLoaded, isSignedIn, user?.id, fetchUserData]);

    const signOut = useCallback(async () => {
        try {
            await clerkSignOut();
            // Manually clear the clerk token cache to prevent "session already exists" issue
            if (Platform.OS !== 'web') {
                await SecureStore.deleteItemAsync('__clerk_client_jwt');
            }
        } catch (error) {
            logger.warn('Clerk sign out error:', error);
        }
        // Clear local state
        setKyc(null);
        setProfile(null);
        setSubscription(null);
        setRefundRequest(null);
    }, [clerkSignOut]);

    return (
        <AuthContext.Provider
            value={{
                userId: clerkUserId ?? null,
                user: user ?? null,
                isLoaded: !!isLoaded,
                isSignedIn: !!isSignedIn,
                kyc,
                profile,
                subscription,
                refundRequest,
                isLoadingData,
                dataError,
                refreshUserData,
                signOut
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};
