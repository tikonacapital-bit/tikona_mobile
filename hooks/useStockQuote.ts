import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState, Platform } from 'react-native';

// CORS proxy for web — Yahoo Finance and Screener.in don't send CORS headers
const CORS_PROXY = 'https://corsproxy.io/?url=';

// ─── Live Quote (from Yahoo v8 chart API meta) ───
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

// ─── Screener.in Fundamentals ───
export interface ScreenerData {
    marketCap: number | null;       // in Crores
    currentPrice: number | null;
    highLow: string | null;         // e.g. "1,612 / 1,115"
    stockPE: number | null;
    bookValue: number | null;
    dividendYield: number | null;
    roce: number | null;
    roe: number | null;
    faceValue: number | null;
    // Pros & cons
    pros: string[];
    cons: string[];
    // Company info
    description: string | null;
    sector: string | null;
    industry: string | null;
    website: string | null;
    fetchedAt: Date;
}

// ─── Parse Screener.in HTML ───
function parseScreenerHtml(html: string): Partial<ScreenerData> {
    const data: Partial<ScreenerData> = {};

    const parseNum = (s: string | null | undefined): number | null => {
        if (!s) return null;
        const cleaned = s.replace(/[₹,%\s]/g, '').replace(/,/g, '');
        const n = parseFloat(cleaned);
        return isNaN(n) ? null : n;
    };

    // ── Step 1: Extract top ratios ──
    // Find all <li> blocks that have a <span class="name"> and <span class="number">
    // These are the top ratios on Screener.in
    const ratioPattern = /<span\s+class="name">\s*(.*?)\s*<\/span>[\s\S]*?<span\s+class="number">\s*([\s\S]*?)\s*<\/span>/gi;
    const ratios: Record<string, string> = {};
    let rMatch;
    while ((rMatch = ratioPattern.exec(html)) !== null) {
        const name = rMatch[1].replace(/<[^>]+>/g, '').trim();
        const value = rMatch[2].replace(/<[^>]+>/g, '').trim();
        if (name && value) {
            ratios[name] = value;
        }
    }

    data.marketCap = parseNum(ratios['Market Cap']);
    data.currentPrice = parseNum(ratios['Current Price']);
    data.stockPE = parseNum(ratios['Stock P/E']);
    data.bookValue = parseNum(ratios['Book Value']);
    data.dividendYield = parseNum(ratios['Dividend Yield']);
    data.roce = parseNum(ratios['ROCE']);
    data.roe = parseNum(ratios['ROE']);
    data.faceValue = parseNum(ratios['Face Value']);

    // High / Low - special format "₹ 3,710 / 2,552"
    const hlRaw = ratios['High / Low'];
    if (hlRaw) {
        const hlNums = hlRaw.match(/[\d,]+/g);
        if (hlNums && hlNums.length >= 2) {
            data.highLow = `₹${hlNums[0]} / ₹${hlNums[1]}`;
        }
    }

    // ── Step 2: Extract Pros & Cons ──
    // ── Step 2: Extract Pros & Cons ──
    // Screener uses: <p class="title">Pros</p> <ul><li>...</li></ul>
    // and: <p class="title">Cons</p> <ul><li>...</li></ul>

    // Extract Pros
    const prosMatch = html.match(/<p\s+class="title">\s*Pros\s*<\/p>\s*<ul>([\s\S]*?)<\/ul>/i);
    if (prosMatch) {
        const items = prosMatch[1].match(/<li[^>]*>([\s\S]*?)<\/li>/gi);
        data.pros = items
            ? items.map(i => i.replace(/<[^>]+>/g, '').trim()).filter(s => s.length > 10)
            : [];
    } else {
        data.pros = [];
    }

    // Extract Cons
    const consMatch = html.match(/<p\s+class="title">\s*Cons\s*<\/p>\s*<ul>([\s\S]*?)<\/ul>/i);
    if (consMatch) {
        const items = consMatch[1].match(/<li[^>]*>([\s\S]*?)<\/li>/gi);
        data.cons = items
            ? items.map(i => i.replace(/<[^>]+>/g, '').trim()).filter(s => s.length > 10)
            : [];
    } else {
        data.cons = [];
    }

    // ── Step 3: Company description ──
    // Screener uses: <div class="company-info"> ... <div class="title">About</div>
    //               <div class="sub show-more-box ..."> description text </div>
    const aboutSection = html.match(
        /class="company-info"[\s\S]*?class="title">\s*About\s*<\/div>\s*<div[^>]*class="sub[^"]*"[^>]*>([\s\S]*?)<\/div>/i
    );
    if (aboutSection) {
        const desc = aboutSection[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
        if (desc.length > 20) {
            data.description = desc;
        }
    }

    // Fallback: find text right after company-profile div
    if (!data.description) {
        const altDesc = html.match(
            /class="company-profile"[\s\S]*?<div[^>]*>([\s\S]{50,1000}?)<\/div>/i
        );
        if (altDesc) {
            const desc = altDesc[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
            if (desc.length > 30) {
                data.description = desc;
            }
        }
    }

    // ── Step 4: Sector from Peer comparison section ──
    const sectorMatch = html.match(
        /id="peers"[\s\S]*?<a[^>]*href="\/market\/[^"]*"[^>]*>([\w\s,&]+)<\/a>\s*<a[^>]*href="\/market\/[^"]*"[^>]*>([\w\s,&]+)<\/a>/
    );
    if (sectorMatch) {
        data.sector = sectorMatch[1].trim();
        data.industry = sectorMatch[2].trim();
    }

    // ── Step 5: Website ──
    const websiteMatch = html.match(/href="(https?:\/\/www\.[^"]+)"[^>]*>\s*[^<]*\.com/i);
    if (websiteMatch) {
        data.website = websiteMatch[1];
    }

    data.fetchedAt = new Date();
    return data;
}

