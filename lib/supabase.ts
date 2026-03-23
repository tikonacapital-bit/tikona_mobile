import 'react-native-url-polyfill/auto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

// Clerk handles authentication — Supabase is used for data only.
// Disable Supabase's built-in auth to prevent conflicts with Clerk.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
    },
});

/**
 * Create an authenticated Supabase client using a Clerk JWT.
 * This allows Supabase RLS policies to identify the user via `auth.jwt() ->> 'sub'`.
 *
 * Prerequisites (one-time setup in Supabase Dashboard):
 *   1. Settings → API → JWT Settings → add your Clerk JWT public key
 *      (found in Clerk Dashboard → JWT Templates → create a "supabase" template)
 *   2. Enable RLS on every table and add policies using `auth.jwt() ->> 'sub'`
 *
 * Usage:
 *   const { getToken } = useAuth();
 *   const client = getAuthenticatedSupabase(await getToken({ template: 'supabase' }));
 *   const { data } = await client.from('profiles').select('*');
 */
export function getAuthenticatedSupabase(clerkToken: string | null): SupabaseClient {
    return createClient(supabaseUrl, supabaseAnonKey, {
        global: {
            headers: {
                Authorization: `Bearer ${clerkToken}`,
            },
        },
        auth: {
            autoRefreshToken: false,
            persistSession: false,
            detectSessionInUrl: false,
        },
    });
}

