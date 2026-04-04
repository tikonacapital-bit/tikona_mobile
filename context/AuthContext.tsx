import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { Session } from '@supabase/supabase-js';
import type { KycRecord, UserProfile, Subscription, RefundRequest, AIWallet } from '@/lib/types';

type AuthContextType = {
    userId: string | null;
    user: any | null;
    isLoaded: boolean;
    isSignedIn: boolean;
    // Derived data
    kyc: KycRecord | null;        // Derived from subscription — no DB fetch
    profile: UserProfile | null;
    subscription: Subscription | null;
    refundRequest: RefundRequest | null;
    wallet: AIWallet | null;
    isLoadingData: boolean;
    dataError: boolean;
    // Actions
    refreshUserData: () => Promise<void>;
    refreshWallet: () => Promise<void>;
    signOut: () => Promise<void>;
    getToken: (options?: any) => Promise<string | null>;
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
    wallet: null,
    isLoadingData: true,
    dataError: false,
    refreshUserData: async () => { },
    refreshWallet: async () => { },
    signOut: async () => { },
    getToken: async () => null,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);

    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [subscription, setSubscription] = useState<Subscription | null>(null);
    const [refundRequest, setRefundRequest] = useState<RefundRequest | null>(null);
    const [wallet, setWallet] = useState<AIWallet | null>(null);
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [dataError, setDataError] = useState(false);

    const isFetchingRef = useRef(false);
    const lastSyncedEmailRef = useRef<string | null>(null);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setIsLoaded(true);
        }).catch(err => {
            logger.warn('Error getting session', err);
            setIsLoaded(true);
        });

        const { data: { subscription: authListener } } = supabase.auth.onAuthStateChange(
            (_event, session) => {
                setSession(session);
                if (_event === 'SIGNED_OUT') {
                    setProfile(null);
                    setSubscription(null);
                    setRefundRequest(null);
                    setWallet(null);
                    setIsLoadingData(false);
                    isFetchingRef.current = false;
                }
            }
        );

        return () => {
            authListener.unsubscribe();
        };
    }, []);

    const fetchUserData = useCallback(async (userId: string, primaryEmail?: string) => {
        if (isFetchingRef.current) return;
        isFetchingRef.current = true;
        setIsLoadingData(true);
        try {
            setDataError(false);

            const [profileRes, subRes, refundRes, walletRes] = await Promise.all([
                supabase.from('profiles').select('id, user_id, risk_score, risk_profile, profile_method, display_label, answers, email, created_at, updated_at').eq('user_id', userId).maybeSingle(),
                supabase.from('subscriptions').select('id, user_id, plan, started_at, expires_at, is_active, amount_paid, razorpay_payment_id, created_at, updated_at').eq('user_id', userId).maybeSingle(),
                supabase.from('refund_requests').select('id, user_id, subscription_id, plan, total_paid, months_used, months_remaining, refund_amount, upi_id, status, reason, admin_notes, reviewed_by, reviewed_at, created_at, updated_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
                supabase.from('ai_wallets').select('*').eq('user_id', userId).maybeSingle(),
            ]);

            setProfile(profileRes.data ?? null);
            setSubscription(subRes.data ?? null);
            setRefundRequest(refundRes.data as RefundRequest | null ?? null);
            setWallet(walletRes.data as AIWallet | null ?? null);

            // Sync email to profile if changed
            if (primaryEmail && profileRes.data && primaryEmail !== lastSyncedEmailRef.current && primaryEmail !== profileRes.data.email) {
                lastSyncedEmailRef.current = primaryEmail;
                await supabase
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

    const mappedUser = session?.user ? {
        id: session.user.id,
        primaryEmailAddress: { emailAddress: session.user.email },
        createdAt: session.user.created_at,
        fullName: session.user.user_metadata?.full_name || '',
        imageUrl: session.user.user_metadata?.avatar_url || null,
    } : null;

    const refreshUserData = useCallback(async () => {
        if (session?.user?.id) {
            // Allow re-fetch even if ref was stuck
            isFetchingRef.current = false;
            await fetchUserData(session.user.id, session.user.email);
        }
    }, [session?.user?.id, session?.user?.email, fetchUserData]);

    const refreshWallet = useCallback(async () => {
        if (session?.user?.id) {
            const { data } = await supabase.from('ai_wallets').select('*').eq('user_id', session.user.id).maybeSingle();
            setWallet(data as AIWallet | null ?? null);
        }
    }, [session?.user?.id]);

    useEffect(() => {
        if (isLoaded && session?.user?.id) {
            fetchUserData(session.user.id, session.user.email);
        }
    }, [isLoaded, session?.user?.id, fetchUserData]);

    const signOut = useCallback(async () => {
        try {
            await supabase.auth.signOut();
        } catch (error) {
            logger.warn('Supabase sign out error:', error);
        }
    }, []);

    const getToken = useCallback(async (_options?: any) => {
        const { data } = await supabase.auth.getSession();
        return data.session?.access_token || null;
    }, []);

    // KYC is derived from subscription: payment done = KYC approved (one-time, permanent).
    // No DB fetch required — if user has an active subscription, they are verified.
    const derivedKyc = subscription?.is_active
        ? ({ status: 'approved', user_id: session?.user?.id ?? '' } as KycRecord)
        : null;

    return (
        <AuthContext.Provider
            value={{
                userId: session?.user?.id ?? null,
                user: mappedUser,
                isLoaded,
                isSignedIn: !!session,
                kyc: derivedKyc,
                profile,
                subscription,
                refundRequest,
                wallet,
                isLoadingData,
                dataError,
                refreshUserData,
                refreshWallet,
                signOut,
                getToken,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};