// ─── Fetch live price from Yahoo v8 chart meta ───
async function fetchLiveQuote(symbol: string): Promise<LiveQuote> {
    const yahooSymbol = `${symbol}.NS`;
    const baseUrls = [
        `https://query2.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1m&range=1d&includePrePost=false`,
        `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1m&range=1d&includePrePost=false`,
    ];

    const urls = Platform.OS === 'web'
        ? baseUrls.map(u => CORS_PROXY + encodeURIComponent(u))
        : baseUrls;

    for (const url of urls) {
        try {
            const res = await fetch(url, {
                headers: Platform.OS === 'web'
                    ? {}
                    : { 'User-Agent': 'Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36' },
            });
            if (!res.ok) continue;
            const json = await res.json();
            const meta = json.chart?.result?.[0]?.meta;
            if (!meta) continue;

            const currentPrice = meta.regularMarketPrice ?? 0;
            const previousClose = meta.chartPreviousClose ?? meta.previousClose ?? 0;
            const change = currentPrice - previousClose;
            const changePct = previousClose > 0 ? (change / previousClose) * 100 : 0;

            return {
                symbol,
                companyName: meta.longName || meta.shortName || symbol,
                currentPrice,
                previousClose,
                change,
                changePct,
                dayHigh: meta.regularMarketDayHigh ?? 0,
                dayLow: meta.regularMarketDayLow ?? 0,
                volume: meta.regularMarketVolume ?? 0,
                high52Week: meta.fiftyTwoWeekHigh ?? null,
                low52Week: meta.fiftyTwoWeekLow ?? null,
                lastUpdated: new Date(),
            };
        } catch { /* try next */ }
    }
    throw new Error(`Failed to fetch quote for ${symbol}`);
}

// ─── Fetch fundamentals from Screener.in ───
async function fetchScreenerData(symbol: string): Promise<ScreenerData> {
    // Try consolidated first, then standalone
    const baseUrls = [
        `https://www.screener.in/company/${symbol}/consolidated/`,
        `https://www.screener.in/company/${symbol}/`,
    ];

    const urls = Platform.OS === 'web'
        ? baseUrls.map(u => CORS_PROXY + encodeURIComponent(u))
        : baseUrls;

    for (const url of urls) {
        try {
            const res = await fetch(url, {
                headers: Platform.OS === 'web'
                    ? { 'Accept': 'text/html' }
                    : {
                        'User-Agent': 'Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36',
                        'Accept': 'text/html',
                    },
            });
            if (!res.ok) continue;
            const html = await res.text();
            const parsed = parseScreenerHtml(html);
            if (parsed.marketCap != null || parsed.stockPE != null) {
                return {
                    marketCap: parsed.marketCap ?? null,
                    currentPrice: parsed.currentPrice ?? null,
                    highLow: parsed.highLow ?? null,
                    stockPE: parsed.stockPE ?? null,
                    bookValue: parsed.bookValue ?? null,
                    dividendYield: parsed.dividendYield ?? null,
                    roce: parsed.roce ?? null,
                    roe: parsed.roe ?? null,
                    faceValue: parsed.faceValue ?? null,
                    pros: parsed.pros ?? [],
                    cons: parsed.cons ?? [],
                    description: parsed.description ?? null,
                    sector: parsed.sector ?? null,
                    industry: parsed.industry ?? null,
                    website: parsed.website ?? null,
                    fetchedAt: new Date(),
                };
            }
        } catch { /* try next */ }
    }
    throw new Error(`Failed to fetch Screener data for ${symbol}`);
}

// ─── Combined Hook ───
interface UseStockQuoteOptions {
    enabled?: boolean;
    refreshIntervalMs?: number;
}

export function useStockQuote(
    symbol: string | undefined,
    options: UseStockQuoteOptions = {}
) {
    const { enabled = true, refreshIntervalMs = 30000 } = options;
    const [quote, setQuote] = useState<LiveQuote | null>(null);
    const [screener, setScreener] = useState<ScreenerData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const loadQuote = useCallback(async (showLoading = false) => {
        if (!symbol) return;
        if (showLoading) setLoading(true);
        setError(null);

        try {
            const data = await fetchLiveQuote(symbol);
            setQuote(data);
        } catch (err: any) {
            if (showLoading) setError(err.message || 'Failed to fetch');
        } finally {
            if (showLoading) setLoading(false);
        }
    }, [symbol]);

    // Fetch Screener data once (fundamentals don't change frequently)
    const loadScreener = useCallback(async () => {
        if (!symbol) return;
        try {
            const data = await fetchScreenerData(symbol);
            setScreener(data);
        } catch {
            // Screener data is optional — don't block the UI
        }
    }, [symbol]);

    useEffect(() => {
        if (!enabled || !symbol) return;

        loadQuote(true);
        loadScreener();

        // Auto-refresh live price
        const startPolling = () => {
            if (timerRef.current) clearInterval(timerRef.current);
            timerRef.current = setInterval(() => {
                loadQuote(false);
            }, refreshIntervalMs);
        };

        startPolling();

        // AppState listener only needed on native
        let sub: any = null;
        if (Platform.OS !== 'web') {
            sub = AppState.addEventListener('change', (state) => {
                if (state === 'active') {
                    loadQuote(false);
                    startPolling();
                } else {
                    if (timerRef.current) clearInterval(timerRef.current);
                }
            });
        }

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            if (sub) sub.remove();
        };
    }, [enabled, symbol, loadQuote, loadScreener, refreshIntervalMs]);

    return { quote, screener, loading, error, refresh: () => loadQuote(false) };
}
