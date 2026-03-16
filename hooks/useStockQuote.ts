import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface LiveQuote {
    symbol: string;
    companyName: string;
    currentPrice: number;
    previousClose: number;
    change: number;
    changePct: number;
    dayHigh: number;
    dayLow: number;
    volume: number;
    high52Week: number | null;
    low52Week: number | null;
    lastUpdated: Date;
}

export interface ScreenerData {
    marketCap: number | null;
    currentPrice: number | null;
    highLow: string | null;
    stockPE: number | null;
    bookValue: number | null;
    dividendYield: number | null;
    roce: number | null;
    roe: number | null;
    faceValue: number | null;
    pros: string[];
    cons: string[];
    description: string | null;
    sector: string | null;
    industry: string | null;
    website: string | null;
    fetchedAt: Date;
}

interface UseStockQuoteOptions {
    enabled?: boolean;
    refreshIntervalMs?: number;
}

export function useStockQuote(
    symbol: string | undefined,
    options: UseStockQuoteOptions = {}
) {
    const { enabled = true } = options;
    const [quote, setQuote] = useState<LiveQuote | null>(null);
    const [screener, setScreener] = useState<ScreenerData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        if (!symbol) return;
        setLoading(true);
        setError(null);

        try {
            const { data, error: dbErr } = await supabase
                .from('equity_universe')
                .select('*')
                .eq('nse_code', symbol)
                .maybeSingle();

            if (dbErr) throw new Error(dbErr.message);
            if (!data) throw new Error(`No data found for ${symbol}`);

            const price = data.current_price ?? 0;

            setQuote({
                symbol,
                companyName: data.company_name || symbol,
                currentPrice: price,
                previousClose: 0,
                change: 0,
                changePct: 0,
                dayHigh: data.high_52_week ?? 0,
                dayLow: data.low_52_week ?? 0,
                volume: 0,
                high52Week: data.high_52_week ?? null,
                low52Week: data.low_52_week ?? null,
                lastUpdated: new Date(),
            });

            setScreener({
                marketCap: data.market_cap ?? null,
                currentPrice: price,
                highLow: data.high_52_week != null && data.low_52_week != null
                    ? `₹${data.high_52_week.toLocaleString('en-IN')} / ₹${data.low_52_week.toLocaleString('en-IN')}`
                    : null,
                stockPE: data.pe_ttm ?? null,
                bookValue: data.book_value ?? null,
                dividendYield: null,
                roce: data.roce ?? null,
                roe: data.roe ?? null,
                faceValue: null,
                pros: [],
                cons: [],
                description: null,
                sector: data.sector ?? null,
                industry: data.industry ?? null,
                website: null,
                fetchedAt: new Date(),
            });
        } catch (err: any) {
            setError(err.message || 'Failed to load');
        } finally {
            setLoading(false);
        }
    }, [symbol]);

    useEffect(() => {
        if (!enabled || !symbol) return;
        load();
    }, [enabled, symbol, load]);

    return { quote, screener, loading, error, refresh: load };
}
