import { DonutChart, PnlBarChart, getChartColor } from '@/components/charts';
import { Card, EmptyState, MetricCard, ResponsiveScrollView } from '@/components/ui';
import { BorderRadius, Colors, FontSize, Spacing } from '@/constants/theme';
import { useAlert } from '@/context/AlertContext';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { fetchNiftyClose, fetchNiftyCurrentClose } from '@/lib/niftyBhavcopy';
import { getAuthenticatedSupabase, supabase } from '@/lib/supabase';
import type { EnrichedHolding } from '@/lib/types';
import { computeXIRR, type Cashflow } from '@/lib/xirr';
import { useAuth as useClerkAuth } from '@/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    FlatList,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as XLSX from 'xlsx';

export default function PortfolioScreen() {
    const theme = useColorScheme();
    const isDark = theme === 'dark';
    const c = Colors[theme];
    const { user } = useAuth();
    const { getToken } = useClerkAuth();
    const { showAlert } = useAlert();
    const queryClient = useQueryClient();
    const [refreshing, setRefreshing] = useState(false);

    const [showAdd, setShowAdd] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [transactionType, setTransactionType] = useState<'BUY' | 'SELL'>('BUY');
    const [symbol, setSymbol] = useState('');
    const [qty, setQty] = useState('');
    const [buyPrice, setBuyPrice] = useState('');
    const [sellPrice, setSellPrice] = useState('');
    const [investmentThesis, setInvestmentThesis] = useState('');
    const [buyDateText, setBuyDateText] = useState(''); // DD/MM/YYYY typed input
    const [buyDateISO, setBuyDateISO] = useState('');   // ISO string sent to DB

    // Format a Date → DD/MM/YYYY for display
    const formatDateDisplay = (d: Date) =>
        `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

    // Parse DD/MM/YYYY → ISO date string; returns '' if invalid
    const parseDDMMYYYY = (text: string): string => {
        const parts = text.split('/');
        if (parts.length !== 3) return '';
        const [dd, mm, yyyy] = parts.map(Number);
        if (!dd || !mm || !yyyy || yyyy < 1990 || yyyy > new Date().getFullYear()) return '';
        const d = new Date(yyyy, mm - 1, dd);
        if (isNaN(d.getTime()) || d > new Date()) return '';
        return d.toISOString().split('T')[0]; // YYYY-MM-DD
    };

    // Quick-pick shortcuts
    const applyDateShortcut = (daysAgo: number) => {
        const d = new Date();
        d.setDate(d.getDate() - daysAgo);
        setBuyDateText(formatDateDisplay(d));
        setBuyDateISO(d.toISOString().split('T')[0]);
    };

    const onDateSelected = (event: any, selectedDate?: Date) => {
        if (Platform.OS !== 'ios') {
            setShowDatePicker(false);
        }
        if (selectedDate) {
            setBuyDateText(formatDateDisplay(selectedDate));
            setBuyDateISO(selectedDate.toISOString().split('T')[0]);
        }
    };

    // Handle manual DD/MM/YYYY typing with auto-slash insertion
    const handleBuyDateChange = (raw: string) => {
        // Strip non-digits except slashes already present
        let digits = raw.replace(/[^\d]/g, '');
        let formatted = '';
        if (digits.length > 0) formatted = digits.slice(0, 2);
        if (digits.length > 2) formatted += '/' + digits.slice(2, 4);
        if (digits.length > 4) formatted += '/' + digits.slice(4, 8);
        setBuyDateText(formatted);
        // Try to parse only when fully entered (10 chars: DD/MM/YYYY)
        if (formatted.length === 10) {
            const iso = parseDDMMYYYY(formatted);
            setBuyDateISO(iso);
        } else {
            setBuyDateISO('');
        }
    };

    const slideAnim = useRef(new Animated.Value(0)).current;
    const backdropAnim = useRef(new Animated.Value(0)).current;

    const [showThesisModal, setShowThesisModal] = useState(false);
    const [selectedHolding, setSelectedHolding] = useState<EnrichedHolding | null>(null);
    const [thesisInput, setThesisInput] = useState('');
    const [thesisFeedback, setThesisFeedback] = useState('');
    const [thesisTokensUsed, setThesisTokensUsed] = useState<number | null>(null);
    const [isCheckingThesis, setIsCheckingThesis] = useState(false);


    // ── Excel Import state ──
    type ExcelRow = { date: string; symbol: string; action: 'BUY' | 'SELL'; quantity: number; price: number; thesis: string; valid: boolean; error?: string };
    const [showExcelImport, setShowExcelImport] = useState(false);
    const [showExcelGuide, setShowExcelGuide] = useState(false);
    const [excelRows, setExcelRows] = useState<ExcelRow[]>([]);
    const [isParsingExcel, setIsParsingExcel] = useState(false);
    const [isBatchImporting, setIsBatchImporting] = useState(false);
    const [importProgress, setImportProgress] = useState(0);
    const [excelFileName, setExcelFileName] = useState('');

    // Convert Excel serial date number to ISO string
    const excelSerialToISO = (serial: number): string => {
        const utcDays = Math.floor(serial - 25569);
        const utcValue = utcDays * 86400;
        const d = new Date(utcValue * 1000);
        return d.toISOString().split('T')[0];
    };

    // Parse a cell value to a date ISO string
    const parseCellDate = (val: any): string => {
        if (!val) return '';
        if (typeof val === 'number') return excelSerialToISO(val);
        const s = String(val).trim();
        // DD/MM/YYYY or DD-MM-YYYY
        const m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
        if (m) {
            const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
            if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
        }
        // YYYY-MM-DD
        const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (m2) return s;
        return '';
    };

    const pickExcelFile = async () => {
        try {
            setIsParsingExcel(true);
            const result = await DocumentPicker.getDocumentAsync({
                type: [
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'application/vnd.ms-excel',
                    'text/csv',
                    '*/*',
                ],
                copyToCacheDirectory: true,
            });
            if (result.canceled || !result.assets?.length) { setIsParsingExcel(false); return; }
            const file = result.assets[0];
            setExcelFileName(file.name || 'file');

            const b64 = await FileSystem.readAsStringAsync(file.uri, { encoding: 'base64' as any });
            const wb = XLSX.read(b64, { type: 'base64', cellDates: false });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

            // Skip header row, parse data rows
            const rows: ExcelRow[] = [];
            for (let i = 1; i < raw.length; i++) {
                const r = raw[i];
                if (!r || r.every((c: any) => !c)) continue; // skip blank rows
                const [col0, col1, col2, col3, col4, col5] = r;
                const dateISO = parseCellDate(col0);
                const sym = String(col1 || '').trim().toUpperCase();
                const actionRaw = String(col2 || '').trim().toUpperCase();
                const action: 'BUY' | 'SELL' = actionRaw === 'SELL' ? 'SELL' : 'BUY';
                const quantity = parseFloat(String(col3 || ''));
                const price = parseFloat(String(col4 || ''));
                const thesis = String(col5 || '').trim();

                let error = '';
                if (!sym) error = 'Missing symbol';
                else if (isNaN(quantity) || quantity <= 0) error = 'Invalid quantity';
                else if (isNaN(price) || price <= 0) error = 'Invalid price';

                rows.push({ date: dateISO, symbol: sym, action, quantity, price, thesis, valid: !error, error });
            }
            setExcelRows(rows);
            setShowExcelImport(true);
        } catch (e: any) {
            showAlert('Error', 'Could not read the file. Please use a valid .xlsx or .csv format.');
        } finally {
            setIsParsingExcel(false);
        }
    };

    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<{ nse_code: string; company_name?: string }[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    const openModal = useCallback(() => {
        setShowAdd(true);
        Animated.parallel([
            Animated.timing(slideAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
            Animated.timing(backdropAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        ]).start();
    }, [slideAnim, backdropAnim]);

    const closeModal = useCallback(() => {
        if (Platform.OS !== 'web') Keyboard.dismiss();
        Animated.parallel([
            Animated.timing(slideAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
            Animated.timing(backdropAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
        ]).start(() => {
            setShowAdd(false);
            setSearchQuery('');
            setSearchResults([]);
            setBuyDateText('');
            setBuyDateISO('');
            setInvestmentThesis('');
        });
    }, [slideAnim, backdropAnim]);

    useEffect(() => {
        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        if (!searchQuery || searchQuery.length < 1) {
            setSearchResults([]);
            setIsSearching(false);
            return;
        }
        searchTimeout.current = setTimeout(async () => {
            setIsSearching(true);
            try {
                const { data } = await supabase
                    .from('equity_universe')
                    .select('nse_code, company_name')
                    .or(`nse_code.ilike.%${searchQuery}%,company_name.ilike.%${searchQuery}%`)
                    .limit(8);
                setSearchResults(data || []);
            } catch {
                setSearchResults([]);
            }
            setIsSearching(false);
        }, 300);
        return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
    }, [searchQuery]);

    const { data: portfolio, isLoading: portfolioLoading } = useQuery({
        queryKey: ['portfolio', user?.id],
        queryFn: async () => {
            if (!user?.id) return null;
            const token = await getToken({ template: 'supabase' });
            const client = getAuthenticatedSupabase(token);

            const { data: existing, error: fetchError } = await client.from('customer_portfolios').select('id, user_id, name, created_at, updated_at').eq('user_id', user.id).limit(1);
            if (fetchError) throw new Error(fetchError.message);
            if (existing && existing.length > 0) return existing[0];
            const { data: created, error: insertError } = await client.from('customer_portfolios').insert({ user_id: user.id, name: 'My Portfolio' }).select('id, user_id, name, created_at, updated_at').single();
            if (insertError) throw new Error(insertError.message);
            return created;
        },
        enabled: !!user?.id,
    });


    const runBatchImport = async () => {
        if (!portfolio?.id) return;
        const buyRows = excelRows.filter(r => r.valid && r.action === 'BUY');
        if (!buyRows.length) { showAlert('Nothing to import', 'No valid BUY rows found.'); return; }
        setIsBatchImporting(true);
        setImportProgress(0);
        const token = await getToken({ template: 'supabase' });
        const client = getAuthenticatedSupabase(token);
        let done = 0;
        const errors: string[] = [];
        for (const row of buyRows) {
            try {
                const { error } = await client.from('portfolio_holdings').insert({
                    portfolio_id: portfolio.id,
                    nse_symbol: row.symbol,
                    company_name: row.symbol,
                    quantity: row.quantity,
                    buy_price: row.price,
                    ...(row.date ? { buy_date: row.date } : {}),
                    ...(row.thesis ? { investment_thesis: row.thesis } : {}),
                });
                if (error) errors.push(`${row.symbol}: ${error.message}`);
            } catch (e: any) {
                errors.push(`${row.symbol}: ${e.message}`);
            }
            done++;
            setImportProgress(Math.round((done / buyRows.length) * 100));
        }
        setIsBatchImporting(false);
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['holdings'] }),
        ]);
        setShowExcelImport(false);
        setExcelRows([]);
        if (errors.length) {
            showAlert('Import Complete', `${done - errors.length}/${buyRows.length} imported.\n${errors.slice(0, 3).join('\n')}`);
        } else {
            showAlert('Import Complete', `${buyRows.length} holding${buyRows.length !== 1 ? 's' : ''} imported successfully!`);
        }
    };

    const { data: holdings, isLoading } = useQuery({
        queryKey: ['holdings', portfolio?.id],
        queryFn: async (): Promise<EnrichedHolding[]> => {
            if (!portfolio?.id) return [];
            const token = await getToken({ template: 'supabase' });
            const client = getAuthenticatedSupabase(token);

            const { data: raw } = await client.from('portfolio_holdings').select('id, portfolio_id, nse_symbol, company_name, quantity, buy_price, buy_date, investment_thesis, created_at, updated_at').eq('portfolio_id', portfolio.id).order('created_at', { ascending: false });
            if (!raw?.length) return [];
            const symbols = [...new Set(raw.map((h: any) => h.nse_symbol))];
            const { data: universe } = await supabase.from('equity_universe').select('nse_code, current_price, sector').in('nse_code', symbols);
            const priceMap = new Map((universe || []).map((u: any) => [u.nse_code, u]));

            // Live prices come from equity_universe (updated by backend cron).
            // No client-side Yahoo Finance calls needed — avoids CORS issues on web.

            return raw.map((h: any) => {
                const u = priceMap.get(h.nse_symbol);
                const invested = h.quantity * h.buy_price;
                const currentValue = u?.current_price != null ? h.quantity * u.current_price : null;
                const pnl = currentValue != null ? currentValue - invested : null;
                return { ...h, current_price: u?.current_price ?? null, sector: u?.sector ?? null, invested, current_value: currentValue, pnl, pnl_pct: pnl != null && invested > 0 ? (pnl / invested) * 100 : null };
            });
        },
        enabled: !!portfolio?.id,
        staleTime: 30000,
    });

    const totalInvested = holdings?.reduce((s, h) => s + h.invested, 0) ?? 0;
    const totalCurrent = holdings?.reduce((s, h) => s + (h.current_value ?? h.invested), 0) ?? 0;
    const totalPnl = totalCurrent - totalInvested;
    const totalPnlPct = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;

    // ── Portfolio Metrics — computed on-device using XIRR + Nifty prices ──
    type IrrData = { portfolioIrr: number; niftyIrr: number | null; alpha: number | null; avgHoldingDays: number; avgHoldingYears: number; validCount: number };
    const [irrData, setIrrData] = useState<IrrData | null>(null);
    const [metricsLoading, setMetricsLoading] = useState(false);

    useEffect(() => {
        if (!holdings?.length) { setIrrData(null); return; }
        let cancelled = false;
        const compute = async () => {
            setMetricsLoading(true);
            try {
                const today = new Date();
                const buyHoldings = holdings.filter(h => !h.investment_thesis?.startsWith('[SELL]'));
                const sellHoldings = holdings.filter(h => h.investment_thesis?.startsWith('[SELL]'));

                const portfolioCfs: Cashflow[] = [];
                const niftyCfs: Cashflow[] = [];
                const niftyUnitsMap: Record<string, number> = {};
                const buyQtyMap: Record<string, number> = {};
                let totalHoldingDays = 0;
                let validCount = 0;

                for (const h of buyHoldings) {
                    const buyDateStr = (h.buy_date || h.created_at || '').slice(0, 10);
                    if (!buyDateStr) continue;
                    const buyDate = new Date(buyDateStr + 'T12:00:00Z');
                    const holdingDays = Math.floor((today.getTime() - buyDate.getTime()) / 86400000);
                    if (holdingDays < 1) continue;
                    const invested = h.quantity * h.buy_price;
                    portfolioCfs.push({ amount: -invested, date: buyDate });
                    totalHoldingDays += holdingDays;
                    validCount++;
                    const niftyBuyPrice = await fetchNiftyClose(buyDateStr);
                    if (niftyBuyPrice && niftyBuyPrice > 0) {
                        niftyCfs.push({ amount: -invested, date: buyDate });
                        buyQtyMap[h.nse_symbol] = (buyQtyMap[h.nse_symbol] || 0) + h.quantity;
                        niftyUnitsMap[h.nse_symbol] = (niftyUnitsMap[h.nse_symbol] || 0) + invested / niftyBuyPrice;
                    }
                }

                if (validCount === 0 || cancelled) { setIrrData(null); return; }

                const soldQtyMap: Record<string, number> = {};
                // Track remaining qty per symbol so sell ratio uses remaining, not original total
                const remainingQtyMap: Record<string, number> = { ...buyQtyMap };
                // Process sells in chronological order so proportions are correct
                const sortedSells = [...sellHoldings].sort((a, b) =>
                    (a.buy_date || a.created_at || '').localeCompare(b.buy_date || b.created_at || '')
                );
                for (const h of sortedSells) {
                    const sellDateStr = (h.buy_date || h.created_at || '').slice(0, 10);
                    if (!sellDateStr) continue;
                    const sellDate = new Date(sellDateStr + 'T12:00:00Z');
                    portfolioCfs.push({ amount: h.quantity * h.buy_price, date: sellDate });
                    soldQtyMap[h.nse_symbol] = (soldQtyMap[h.nse_symbol] || 0) + h.quantity;
                    const niftySellPrice = await fetchNiftyClose(sellDateStr);
                    const remainingQty = remainingQtyMap[h.nse_symbol] || 0;
                    const remainingNiftyUnits = niftyUnitsMap[h.nse_symbol] || 0;
                    if (niftySellPrice && remainingQty > 0 && remainingNiftyUnits > 0) {
                        const sellRatio = Math.min(h.quantity / remainingQty, 1);
                        const unitsSold = sellRatio * remainingNiftyUnits;
                        niftyCfs.push({ amount: unitsSold * niftySellPrice, date: sellDate });
                        niftyUnitsMap[h.nse_symbol] = Math.max(0, remainingNiftyUnits - unitsSold);
                    }
                    remainingQtyMap[h.nse_symbol] = Math.max(0, remainingQty - h.quantity);
                }

                let portfolioCurrentValue = 0;
                let niftyCurrentValue = 0;
                const niftyCurrent = await fetchNiftyCurrentClose();
                for (const [sym, totalBuyQty] of Object.entries(buyQtyMap)) {
                    const netQty = Math.max(0, totalBuyQty - (soldQtyMap[sym] || 0));
                    if (netQty > 0) {
                        const h = buyHoldings.find(x => x.nse_symbol === sym);
                        if (h?.current_price != null) portfolioCurrentValue += netQty * h.current_price;
                    }
                    const remainingUnits = niftyUnitsMap[sym] || 0;
                    if (remainingUnits > 0 && niftyCurrent) niftyCurrentValue += remainingUnits * niftyCurrent;
                }

                if (portfolioCurrentValue === 0 && !portfolioCfs.some(cf => cf.amount > 0)) { setIrrData(null); return; }
                if (portfolioCurrentValue > 0) portfolioCfs.push({ amount: portfolioCurrentValue, date: today });

                const portfolioIrr = computeXIRR(portfolioCfs);
                if (isNaN(portfolioIrr) || cancelled) { setIrrData(null); return; }

                let niftyIrr: number | null = null;
                let alpha: number | null = null;
                if (niftyCfs.length >= 1 && niftyCurrentValue > 0) {
                    niftyCfs.push({ amount: niftyCurrentValue, date: today });
                    const rawNifty = computeXIRR(niftyCfs);
                    if (!isNaN(rawNifty)) {
                        niftyIrr = parseFloat(rawNifty.toFixed(1));
                        alpha = parseFloat((portfolioIrr - rawNifty).toFixed(1));
                    }
                }

                const avgHoldingDays = Math.round(totalHoldingDays / validCount);
                if (!cancelled) setIrrData({
                    portfolioIrr: parseFloat(portfolioIrr.toFixed(1)),
                    niftyIrr,
                    alpha,
                    avgHoldingDays,
                    avgHoldingYears: parseFloat((avgHoldingDays / 365.25).toFixed(2)),
                    validCount,
                });
            } catch (e) {
                console.warn('IRR computation failed:', e);
                if (!cancelled) setIrrData(null);
            } finally {
                if (!cancelled) setMetricsLoading(false);
            }
        };
        compute();
        return () => { cancelled = true; };
    }, [holdings]);

    // ── Health & Concentration Logic ──
    const healthScore = useMemo(() => {
        if (!holdings?.length) return 0;
        let score = 50;

        // Diversification
        const sectors = new Set(holdings.map(h => h.sector).filter(Boolean));
        if (sectors.size >= 5) score += 15;
        else if (sectors.size >= 3) score += 5;

        // Stock count
        if (holdings.length >= 10) score += 15;
        else if (holdings.length >= 5) score += 5;

        // Concentration
        const maxConcentration = Math.max(...holdings.map(h => ((h.current_value ?? h.invested) / totalCurrent) * 100));
        if (maxConcentration < 20) score += 10;
        else if (maxConcentration > 40) score -= 10;

        // Performance
        if (totalPnlPct > 15) score += 10;
        else if (totalPnlPct < -5) score -= 5;

        return Math.min(Math.max(score, 0), 100);
    }, [holdings, totalCurrent, totalPnlPct]);



    const allocationData = useMemo(() => {
        if (!holdings?.length) return [];
        return holdings.map((h, i) => ({
            label: h.nse_symbol,
            value: h.current_value ?? h.invested,
            color: getChartColor(i),
        }));
    }, [holdings]);

    const pnlData = useMemo(() => {
        if (!holdings?.length) return [];
        return holdings.filter((h) => h.pnl != null).map((h) => ({ label: h.nse_symbol, value: h.pnl! }));
    }, [holdings]);

    const sectorAllocation = useMemo(() => {
        if (!holdings?.length) return [];
        const map: Record<string, number> = {};
        holdings.forEach(h => {
            const s = h.sector || 'Other';
            map[s] = (map[s] || 0) + (h.current_value ?? h.invested);
        });
        return Object.entries(map).map(([label, value], i) => ({
            label,
            value,
            color: getChartColor(i + 5), // Offset colors
        })).sort((a, b) => b.value - a.value);
    }, [holdings]);

    const lastUpdated = useMemo(() => {
        // In a real app, this would come from the DB. Simulating for now.
        return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }, [holdings]);

    const addMutation = useMutation({
        mutationFn: async () => {
            const priceField = transactionType === 'SELL' ? sellPrice : buyPrice;
            if (!symbol || !qty || !priceField || !buyDateISO) throw new Error('Fill all required fields');
            if (!portfolio?.id) throw new Error('Portfolio not ready');
            const token = await getToken({ template: 'supabase' });
            const client = getAuthenticatedSupabase(token);

            // DB has CHECK quantity > 0, so SELLs are stored with positive quantity.
            // The [SELL] prefix in investment_thesis marks the transaction type.
            const signedQty = Math.abs(parseFloat(qty));

            const thesisPrefix = transactionType === 'SELL' ? '[SELL] ' : '';
            const combinedThesis = thesisPrefix + investmentThesis.trim();

            const { error } = await client.from('portfolio_holdings').insert({
                portfolio_id: portfolio.id,
                nse_symbol: symbol.toUpperCase().trim(),
                company_name: symbol.toUpperCase().trim(),
                quantity: signedQty,
                buy_price: parseFloat(priceField),
                ...(buyDateISO ? { buy_date: buyDateISO } : {}),
                ...(combinedThesis.trim() ? { investment_thesis: combinedThesis.trim() } : {}),
            });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['holdings'] });
            closeModal();
            setSymbol(''); setQty(''); setBuyPrice(''); setSellPrice('');
            setBuyDateText(''); setBuyDateISO('');
            setInvestmentThesis('');
            setTransactionType('BUY');
            setSearchQuery(''); setSearchResults([]);
            showAlert('Added', 'Stock added to portfolio');
        },
        onError: (e) => showAlert('Error', e.message),
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const token = await getToken({ template: 'supabase' });
            const client = getAuthenticatedSupabase(token);
            const { error } = await client.from('portfolio_holdings').delete().eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['holdings'] });
        },
    });

    const checkThesis = async () => {
        if (!selectedHolding || !thesisInput.trim()) return;
        setIsCheckingThesis(true);
        setThesisFeedback('');
        try {
            const token = await getToken({ template: 'supabase' });
            const client = getAuthenticatedSupabase(token);
            await client.from('portfolio_holdings').update({ investment_thesis: thesisInput.trim() }).eq('id', selectedHolding.id!);
            
            queryClient.invalidateQueries({ queryKey: ['holdings'] });

            const res = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/check-thesis`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ symbol: selectedHolding.nse_symbol, thesis: thesisInput.trim() })
            });
            const data = await res.json();
            
            if (!res.ok) {
                if (res.status === 402) {
                    showAlert('Insufficient Credits', 'You need AI Tokens to check market theses.', [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Get Credits', onPress: () => router.push('/buy-credits' as any) }
                    ]);
                    return;
                }
                throw new Error(data.error || 'Failed to check thesis');
            }
            
            setThesisFeedback(data.reply);
            if (data.tokens_used) {
                setThesisTokensUsed(data.tokens_used);
            }

        } catch (e: any) {
            showAlert('Error', e.message);
        } finally {
            setIsCheckingThesis(false);
        }
    };

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await queryClient.invalidateQueries({ queryKey: ['holdings'] });
        setRefreshing(false);
    }, [queryClient]);


    const fmt = (v: number) => `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

    const hasData = holdings && holdings.length > 0;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
            <ResponsiveScrollView
                style={{ flex: 1 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.brand.secondary} />}
            >
                {/* ── Header ── */}
                <View style={styles.header}>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.title, { color: c.text }]}>My Portfolio</Text>
                        <Text style={[styles.subtitle, { color: c.textSecondary }]}>{holdings?.length || 0} holdings</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                            <Ionicons name="time-outline" size={12} color={c.textTertiary} />
                            <Text style={{ color: c.textTertiary, fontSize: 11 }}>
                                Prices updated today at {lastUpdated}
                            </Text>
                        </View>
                    </View>
                    <TouchableOpacity
                        style={[styles.excelBtn, { backgroundColor: c.surfaceElevated, borderColor: c.border }]}
                        onPress={() => setShowExcelGuide(true)}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="document-text-outline" size={18} color={Colors.brand.secondary} />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.addBtn, { backgroundColor: Colors.brand.primary, marginLeft: 8 }]} onPress={openModal} activeOpacity={0.85}>
                        <Ionicons name="add" size={22} color="#fff" />
                    </TouchableOpacity>
                </View>

                {/* ── Summary Metrics ── */}
                {hasData && (
                    <View style={styles.metricsRow}>
                        <MetricCard label="Current Value" value={fmt(totalCurrent)} theme={theme} />
                        <MetricCard label="Health Score" value={`${healthScore}/100`} theme={theme} valueColor={healthScore > 70 ? c.success : healthScore > 40 ? c.warning : c.danger} />
                        <MetricCard label="Total P&L" value={`${totalPnl >= 0 ? '+' : ''}${fmt(totalPnl)}`} theme={theme} valueColor={totalPnl >= 0 ? c.success : c.danger} />
                        <MetricCard label="Total Returns" value={`${totalPnlPct >= 0 ? '+' : ''}${totalPnlPct.toFixed(1)}%`} theme={theme} valueColor={totalPnlPct >= 0 ? c.success : c.danger} />
                    </View>
                )}

                {/* ── AI Insights Banner ── */}
                {hasData && (
                    <View style={styles.aiSection}>
                        <TouchableOpacity
                            onPress={() => router.push({ pathname: '/ai-chat', params: { sector: 'Portfolio Strategy' } } as any)}
                            activeOpacity={0.9}
                        >
                            <View style={[styles.aiBanner, { backgroundColor: Colors.brand.primary }]}>
                                <View style={styles.aiLeft}>
                                    <View style={styles.aiIconWrap}>
                                        <Ionicons name="sparkles" size={20} color="#fff" />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.aiBannerTitle}>AI Analyst Insight</Text>
                                        <Text style={styles.aiBannerSub}>
                                            {healthScore > 80
                                                ? "Your portfolio looks well-diversified. Ready for deep-dive analysis?"
                                                : "I can help you optimize your diversification. Want to chat?"
                                            }
                                        </Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.6)" />
                                </View>
                            </View>
                        </TouchableOpacity>
                    </View>
                )}

                {/* ── Charts ── */}
                {hasData && (
                    <View style={styles.chartsRow}>
                        {/* Allocation Donut */}
                        <Card theme={theme} style={styles.chartCard}>
                            <Text style={[styles.chartTitle, { color: c.text }]}>Allocation</Text>
                            <Text style={[styles.chartSub, { color: c.textTertiary }]}>By current value</Text>
                            <View style={{ marginTop: Spacing.md }}>
                                <DonutChart
                                    data={allocationData}
                                    theme={theme}
                                    centerValue={fmt(totalCurrent)}
                                    centerLabel="Total"
                                    size={160}
                                />
                            </View>
                        </Card>

                        {/* P&L Bar */}
                        {pnlData.length > 0 && (
                            <Card theme={theme} style={styles.chartCard}>
                                <Text style={[styles.chartTitle, { color: c.text }]}>Stock P&L</Text>
                                <Text style={[styles.chartSub, { color: c.textTertiary }]}>Profit / Loss (₹)</Text>
                                <View style={{ marginTop: Spacing.md }}>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                        <PnlBarChart
                                            data={pnlData}
                                            theme={theme}
                                            formatValue={(v) => `${v >= 0 ? '+' : ''}${fmt(v)}`}
                                        />
                                    </ScrollView>
                                </View>
                            </Card>
                        )}

                        {/* Sector Allocation */}
                        {sectorAllocation.length > 0 && (
                            <Card theme={theme} style={styles.chartCard}>
                                <Text style={[styles.chartTitle, { color: c.text }]}>Sector Allocation</Text>
                                <Text style={[styles.chartSub, { color: c.textTertiary }]}>By industry diversification</Text>
                                <View style={{ marginTop: Spacing.md }}>
                                    <DonutChart
                                        data={sectorAllocation}
                                        theme={theme}
                                        centerValue={`${sectorAllocation.length}`}
                                        centerLabel="Sectors"
                                        size={160}
                                    />
                                </View>
                                <View style={styles.sectorList}>
                                    {sectorAllocation.slice(0, 3).map((s, i) => (
                                        <View key={i} style={styles.sectorRow}>
                                            <View style={[styles.sectorDot, { backgroundColor: s.color }]} />
                                            <Text style={[styles.sectorLabel, { color: c.textSecondary }]}>{s.label}</Text>
                                            <Text style={[styles.sectorPct, { color: c.text }]}>{((s.value / totalCurrent) * 100).toFixed(0)}%</Text>
                                        </View>
                                    ))}
                                </View>
                            </Card>
                        )}
                    </View>
                )}

                {/* ── IRR vs Benchmark ── */}
                {hasData && irrData && (
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Text style={[styles.sectionTitle, { color: c.text }]}>IRR vs Nifty 50</Text>
                            {irrData.alpha != null && (
                                <View style={[styles.alertPill, { backgroundColor: irrData.alpha >= 0 ? c.success + '18' : c.danger + '18' }]}>
                                    <Ionicons name={irrData.alpha >= 0 ? 'trending-up' : 'trending-down'} size={12} color={irrData.alpha >= 0 ? c.success : c.danger} />
                                    <Text style={[styles.alertText, { color: irrData.alpha >= 0 ? c.success : c.danger }]}>
                                        {irrData.alpha >= 0 ? 'Outperforming' : 'Underperforming'}
                                    </Text>
                                </View>
                            )}
                        </View>

                        <Card theme={theme} style={styles.benchmarkCard}>
                            {/* Alpha highlight — shown only when Nifty price is available */}
                            {irrData.alpha != null ? (
                                <View style={[styles.alphaHighlight, {
                                    backgroundColor: irrData.alpha >= 0 ? c.success + '12' : c.danger + '12',
                                    borderColor: irrData.alpha >= 0 ? c.success + '30' : c.danger + '30',
                                }]}>
                                    <Text style={[styles.alphaLabel, { color: c.textTertiary }]}>Alpha (Your IRR − Nifty 50)</Text>
                                    <Text style={[styles.alphaValue, { color: irrData.alpha >= 0 ? c.success : c.danger }]}>
                                        {irrData.alpha >= 0 ? '+' : ''}{irrData.alpha.toFixed(1)}%
                                    </Text>
                                </View>
                            ) : (
                                <View style={[styles.alphaHighlight, { backgroundColor: c.textTertiary + '10', borderColor: c.border }]}>
                                    <Text style={[styles.alphaLabel, { color: c.textTertiary }]}>Alpha (Your IRR − Nifty 50)</Text>
                                    {metricsLoading
                                        ? <ActivityIndicator size="small" color={c.textTertiary} style={{ marginTop: 4 }} />
                                        : <Text style={[styles.alphaValue, { color: c.textTertiary, fontSize: 13 }]}>
                                            {irrData ? 'Nifty benchmark unavailable' : 'Calculating… Add a holding ≥1 day old'}
                                        </Text>
                                    }
                                </View>
                            )}

                            {/* IRR comparison row */}
                            <View style={[styles.benchmarkRow, { marginTop: Spacing.md }]}>
                                <View style={{ flex: 1, alignItems: 'center' }}>
                                    <View style={[styles.irrIconWrap, { backgroundColor: (irrData.portfolioIrr >= 0 ? c.success : c.danger) + '15' }]}>
                                        <Ionicons name="wallet" size={16} color={irrData.portfolioIrr >= 0 ? c.success : c.danger} />
                                    </View>
                                    <Text style={[styles.benchmarkLabel, { color: c.textTertiary, marginTop: 6, textAlign: 'center' }]}>Your IRR</Text>
                                    <Text style={[styles.benchmarkValue, { color: irrData.portfolioIrr >= 0 ? c.success : c.danger }]}>
                                        {irrData.portfolioIrr >= 0 ? '+' : ''}{irrData.portfolioIrr.toFixed(1)}%
                                    </Text>
                                    <Text style={[styles.irrSub, { color: c.textTertiary }]}>annualized</Text>
                                </View>

                                <View style={[styles.benchmarkDivider, { backgroundColor: c.border }]} />

                                <View style={{ flex: 1, alignItems: 'center' }}>
                                    <View style={[styles.irrIconWrap, { backgroundColor: c.textTertiary + '15' }]}>
                                        <Ionicons name="stats-chart" size={16} color={c.textSecondary} />
                                    </View>
                                    <Text style={[styles.benchmarkLabel, { color: c.textTertiary, marginTop: 6, textAlign: 'center' }]}>Nifty 50 IRR</Text>
                                    {irrData.niftyIrr != null ? (
                                        <Text style={[styles.benchmarkValue, { color: c.text }]}>
                                            {irrData.niftyIrr >= 0 ? '+' : ''}{irrData.niftyIrr.toFixed(1)}%
                                        </Text>
                                    ) : metricsLoading ? (
                                        <ActivityIndicator size="small" color={c.textTertiary} style={{ marginTop: 4 }} />
                                    ) : (
                                        <Text style={[styles.benchmarkValue, { color: c.textTertiary, fontSize: 14 }]}>—</Text>
                                    )}
                                    <Text style={[styles.irrSub, { color: c.textTertiary }]}>annualized</Text>
                                </View>
                            </View>

                            {/* Holding period info */}
                            <View style={[styles.holdingPeriodRow, { borderTopColor: c.border }]}>
                                <Ionicons name="time-outline" size={13} color={c.textTertiary} />
                                <Text style={[styles.benchmarkNote, { color: c.textTertiary, marginTop: 0 }]}>
                                    Avg holding period: <Text style={{ fontWeight: '700', color: c.textSecondary }}>
                                        {irrData.avgHoldingDays < 30
                                            ? `${irrData.avgHoldingDays}d`
                                            : irrData.avgHoldingDays < 365
                                                ? `${Math.round(irrData.avgHoldingDays / 30)}mo`
                                                : `${irrData.avgHoldingYears.toFixed(1)}yr`}
                                    </Text>
                                    {' '}· Based on {irrData.validCount} holding{irrData.validCount !== 1 ? 's' : ''}
                                </Text>
                            </View>

                            <Text style={[styles.benchmarkNote, { color: c.textTertiary, marginTop: 6 }]}>
                                *XIRR computed on-device. Nifty 50 data via Yahoo Finance / NSE.
                            </Text>
                        </Card>
                    </View>
                )}

                {/* Fallback if IRR can't be calculated (no price data) */}
                {hasData && !irrData && (
                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, { color: c.text, marginBottom: Spacing.md }]}>IRR vs Nifty 50</Text>
                        <Card theme={theme} style={[styles.benchmarkCard, { alignItems: 'center', paddingVertical: Spacing.xl }]}>
                            {metricsLoading ? (
                                <>
                                    <ActivityIndicator size="large" color={c.textTertiary} style={{ marginBottom: Spacing.sm }} />
                                    <Text style={[styles.benchmarkNote, { color: c.textTertiary, marginTop: Spacing.sm, textAlign: 'center', fontStyle: 'normal' }]}>
                                        Calculating portfolio metrics...
                                    </Text>
                                </>
                            ) : (
                                <>
                                    <Ionicons name="analytics-outline" size={32} color={c.textTertiary} />
                                    <Text style={[styles.benchmarkNote, { color: c.textTertiary, marginTop: Spacing.sm, textAlign: 'center', fontStyle: 'normal' }]}>
                                        IRR will appear once your stocks have live prices. Pull down to refresh.
                                    </Text>
                                </>
                            )}
                        </Card>
                    </View>
                )}


                {/* ── Holdings ── */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={[styles.sectionTitle, { color: c.text }]}>Holdings</Text>
                    </View>

                    {isLoading ? (
                        <View style={styles.loadingWrap}>
                            <ActivityIndicator size="large" color={Colors.brand.secondary} />
                        </View>
                    ) : hasData ? (
                        holdings.map((h, i) => {
                            const dotColor = getChartColor(i);
                            const isUp = (h.pnl ?? 0) >= 0;
                            const weight = ((h.current_value ?? h.invested) / totalCurrent) * 100;
                            return (
                                <Card
                                    key={h.id ?? i}
                                    theme={theme}
                                    style={styles.holdingCard}
                                    onPress={() => router.push(`/stock/${h.nse_symbol}` as any)}
                                >
                                    {/* Top Row: Info & Value */}
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                                            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: dotColor + '15', justifyContent: 'center', alignItems: 'center' }}>
                                                <Text style={{ color: dotColor, fontWeight: '800', fontSize: 16 }}>{h.nse_symbol.charAt(0)}</Text>
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={[styles.holdingName, { color: c.text, fontSize: 15 }]} numberOfLines={1}>
                                                    {h.nse_symbol}
                                                </Text>
                                                <Text style={[styles.holdingMeta, { color: c.textTertiary, fontSize: 12, marginTop: 2 }]} numberOfLines={1}>
                                                    {h.quantity} units @ ₹{h.buy_price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                                </Text>
                                            </View>
                                        </View>

                                        <View style={{ alignItems: 'flex-end', marginLeft: 8 }}>
                                            <Text style={[styles.holdingValue, { color: c.text, fontSize: 15 }]}>
                                                {h.current_value != null ? fmt(h.current_value) : '—'}
                                            </Text>
                                            {h.pnl != null ? (
                                                <Text style={{ color: isUp ? c.success : c.danger, fontSize: 12, fontWeight: '700', marginTop: 2 }}>
                                                    {isUp ? '+' : '-'}{fmt(Math.abs(h.pnl))} ({h.pnl_pct?.toFixed(2)}%)
                                                </Text>
                                            ) : (
                                                <Text style={{ color: c.textTertiary, fontSize: 11, marginTop: 2 }}>No live price</Text>
                                            )}
                                        </View>
                                    </View>

                                    {/* Bottom Row: Actions & Weight */}
                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.borderLight, gap: 8 }}>
                                        {/* Slim Thesis Button */}
                                        <TouchableOpacity
                                            style={{ 
                                                flex: 1, 
                                                flexDirection: 'row', 
                                                alignItems: 'center', 
                                                justifyContent: 'center',
                                                height: 34, 
                                                backgroundColor: h.investment_thesis ? Colors.brand.primary + '12' : c.surfaceElevated, 
                                                borderRadius: BorderRadius.full,
                                                borderWidth: 1,
                                                borderColor: h.investment_thesis ? Colors.brand.primary + '30' : 'transparent',
                                                gap: 6
                                            }}
                                            onPress={() => {
                                                setSelectedHolding(h);
                                                setThesisInput(h.investment_thesis || '');
                                                setThesisFeedback('');
                                                setThesisTokensUsed(null);
                                                setShowThesisModal(true);
                                                Animated.parallel([
                                                    Animated.timing(slideAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
                                                    Animated.timing(backdropAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
                                                ]).start();
                                            }}
                                            activeOpacity={0.7}
                                        >
                                            <Ionicons name="sparkles" size={13} color={h.investment_thesis ? Colors.brand.primary : c.textSecondary} />
                                            <Text style={{ color: h.investment_thesis ? Colors.brand.primary : c.textSecondary, fontSize: 12, fontWeight: '700' }}>
                                                {h.investment_thesis ? 'AI Thesis Check' : 'Add AI Thesis'}
                                            </Text>
                                        </TouchableOpacity>

                                        {/* Delete Button */}
                                        <TouchableOpacity
                                            style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: c.surfaceElevated, justifyContent: 'center', alignItems: 'center' }}
                                            onPress={() => showAlert('Remove?', `Remove ${h.company_name || h.nse_symbol}?`, [
                                                { text: 'Cancel', style: 'cancel' },
                                                { text: 'Remove', style: 'destructive', onPress: () => deleteMutation.mutate(h.id) },
                                            ])}
                                        >
                                            <Ionicons name="trash-outline" size={15} color={c.textTertiary} />
                                        </TouchableOpacity>
                                    </View>
                                </Card>
                            );
                        })
                    ) : (
                        <EmptyState
                            icon="pie-chart-outline"
                            title="No Holdings"
                            subtitle="Tap + to add your first stock and start tracking."
                            theme={theme}
                        />
                    )}
                </View>

                {/* ── Legal & Data Disclaimer ── */}
                <View style={styles.footer}>
                    {/* Data Status moved to top */}

                    <TouchableOpacity
                        onPress={() => showAlert('Report Issue', 'Is the price or quantity incorrect? We will verify and update our database.', [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Report Error', onPress: () => showAlert('Thank You', 'Our data team has been notified. We will review the discrepancy.') }
                        ])}
                        style={styles.reportLink}
                    >
                        <Text style={{ color: Colors.brand.secondary, fontSize: 12, fontWeight: '600' }}>Report Data Discrepancy</Text>
                    </TouchableOpacity>

                    <View style={[styles.legalBox, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }]}>
                        <Text style={[styles.legalText, { color: c.textTertiary }]}>
                            <Text style={{ fontWeight: '700', color: c.textSecondary }}>LEGAL DISCLAIMER: </Text>
                            This portfolio tracker is for educational and research purposes only. Market data is provided "as is" and may be inaccurate or delayed.
                            We are a SEBI registered Research Analyst (REG NO: INH000069807). This does not constitute investment advice. Please verify all data with your official broker statements before making trading decisions.
                        </Text>
                    </View>
                </View>

                {/* ── Add Stock Modal ── */}
                <Modal visible={showAdd} transparent animationType="none" onRequestClose={closeModal} statusBarTranslucent>
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                        <TouchableWithoutFeedback onPress={closeModal}>
                            <Animated.View style={[styles.modalBackdrop, { opacity: backdropAnim }]} />
                        </TouchableWithoutFeedback>

                        <Animated.View style={[
                            styles.modalSheet,
                            {
                                backgroundColor: c.surface,
                                transform: [{ translateY: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [600, 0] }) }],
                            },
                        ]}>
                            <View style={styles.modalHandle}>
                                <View style={[styles.modalHandleBar, { backgroundColor: c.border }]} />
                            </View>

                            <View style={styles.modalHeader}>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.modalTitle, { color: c.text }]}>Add Stock</Text>
                                    <Text style={[styles.modalSubtitle, { color: c.textTertiary }]}>Search and add to your portfolio</Text>
                                </View>
                                <TouchableOpacity onPress={closeModal} style={[styles.modalCloseBtn, { backgroundColor: c.surfaceElevated }]}>
                                    <Ionicons name="close" size={18} color={c.textSecondary} />
                                </TouchableOpacity>
                            </View>

                            <ScrollView style={styles.modalBody} contentContainerStyle={{ paddingBottom: Spacing['2xl'] }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                                <View style={{ zIndex: 10 }}>
                                    <View style={[styles.searchContainer, { backgroundColor: c.inputBg, borderColor: symbol ? Colors.brand.accent : c.inputBorder }]}>
                                        <Ionicons name="search" size={18} color={c.textTertiary} />
                                        <TextInput
                                            style={[styles.searchTextInput, { color: c.text }]}
                                            placeholder="Search by symbol or name..."
                                            placeholderTextColor={c.textTertiary}
                                            value={symbol ? symbol : searchQuery}
                                            onChangeText={(text) => {
                                                if (symbol) { setSymbol(''); setSearchQuery(text); }
                                                else { setSearchQuery(text); }
                                            }}
                                            autoCapitalize="characters"
                                            autoFocus={Platform.OS === 'ios'}
                                        />
                                        {(symbol || searchQuery) ? (
                                            <TouchableOpacity onPress={() => { setSymbol(''); setSearchQuery(''); }}>
                                                <Ionicons name="close-circle" size={18} color={c.textTertiary} />
                                            </TouchableOpacity>
                                        ) : null}
                                    </View>

                                    {symbol ? (
                                        <View style={[styles.selectedPill, { backgroundColor: Colors.brand.secondary + '18', borderColor: Colors.brand.secondary + '40' }]}>
                                            <Ionicons name="checkmark-circle" size={16} color={Colors.brand.secondary} />
                                            <Text style={[styles.selectedPillText, { color: Colors.brand.secondary }]}>{symbol}</Text>
                                        </View>
                                    ) : null}

                                    {!symbol && searchQuery.length > 0 && (
                                        <View style={[styles.searchResultsContainer, { borderColor: c.border, position: 'absolute', top: 54, left: 0, right: 0, zIndex: 20, backgroundColor: c.surface }]}>
                                            {isSearching ? (
                                                <View style={styles.searchLoading}>
                                                    <ActivityIndicator size="small" color={Colors.brand.secondary} />
                                                    <Text style={{ color: c.textTertiary, fontSize: FontSize.sm }}>Searching...</Text>
                                                </View>
                                            ) : searchResults.length > 0 ? (
                                                <ScrollView style={{ maxHeight: 200 }} keyboardShouldPersistTaps="always" nestedScrollEnabled>
                                                    {searchResults.map((item, i) => (
                                                        <TouchableOpacity
                                                            key={item.nse_code ?? i}
                                                            style={[styles.searchResultItem, { borderBottomColor: c.borderLight }]}
                                                            onPress={() => { setSymbol(item.nse_code); setSearchQuery(''); setSearchResults([]); }}
                                                            activeOpacity={0.6}
                                                        >
                                                            <View style={[styles.searchResultIcon, { backgroundColor: Colors.brand.secondary + '15' }]}>
                                                                <Ionicons name="trending-up" size={14} color={Colors.brand.secondary} />
                                                            </View>
                                                            <View style={{ flex: 1 }}>
                                                                <Text style={{ color: c.text, fontSize: FontSize.sm, fontWeight: '700' }}>{item.nse_code}</Text>
                                                                {item.company_name && <Text style={{ color: c.textTertiary, fontSize: FontSize.xs, marginTop: 1 }} numberOfLines={1}>{item.company_name}</Text>}
                                                            </View>
                                                            <Ionicons name="add-circle-outline" size={20} color={Colors.brand.secondary} />
                                                        </TouchableOpacity>
                                                    ))}
                                                </ScrollView>
                                            ) : (
                                                <View style={styles.searchLoading}>
                                                    <Text style={{ color: c.textTertiary, fontSize: FontSize.sm }}>No results for "{searchQuery}"</Text>
                                                </View>
                                            )}
                                        </View>
                                    )}
                                </View>

                                {/* ── Transaction Type Toggle ── */}
                                <View style={[styles.txTypeRow, { marginTop: Spacing.lg }]}>
                                    {(['BUY', 'SELL'] as const).map(type => (
                                        <TouchableOpacity
                                            key={type}
                                            style={[
                                                styles.txTypeBtn,
                                                {
                                                    backgroundColor: transactionType === type
                                                        ? (type === 'BUY' ? c.success : c.danger)
                                                        : c.inputBg,
                                                    borderColor: transactionType === type
                                                        ? (type === 'BUY' ? c.success : c.danger)
                                                        : c.inputBorder,
                                                },
                                            ]}
                                            onPress={() => setTransactionType(type)}
                                            activeOpacity={0.8}
                                        >
                                            <Ionicons
                                                name={type === 'BUY' ? 'arrow-down-circle' : 'arrow-up-circle'}
                                                size={15}
                                                color={transactionType === type ? '#fff' : (type === 'BUY' ? c.success : c.danger)}
                                            />
                                            <Text style={[
                                                styles.txTypeBtnText,
                                                { color: transactionType === type ? '#fff' : c.textSecondary },
                                            ]}>
                                                {type}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                <View style={[styles.formRow, { marginTop: Spacing.md }]}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.inputLabel, { color: c.textSecondary }]}>Quantity</Text>
                                        <TextInput style={[styles.modalInput, { backgroundColor: c.inputBg, borderColor: c.inputBorder, color: c.text }]} placeholder="0" placeholderTextColor={c.textTertiary} value={qty} onChangeText={setQty} keyboardType="numeric" />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.inputLabel, { color: c.textSecondary }]}>
                                            {transactionType === 'BUY' ? 'Buy Price (₹)' : 'Sell Price (₹)'}
                                        </Text>
                                        {transactionType === 'BUY' ? (
                                            <TextInput style={[styles.modalInput, { backgroundColor: c.inputBg, borderColor: c.inputBorder, color: c.text }]} placeholder="0.00" placeholderTextColor={c.textTertiary} value={buyPrice} onChangeText={setBuyPrice} keyboardType="numeric" />
                                        ) : (
                                            <TextInput style={[styles.modalInput, { backgroundColor: c.inputBg, borderColor: c.danger + '80', color: c.text }]} placeholder="0.00" placeholderTextColor={c.textTertiary} value={sellPrice} onChangeText={setSellPrice} keyboardType="numeric" />
                                        )}
                                    </View>
                                </View>

                                {/* ── Transaction Date ── */}
                                <View style={{ marginTop: Spacing.lg }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                        <Text style={[styles.inputLabel, { color: c.textSecondary }]}>
                                            {transactionType === 'SELL' ? 'Sell Date' : 'Buy Date'}
                                        </Text>
                                        {buyDateISO ? (
                                            <View style={[styles.dateValidBadge, { backgroundColor: c.success + '18' }]}>
                                                <Ionicons name="checkmark-circle" size={11} color={c.success} />
                                                <Text style={{ color: c.success, fontSize: 9, fontWeight: '700' }}>Valid</Text>
                                            </View>
                                        ) : buyDateText.length > 0 ? (
                                            <View style={[styles.dateValidBadge, { backgroundColor: c.danger + '18' }]}>
                                                <Ionicons name="alert-circle" size={11} color={c.danger} />
                                                <Text style={{ color: c.danger, fontSize: 9, fontWeight: '700' }}>Invalid date</Text>
                                            </View>
                                        ) : null}
                                    </View>

                                    {/* Manual DD/MM/YYYY input */}
                                    <View style={[styles.dateInputRow, {
                                        backgroundColor: c.inputBg,
                                        borderColor: buyDateText.length === 10
                                            ? buyDateISO ? Colors.brand.secondary : c.danger
                                            : c.inputBorder,
                                    }]}>
                                        <TouchableOpacity onPress={() => setShowDatePicker(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                            <Ionicons name="calendar-outline" size={18} color={c.textTertiary} />
                                        </TouchableOpacity>
                                        <TextInput
                                            style={[styles.dateTextInput, { color: c.text }]}
                                            placeholder="DD/MM/YYYY"
                                            placeholderTextColor={c.textTertiary}
                                            value={buyDateText}
                                            onChangeText={handleBuyDateChange}
                                            keyboardType="numeric"
                                            maxLength={10}
                                        />
                                        {buyDateText.length > 0 && (
                                            <TouchableOpacity onPress={() => { setBuyDateText(''); setBuyDateISO(''); }}>
                                                <Ionicons name="close-circle" size={16} color={c.textTertiary} />
                                            </TouchableOpacity>
                                        )}
                                    </View>

                                    {Platform.OS !== 'web' && showDatePicker && (
                                        <DateTimePicker
                                            value={buyDateISO ? new Date(buyDateISO) : new Date()}
                                            mode="date"
                                            display="default"
                                            onChange={onDateSelected}
                                            maximumDate={new Date()}
                                        />
                                    )}
                                    <Text style={{ color: c.textTertiary, fontSize: 9, marginTop: 5, fontStyle: 'italic' }}>
                                        {transactionType === 'SELL' ? 'Date you sold.' : 'Used for accurate IRR calculation.'}
                                    </Text>
                                </View>

                                {/* ── Investment Thesis ── */}
                                <View style={{ marginTop: Spacing.lg }}>
                                    <Text style={[styles.inputLabel, { color: c.textSecondary }]}>
                                        {transactionType === 'BUY' ? 'Investment Thesis' : 'Sell Reason'}
                                    </Text>
                                    <TextInput
                                        style={[styles.thesisInput, { backgroundColor: c.inputBg, borderColor: c.inputBorder, color: c.text }]}
                                        placeholder={transactionType === 'BUY' ? 'Why are you buying this stock? (optional)' : 'Why are you selling? (optional)'}
                                        placeholderTextColor={c.textTertiary}
                                        value={investmentThesis}
                                        onChangeText={setInvestmentThesis}
                                        multiline
                                        numberOfLines={3}
                                        textAlignVertical="top"
                                    />
                                </View>

                                {(() => {
                                    const priceField = transactionType === 'SELL' ? sellPrice : buyPrice;
                                    const isReady = !!(symbol && qty && priceField && buyDateISO);
                                    const btnColor = isReady
                                        ? (transactionType === 'SELL' ? c.danger : Colors.brand.primary)
                                        : c.surfaceElevated;
                                    return (
                                        <TouchableOpacity
                                            style={[styles.modalSubmitBtn, { backgroundColor: btnColor, opacity: (addMutation.isPending || portfolioLoading) ? 0.6 : 1 }]}
                                            onPress={() => addMutation.mutate()}
                                            disabled={addMutation.isPending || portfolioLoading || !isReady}
                                            activeOpacity={0.85}
                                        >
                                            {addMutation.isPending || portfolioLoading ? (
                                                <ActivityIndicator color="#fff" />
                                            ) : (
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                    <Ionicons
                                                        name={transactionType === 'SELL' ? 'arrow-up-circle' : 'add-circle'}
                                                        size={20}
                                                        color={isReady ? '#fff' : c.textTertiary}
                                                    />
                                                    <Text style={{ fontWeight: '700', fontSize: FontSize.base, color: isReady ? '#fff' : c.textTertiary }}>
                                                        {transactionType === 'SELL' ? 'Record Sell' : 'Add to Portfolio'}
                                                    </Text>
                                                </View>
                                            )}
                                        </TouchableOpacity>
                                    );
                                })()}
                            </ScrollView>
                        </Animated.View>
                    </KeyboardAvoidingView>
                </Modal>

                {/* ── Excel Format Guide Modal ── */}
                <Modal visible={showExcelGuide} transparent animationType="slide" onRequestClose={() => setShowExcelGuide(false)} statusBarTranslucent>
                    <View style={styles.excelModalOverlay}>
                        <View style={[styles.excelGuideSheet, { backgroundColor: c.surface }]}>
                            <View style={styles.excelModalHeader}>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.modalTitle, { color: c.text }]}>Import from Excel</Text>
                                    <Text style={[styles.modalSubtitle, { color: c.textTertiary }]}>Upload your trade journal / portfolio sheet</Text>
                                </View>
                                <TouchableOpacity onPress={() => setShowExcelGuide(false)} style={[styles.modalCloseBtn, { backgroundColor: c.surfaceElevated }]}>
                                    <Ionicons name="close" size={18} color={c.textSecondary} />
                                </TouchableOpacity>
                            </View>

                            <ScrollView style={{ paddingHorizontal: Spacing.xl }} contentContainerStyle={{ paddingBottom: Spacing['2xl'] }} showsVerticalScrollIndicator={false}>
                                {/* Format info */}
                                <View style={[styles.guideInfoBox, { backgroundColor: isDark ? 'rgba(99,102,241,0.08)' : 'rgba(99,102,241,0.06)', borderColor: isDark ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.15)' }]}>
                                    <Ionicons name="information-circle" size={18} color={Colors.brand.secondary} />
                                    <Text style={{ color: c.textSecondary, fontSize: FontSize.xs, flex: 1, lineHeight: 18 }}>
                                        Your Excel file must have <Text style={{ fontWeight: '800', color: c.text }}>6 columns</Text> in the exact order shown below. The first row should be the header.
                                    </Text>
                                </View>

                                {/* Supported formats */}
                                <View style={{ flexDirection: 'row', gap: 8, marginTop: Spacing.md, flexWrap: 'wrap' }}>
                                    {['.xlsx', '.xls', '.csv'].map(fmt => (
                                        <View key={fmt} style={[styles.formatChip, { backgroundColor: c.surfaceElevated }]}>
                                            <Ionicons name="document-outline" size={12} color={Colors.brand.secondary} />
                                            <Text style={{ fontSize: 11, fontWeight: '700', color: c.text }}>{fmt}</Text>
                                        </View>
                                    ))}
                                </View>

                                {/* Example table */}
                                <Text style={[styles.inputLabel, { color: c.textSecondary, marginTop: Spacing.xl }]}>Required Format</Text>

                                {/* Header row */}
                                <View style={[styles.guideTableRow, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', borderColor: c.border, borderTopLeftRadius: 8, borderTopRightRadius: 8, borderWidth: 1 }]}>
                                    {['Date', 'NSE Code', 'Buy/Sell', 'Qty', 'Price', 'Thesis'].map((h, i) => (
                                        <Text key={i} style={[styles.guideHeaderCell, { color: c.text, flex: i === 5 ? 1.5 : 1 }]}>{h}</Text>
                                    ))}
                                </View>

                                {/* Sample rows */}
                                {[
                                    ['15/01/2025', 'TCS', 'BUY', '10', '4150', 'Strong IT demand'],
                                    ['20/02/2025', 'RELIANCE', 'BUY', '5', '2890', 'Jio growth'],
                                    ['10/03/2025', 'INFY', 'SELL', '15', '1580', 'Booking profit'],
                                ].map((row, ri) => (
                                    <View key={ri} style={[
                                        styles.guideTableRow,
                                        { borderColor: c.border, borderLeftWidth: 1, borderRightWidth: 1, borderBottomWidth: 1 },
                                        ri === 2 && { borderBottomLeftRadius: 8, borderBottomRightRadius: 8 },
                                        ri === 2 && { backgroundColor: isDark ? 'rgba(239,68,68,0.05)' : 'rgba(239,68,68,0.04)' },
                                    ]}>
                                        {row.map((cell, ci) => (
                                            <Text key={ci} style={[
                                                styles.guideCell,
                                                { color: ci === 2 ? (cell === 'SELL' ? c.danger : c.success) : c.textSecondary, flex: ci === 5 ? 1.5 : 1 },
                                                ci === 2 && { fontWeight: '700' },
                                            ]} numberOfLines={1}>{cell}</Text>
                                        ))}
                                    </View>
                                ))}

                                {/* Column descriptions */}
                                <Text style={[styles.inputLabel, { color: c.textSecondary, marginTop: Spacing.xl }]}>Column Details</Text>
                                {[
                                    { col: 'Date', desc: 'DD/MM/YYYY format (or YYYY-MM-DD)', icon: 'calendar-outline' as const },
                                    { col: 'NSE Code', desc: 'NSE symbol (e.g. TCS, RELIANCE)', icon: 'business-outline' as const },
                                    { col: 'Buy/Sell', desc: 'BUY rows are imported, SELL rows are skipped', icon: 'swap-vertical-outline' as const },
                                    { col: 'Quantity', desc: 'Number of shares (must be > 0)', icon: 'layers-outline' as const },
                                    { col: 'Price', desc: 'Buy price per share in ₹', icon: 'pricetag-outline' as const },
                                    { col: 'Investment Thesis', desc: 'Your reason for the trade (optional)', icon: 'bulb-outline' as const },
                                ].map((item, i) => (
                                    <View key={i} style={[styles.guideDetailRow, { borderBottomColor: i < 5 ? c.borderLight : 'transparent' }]}>
                                        <View style={[styles.guideDetailIcon, { backgroundColor: Colors.brand.secondary + '12' }]}>
                                            <Ionicons name={item.icon} size={14} color={Colors.brand.secondary} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ fontSize: FontSize.sm, fontWeight: '700', color: c.text }}>{item.col}</Text>
                                            <Text style={{ fontSize: 11, color: c.textTertiary, marginTop: 1 }}>{item.desc}</Text>
                                        </View>
                                    </View>
                                ))}

                                {/* Warning */}
                                <View style={[styles.guideInfoBox, { backgroundColor: isDark ? 'rgba(245,158,11,0.08)' : 'rgba(245,158,11,0.06)', borderColor: isDark ? 'rgba(245,158,11,0.2)' : 'rgba(245,158,11,0.15)', marginTop: Spacing.lg }]}>
                                    <Ionicons name="warning-outline" size={16} color="#F59E0B" />
                                    <Text style={{ color: c.textSecondary, fontSize: 11, flex: 1, lineHeight: 16 }}>
                                        SELL rows will be shown in preview but <Text style={{ fontWeight: '700' }}>will not be imported</Text>. Only BUY trades are added to your portfolio.
                                    </Text>
                                </View>

                                {/* Choose file button */}
                                <TouchableOpacity
                                    style={[styles.modalSubmitBtn, { backgroundColor: Colors.brand.primary, opacity: isParsingExcel ? 0.7 : 1 }]}
                                    onPress={() => { setShowExcelGuide(false); pickExcelFile(); }}
                                    disabled={isParsingExcel}
                                    activeOpacity={0.85}
                                >
                                    {isParsingExcel ? (
                                        <ActivityIndicator color="#fff" />
                                    ) : (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                            <Ionicons name="folder-open" size={20} color="#fff" />
                                            <Text style={{ fontWeight: '700', fontSize: FontSize.base, color: '#fff' }}>Choose Excel File</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>
                            </ScrollView>
                        </View>
                    </View>
                </Modal>

                {/* ── Excel Import Preview Modal ── */}
                <Modal visible={showExcelImport} transparent animationType="slide" onRequestClose={() => setShowExcelImport(false)} statusBarTranslucent>
                    <View style={styles.excelModalOverlay}>
                        <View style={[styles.excelModalSheet, { backgroundColor: c.surface }]}>
                            {/* Header */}
                            <View style={styles.excelModalHeader}>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.modalTitle, { color: c.text }]}>Import Preview</Text>
                                    <Text style={[styles.modalSubtitle, { color: c.textTertiary }]} numberOfLines={1}>{excelFileName}</Text>
                                </View>
                                <TouchableOpacity onPress={() => { setShowExcelImport(false); setExcelRows([]); }} style={[styles.modalCloseBtn, { backgroundColor: c.surfaceElevated }]}>
                                    <Ionicons name="close" size={18} color={c.textSecondary} />
                                </TouchableOpacity>
                            </View>

                            {/* Stats bar */}
                            <View style={[styles.excelStatRow, { backgroundColor: c.surfaceElevated }]}>
                                <View style={styles.excelStat}>
                                    <Text style={[styles.excelStatNum, { color: c.text }]}>{excelRows.length}</Text>
                                    <Text style={[styles.excelStatLabel, { color: c.textTertiary }]}>Total Rows</Text>
                                </View>
                                <View style={[styles.excelStatDivider, { backgroundColor: c.border }]} />
                                <View style={styles.excelStat}>
                                    <Text style={[styles.excelStatNum, { color: c.success }]}>{excelRows.filter(r => r.valid && r.action === 'BUY').length}</Text>
                                    <Text style={[styles.excelStatLabel, { color: c.textTertiary }]}>Buy (Import)</Text>
                                </View>
                                <View style={[styles.excelStatDivider, { backgroundColor: c.border }]} />
                                <View style={styles.excelStat}>
                                    <Text style={[styles.excelStatNum, { color: c.warning ?? '#F59E0B' }]}>{excelRows.filter(r => r.action === 'SELL').length}</Text>
                                    <Text style={[styles.excelStatLabel, { color: c.textTertiary }]}>Sell (Skip)</Text>
                                </View>
                                <View style={[styles.excelStatDivider, { backgroundColor: c.border }]} />
                                <View style={styles.excelStat}>
                                    <Text style={[styles.excelStatNum, { color: c.danger }]}>{excelRows.filter(r => !r.valid).length}</Text>
                                    <Text style={[styles.excelStatLabel, { color: c.textTertiary }]}>Errors</Text>
                                </View>
                            </View>

                            {/* Column headers */}
                            <View style={[styles.excelTableHeader, { backgroundColor: c.surfaceElevated, borderBottomColor: c.border }]}>
                                <Text style={[styles.excelColHead, { flex: 1.4, color: c.textTertiary }]}>Symbol</Text>
                                <Text style={[styles.excelColHead, { flex: 0.8, color: c.textTertiary }]}>Action</Text>
                                <Text style={[styles.excelColHead, { flex: 0.8, color: c.textTertiary }]}>Qty</Text>
                                <Text style={[styles.excelColHead, { flex: 1.2, color: c.textTertiary }]}>Price</Text>
                                <Text style={[styles.excelColHead, { flex: 1.2, color: c.textTertiary }]}>Date</Text>
                                <Text style={[styles.excelColHead, { flex: 0.4, color: c.textTertiary }]}></Text>
                            </View>

                            {/* Rows */}
                            <FlatList
                                data={excelRows}
                                keyExtractor={(_, i) => String(i)}
                                style={{ flex: 1 }}
                                renderItem={({ item }) => (
                                    <View style={[
                                        styles.excelTableRow,
                                        { borderBottomColor: c.borderLight },
                                        !item.valid && { backgroundColor: c.danger + '08' },
                                        item.action === 'SELL' && item.valid && { backgroundColor: c.surfaceElevated },
                                    ]}>
                                        <Text style={[styles.excelCell, { flex: 1.4, color: c.text, fontWeight: '700' }]} numberOfLines={1}>{item.symbol || '—'}</Text>
                                        <View style={[styles.excelActionPill, { backgroundColor: item.action === 'BUY' ? c.success + '20' : c.danger + '20', flex: 0.8 }]}>
                                            <Text style={{ fontSize: 9, fontWeight: '800', color: item.action === 'BUY' ? c.success : c.danger }}>{item.action}</Text>
                                        </View>
                                        <Text style={[styles.excelCell, { flex: 0.8, color: c.textSecondary }]}>{item.quantity || '—'}</Text>
                                        <Text style={[styles.excelCell, { flex: 1.2, color: c.textSecondary }]}>₹{item.price || '—'}</Text>
                                        <Text style={[styles.excelCell, { flex: 1.2, color: c.textTertiary, fontSize: 10 }]}>{item.date || 'No date'}</Text>
                                        <View style={{ flex: 0.4, alignItems: 'center' }}>
                                            {!item.valid
                                                ? <Ionicons name="alert-circle" size={14} color={c.danger} />
                                                : item.action === 'SELL'
                                                    ? <Ionicons name="remove-circle" size={14} color={c.textTertiary} />
                                                    : <Ionicons name="checkmark-circle" size={14} color={c.success} />
                                            }
                                        </View>
                                    </View>
                                )}
                            />

                            {/* Progress bar */}
                            {isBatchImporting && (
                                <View style={{ paddingHorizontal: Spacing.xl, paddingVertical: Spacing.sm }}>
                                    <View style={[styles.progressBg, { backgroundColor: c.border, height: 6 }]}>
                                        <View style={[styles.progressFill, { width: `${importProgress}%` as any, backgroundColor: Colors.brand.secondary, height: 6 }]} />
                                    </View>
                                    <Text style={{ color: c.textTertiary, fontSize: 10, marginTop: 4, textAlign: 'center' }}>
                                        Importing... {importProgress}%
                                    </Text>
                                </View>
                            )}

                            {/* Import button */}
                            <View style={{ padding: Spacing.xl }}>
                                {excelRows.filter(r => r.valid && r.action === 'BUY').length === 0 ? (
                                    <View style={[styles.excelEmptyImport, { backgroundColor: c.surfaceElevated }]}>
                                        <Ionicons name="warning-outline" size={20} color={c.danger} />
                                        <Text style={{ color: c.danger, fontSize: FontSize.sm, fontWeight: '600', marginTop: 4, textAlign: 'center' }}>
                                            No valid BUY rows to import
                                        </Text>
                                    </View>
                                ) : (
                                    <TouchableOpacity
                                        style={[styles.modalSubmitBtn, { backgroundColor: Colors.brand.primary, opacity: isBatchImporting ? 0.7 : 1 }]}
                                        onPress={runBatchImport}
                                        disabled={isBatchImporting}
                                        activeOpacity={0.85}
                                    >
                                        {isBatchImporting ? (
                                            <ActivityIndicator color="#fff" />
                                        ) : (
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                <Ionicons name="cloud-upload" size={20} color="#fff" />
                                                <Text style={{ fontWeight: '700', fontSize: FontSize.base, color: '#fff' }}>
                                                    Import {excelRows.filter(r => r.valid && r.action === 'BUY').length} Holdings
                                                </Text>
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    </View>
                </Modal>

                {/* ── Thesis Check Modal ── */}
                <Modal visible={showThesisModal} transparent animationType="none" onRequestClose={() => {
                    Animated.parallel([
                        Animated.timing(slideAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
                        Animated.timing(backdropAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
                    ]).start(() => {
                        setShowThesisModal(false);
                    });
                }} statusBarTranslucent>
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                        <TouchableWithoutFeedback onPress={() => {
                            Animated.parallel([
                                Animated.timing(slideAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
                                Animated.timing(backdropAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
                            ]).start(() => {
                                setShowThesisModal(false);
                            });
                        }}>
                            <Animated.View style={[styles.modalBackdrop, { opacity: backdropAnim }]} />
                        </TouchableWithoutFeedback>

                        <Animated.View style={[
                            styles.modalSheet,
                            {
                                backgroundColor: c.surface,
                                maxHeight: '90%',
                                transform: [{ translateY: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [800, 0] }) }],
                            },
                        ]}>
                            <View style={styles.modalHandle}>
                                <View style={[styles.modalHandleBar, { backgroundColor: c.border }]} />
                            </View>

                            <View style={styles.modalHeader}>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.modalTitle, { color: c.text }]}>Investment Thesis</Text>
                                    <Text style={[styles.modalSubtitle, { color: c.textTertiary }]}>{selectedHolding?.company_name || selectedHolding?.nse_symbol}</Text>
                                </View>
                                <TouchableOpacity onPress={() => {
                                    Animated.parallel([
                                        Animated.timing(slideAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
                                        Animated.timing(backdropAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
                                    ]).start(() => {
                                        setShowThesisModal(false);
                                    });
                                }} style={[styles.modalCloseBtn, { backgroundColor: c.surfaceElevated }]}>
                                    <Ionicons name="close" size={18} color={c.textSecondary} />
                                </TouchableOpacity>
                            </View>

                            <ScrollView style={styles.modalBody} contentContainerStyle={{ paddingBottom: Spacing['2xl'] }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                                
                                <Text style={[styles.inputLabel, { color: c.textSecondary, marginTop: Spacing.sm }]}>Your Thesis</Text>
                                <TextInput
                                    style={[styles.thesisInput, { backgroundColor: c.inputBg, borderColor: c.inputBorder, color: c.text, minHeight: 100 }]}
                                    placeholder="Why did you buy/sell this stock?"
                                    placeholderTextColor={c.textTertiary}
                                    value={thesisInput}
                                    onChangeText={setThesisInput}
                                    multiline
                                    textAlignVertical="top"
                                />

                                <TouchableOpacity
                                    style={[styles.modalSubmitBtn, { backgroundColor: Colors.brand.primary, opacity: isCheckingThesis || !thesisInput.trim() ? 0.6 : 1, marginTop: Spacing.lg }]}
                                    onPress={checkThesis}
                                    disabled={isCheckingThesis || !thesisInput.trim()}
                                    activeOpacity={0.85}
                                >
                                    {isCheckingThesis ? (
                                        <ActivityIndicator color="#fff" />
                                    ) : (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                            <Ionicons name="sparkles" size={20} color="#fff" />
                                            <Text style={{ fontWeight: '700', fontSize: FontSize.base, color: '#fff' }}>Save & Check Market Thesis</Text>
                                        </View>

                                    )}
                                </TouchableOpacity>

                                {thesisFeedback ? (
                                    <View style={{ marginTop: Spacing.xl, backgroundColor: c.surfaceElevated, padding: Spacing.lg, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.brand.secondary + '40' }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                <View style={[styles.aiIconWrap, { width: 30, height: 30, backgroundColor: Colors.brand.secondary }]}>
                                                    <Ionicons name="sparkles" size={16} color="#fff" />
                                                </View>
                                                <Text style={{ fontSize: FontSize.base, fontWeight: '700', color: c.text }}>AI Analysis</Text>
                                            </View>
                                            {thesisTokensUsed != null && (
                                                <Text style={{ fontSize: 10, color: Colors.brand.secondary, fontWeight: '600', backgroundColor: Colors.brand.secondary + '15', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 12 }}>
                                                    -{thesisTokensUsed} credits
                                                </Text>
                                            )}
                                        </View>
                                        <Text style={{ fontSize: FontSize.sm, color: c.textSecondary, lineHeight: 22 }}>
                                            {thesisFeedback}
                                        </Text>
                                    </View>
                                ) : null}

                                <View style={{ height: 40 }} />
                            </ScrollView>
                        </Animated.View>
                    </KeyboardAvoidingView>
                </Modal>

                <View style={{ height: 40 }} />
            </ResponsiveScrollView>
        </SafeAreaView>
    );
}


const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.xl, paddingTop: Platform.select({ ios: 60, web: 20, default: 48 }), paddingBottom: Spacing.lg },
    title: { fontSize: FontSize.xl, fontWeight: '700', letterSpacing: -0.3 },
    subtitle: { fontSize: FontSize.sm, marginTop: 2 },
    addBtn: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    metricsRow: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: Spacing.xl, gap: Spacing.sm, marginBottom: Spacing.xl },
    chartsRow: { paddingHorizontal: Spacing.xl, gap: Spacing.md, marginBottom: Spacing.xl },
    chartCard: { padding: Spacing.lg },
    chartTitle: { fontSize: FontSize.md, fontWeight: '700' },
    chartSub: { fontSize: FontSize.xs, marginTop: 2 },
    section: { paddingHorizontal: Spacing.xl },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
    sectionTitle: { fontSize: FontSize.lg, fontWeight: '700', letterSpacing: -0.2 },
    alertPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    alertText: { fontSize: 10, fontWeight: '700' },
    loadingWrap: { paddingVertical: 40, alignItems: 'center' },
    holdingCard: { padding: Spacing.lg, marginBottom: Spacing.sm },
    holdingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    holdingDot: { width: 10, height: 10, borderRadius: 5 },
    holdingName: { fontSize: FontSize.base, fontWeight: '600' },
    holdingMeta: { fontSize: FontSize.xs, marginTop: 2 },
    holdingRight: { alignItems: 'flex-end', minWidth: 80 },
    holdingValue: { fontSize: FontSize.base, fontWeight: '700' },
    pnlBadge: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginTop: 3 },
    pnlText: { fontSize: 11, fontWeight: '700' },
    deleteBtn: { paddingLeft: 4 },
    progressBg: { height: 3, borderRadius: 2, overflow: 'hidden' },
    progressFill: { height: 3, borderRadius: 2 },

    // Modal
    modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
    modalSheet: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        borderTopLeftRadius: 24, borderTopRightRadius: 24,
        paddingBottom: Platform.OS === 'ios' ? 34 : 24, maxHeight: '85%',
        shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 25,
        ...(Platform.OS === 'web' ? { width: '90%', maxWidth: 520, marginHorizontal: 'auto', bottom: '10%', borderRadius: 24 } as any : {}),
    },
    modalHandle: { alignItems: 'center', paddingTop: 12, paddingBottom: 4 },
    modalHandleBar: { width: 40, height: 4, borderRadius: 2 },
    modalHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.xl, paddingTop: Spacing.md, paddingBottom: Spacing.lg },
    modalTitle: { fontSize: FontSize.lg, fontWeight: '700', letterSpacing: -0.3 },
    modalSubtitle: { fontSize: FontSize.xs, marginTop: 2 },
    modalCloseBtn: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    modalBody: { paddingHorizontal: Spacing.xl },
    searchContainer: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: BorderRadius.md, paddingHorizontal: 14, height: 50, gap: 10 },
    searchTextInput: { flex: 1, fontSize: FontSize.base, height: 50 },
    selectedPill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: BorderRadius.full, borderWidth: 1, marginTop: Spacing.sm },
    selectedPillText: { fontSize: FontSize.sm, fontWeight: '700', letterSpacing: 0.5 },
    searchResultsContainer: { marginTop: Spacing.sm, borderRadius: BorderRadius.md, borderWidth: 1, overflow: 'hidden' },
    searchResultItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, gap: 12, borderBottomWidth: StyleSheet.hairlineWidth },
    searchResultIcon: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
    searchLoading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: Spacing.lg },
    txTypeRow: { flexDirection: 'row', gap: Spacing.sm },
    txTypeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, borderRadius: BorderRadius.sm, borderWidth: 1.5 },
    txTypeBtnText: { fontSize: FontSize.sm, fontWeight: '700', letterSpacing: 0.5 },
    formRow: { flexDirection: 'row', gap: Spacing.md },
    inputLabel: { fontSize: FontSize.xs, fontWeight: '600', marginBottom: 6, letterSpacing: 0.3, textTransform: 'uppercase' },
    modalInput: { borderWidth: 1, borderRadius: BorderRadius.sm, paddingHorizontal: 14, height: 48, fontSize: FontSize.base },
    modalSubmitBtn: { height: 52, borderRadius: BorderRadius.md, justifyContent: 'center', alignItems: 'center', marginTop: Spacing.xl },
    // Thesis input
    thesisInput: { borderWidth: 1, borderRadius: BorderRadius.sm, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 12, fontSize: FontSize.sm, minHeight: 80, lineHeight: 20 },
    // Date picker UI
    dateShortcutsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: Spacing.sm },
    dateChip: { borderWidth: 1, borderRadius: BorderRadius.full, paddingHorizontal: 12, paddingVertical: 6 },
    dateChipText: { fontSize: 11, fontWeight: '600' },
    dateInputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: BorderRadius.sm, paddingHorizontal: 12, height: 46, gap: 8 },
    dateTextInput: { flex: 1, fontSize: FontSize.base },
    dateValidBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
    // Excel import button in header
    excelBtn: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
    // Excel import modal
    excelModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: Platform.OS === 'web' ? 'center' : 'flex-end',
        alignItems: Platform.OS === 'web' ? 'center' : 'stretch',
    },
    excelModalSheet: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '92%',
        flex: 0,
        paddingBottom: Platform.OS === 'ios' ? 34 : 0,
        ...(Platform.OS === 'web' ? { width: '90%', maxWidth: 800, borderRadius: 24, maxHeight: '85%', overflow: 'hidden' } as any : {})
    },
    excelModalHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg, paddingBottom: Spacing.md },
    excelStatRow: { flexDirection: 'row', paddingVertical: Spacing.md, marginHorizontal: Spacing.xl, borderRadius: BorderRadius.md, marginBottom: Spacing.sm },
    excelStat: { flex: 1, alignItems: 'center' },
    excelStatNum: { fontSize: FontSize.lg, fontWeight: '800' },
    excelStatLabel: { fontSize: 9, fontWeight: '600', textTransform: 'uppercase', marginTop: 2 },
    excelStatDivider: { width: 1, marginVertical: 4 },
    excelTableHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.xl, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
    excelColHead: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
    excelTableRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.xl, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
    excelCell: { fontSize: 12 },
    excelActionPill: { justifyContent: 'center', alignItems: 'center', paddingVertical: 3, borderRadius: 4, marginRight: 4 },
    excelEmptyImport: { borderRadius: BorderRadius.md, padding: Spacing.xl, alignItems: 'center' },
    // Excel format guide
    excelGuideSheet: {
        borderTopLeftRadius: 24, borderTopRightRadius: 24,
        paddingBottom: Platform.OS === 'ios' ? 34 : 16,
        maxHeight: '85%',
        width: Platform.OS === 'web' ? '90%' : '100%',
        shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 25,
        ...(Platform.OS === 'web'
            ? { maxWidth: 600, borderRadius: 24, overflow: 'hidden' } as any
            : {}),
    },
    guideInfoBox: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: BorderRadius.md, borderWidth: 1, alignItems: 'flex-start' },
    formatChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: BorderRadius.full },
    guideTableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 10, overflow: 'hidden' },
    guideHeaderCell: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.3 },
    guideCell: { fontSize: 11 },
    guideDetailRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
    guideDetailIcon: { width: 30, height: 30, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },

    // AI Banner
    aiSection: { paddingHorizontal: Spacing.xl, marginBottom: Spacing.xl },
    aiBanner: { borderRadius: BorderRadius.xl, padding: Spacing.lg, gap: Spacing.md },
    aiLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    aiIconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
    aiBannerTitle: { color: '#fff', fontSize: FontSize.base, fontWeight: '700' },
    aiBannerSub: { color: 'rgba(255,255,255,0.75)', fontSize: FontSize.xs, marginTop: 2, lineHeight: 16 },
    aiChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    aiChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: BorderRadius.full },
    aiChipText: { color: 'rgba(255,255,255,0.9)', fontSize: 11, fontWeight: '600' },

    // Sector Allocation UI
    sectorList: { marginTop: Spacing.md, gap: 8 },
    sectorRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    sectorDot: { width: 8, height: 8, borderRadius: 4 },
    sectorLabel: { flex: 1, fontSize: 11 },
    sectorPct: { fontSize: 11, fontWeight: '700' },

    // Benchmark / IRR UI
    benchmarkCard: { padding: Spacing.lg, marginTop: Spacing.sm },
    benchmarkRow: { flexDirection: 'row', alignItems: 'center' },
    benchmarkDivider: { width: 1, height: 60, marginHorizontal: Spacing.lg },
    benchmarkLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
    benchmarkValue: { fontSize: FontSize.xl, fontWeight: '800' },
    benchmarkNote: { fontSize: 9, marginTop: 4, fontStyle: 'italic' },
    // Alpha highlight block
    alphaHighlight: { borderRadius: BorderRadius.md, borderWidth: 1, paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg, alignItems: 'center' },
    alphaLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
    alphaValue: { fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
    irrIconWrap: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
    irrSub: { fontSize: 9, marginTop: 2, fontStyle: 'italic' },
    holdingPeriodRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.md, paddingTop: Spacing.md, borderTopWidth: StyleSheet.hairlineWidth },

    // Footer & Legal
    footer: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing['2xl'], gap: Spacing.md, alignItems: 'center' },
    dataStatus: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    footerText: { fontSize: 11 },
    reportLink: { paddingVertical: 4 },
    legalBox: { padding: Spacing.lg, borderRadius: BorderRadius.md, width: '100%', marginTop: Spacing.sm },
    legalText: { fontSize: 10, lineHeight: 15, textAlign: 'justify' },
});

