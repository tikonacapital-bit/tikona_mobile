import { supabase } from '@/lib/supabase';

// In-memory cache — historical prices never change so we cache indefinitely.
const priceCache = new Map<string, number | null>();

/**
 * Fetches the Nifty 50 closing price for a given date from Supabase nifty_history.
 * If the exact date has no data (weekend / holiday), walks back up to 7 calendar
 * days until a trading day is found.
 *
 * Works on both web and mobile — Supabase has no CORS restrictions.
 *
 * @param dateStr  YYYY-MM-DD
 * @returns closing price, or null if not found
 */
export async function fetchNiftyClose(dateStr: string): Promise<number | null> {
    if (priceCache.has(dateStr)) return priceCache.get(dateStr)!;

    // Walk back up to 7 days to find the nearest trading day
    const d = new Date(dateStr + 'T12:00:00Z');
    for (let attempt = 0; attempt < 7; attempt++) {
        const key = d.toISOString().split('T')[0];
        const { data } = await supabase
            .from('nifty_history')
            .select('close')
            .eq('date', key)
            .maybeSingle();

        if (data?.close) {
            priceCache.set(dateStr, data.close);
            return data.close;
        }
        d.setUTCDate(d.getUTCDate() - 1);
    }

    priceCache.set(dateStr, null);
    return null;
}

/**
 * Returns the most recent available Nifty 50 closing price.
 */
export async function fetchNiftyCurrentClose(): Promise<number | null> {
    const { data } = await supabase
        .from('nifty_history')
        .select('close')
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle();

    return data?.close ?? null;
}
