/**
 * Shared TypeScript types for the mobile app
 * Mirrors tikona-research-os database schema
 */


export interface ResearchReport {
    report_id: string;
    session_id?: string;
    company_name: string;
    nse_symbol: string;
    recommendation: 'BUY' | 'SELL' | 'HOLD' | null;
    target_price: number | null;
    recommendation_rationale?: string | null;
    // Sections
    company_background?: string | null;
    business_model?: string | null;
    management_analysis?: string | null;
    industry_overview?: string | null;
    industry_tailwinds?: string | null;
    demand_drivers?: string | null;
    industry_risks?: string | null;
    // Media
    pdf_file_id?: string | null;
    pdf_file_url?: string | null;
    audio_file_url?: string | null;
    video_file_url?: string | null;
    // Publishing
    is_published?: boolean;
    published_at?: string | null;
    plan?: 'midcap_wealth' | 'smallcap_alpha' | 'sme_emerging' | null;
    status?: 'generating' | 'draft' | 'completed' | 'error';
    created_at?: string;
    updated_at?: string;
}

// Report assignment (links reports to individual users)
export interface UserReportAssignment {
    id: string;
    email: string;
    report_id: string;
    assigned_at: string;
}

// Equity universe data
export interface EquityUniverse {
    company_id: number;
    company_name: string | null;
    nse_code: string | null;
    bse_code: string | null;
    sector: string | null;
    industry: string | null;
    market_cap: number | null;
    current_price: number | null;
    high_52_week: number | null;
    low_52_week: number | null;
    pe_ttm: number | null;
    ev_ebitda_ttm: number | null;
    roe: number | null;
    roce: number | null;
    ebitda_margin_ttm: number | null;
    pat_margin_ttm: number | null;
    debt: number | null;
    promoter_holding_pct: number | null;
    book_value: number | null;
    eps_ttm: number | null;
    return_down_from_52w_high: number | null;
    return_up_from_52w_low: number | null;
    return_1m: number | null;
    return_3m: number | null;
    return_6m: number | null;
    return_12m: number | null;
    consensus_target_price: number | null;
}

// KYC submission
export interface KycRecord {
    id: string;
    user_id: string;
    full_name: string;
    aadhar_pan: string;
    bank_account: string;
    ifsc_code: string;
    status: 'pending' | 'approved' | 'rejected';
    // Tradebox integration fields
    tradebox_reference_id?: string;   // KYC reference ID from Tradebox
    razorpay_payment_id?: string;     // Payment that triggered this KYC
    kyc_initiated_at?: string;        // When Tradebox KYC was triggered
    created_at: string;
    updated_at: string;
}

// User risk profile
export type RiskProfileLevel = 'Conservative' | 'Moderate' | 'Aggressive';
export type DisplayLabel = 'Beginner' | 'Intermediate' | 'Pro';
export type ProfileMethod = 'quiz' | 'manual' | 'quiz_override';

// Mapping between risk profile and display label
export const RISK_DISPLAY_MAP: Record<RiskProfileLevel, DisplayLabel> = {
    Conservative: 'Beginner',
    Moderate: 'Intermediate',
    Aggressive: 'Pro',
};

export const DISPLAY_RISK_MAP: Record<DisplayLabel, RiskProfileLevel> = {
    Beginner: 'Conservative',
    Intermediate: 'Moderate',
    Pro: 'Aggressive',
};

export interface UserProfile {
    id: string;
    user_id: string;
    risk_score: number | null;              // null if user skipped quiz
    risk_profile: RiskProfileLevel;
    profile_method: ProfileMethod;          // how the profile was determined
    display_label: DisplayLabel | null;     // user-friendly label
    answers: Record<string, number> | null; // raw quiz answers
    email?: string | null;                  // synced user email
    created_at: string;
    updated_at: string;
}

// Subscription
export interface Subscription {
    id: string;
    user_id: string;
    plan: 'midcap_wealth' | 'smallcap_alpha' | 'sme_emerging' | 'all_in_growth';
    started_at: string;
    expires_at: string | null;
    is_active: boolean;
    amount_paid?: number | null;
    razorpay_payment_id?: string | null;
    created_at: string;
    updated_at?: string;
}

// Refund request
export interface RefundRequest {
    id: string;
    user_id: string;
    subscription_id: string;
    plan: string;
    total_paid: number;
    months_used: number;
    months_remaining: number;
    refund_amount: number;
    upi_id: string; // User's UPI ID for direct 1-click refund payment
    status: 'pending' | 'approved' | 'rejected' | 'processed';
    reason: string | null;
    admin_notes: string | null;
    reviewed_by: string | null;
    reviewed_at: string | null;
    created_at: string;
    updated_at: string;
}

// Numeric plan prices (for refund calculation)
export const PLAN_PRICES: Record<string, number> = {
    midcap_wealth: 24999,
    smallcap_alpha: 29999,
    sme_emerging: 35999,
    all_in_growth: 74999,
};

// AI Chat Session (logs of AI chat conversations)
export interface AIChatSession {
    id: string;
    user_id: string;
    report_id: string;
    company_name: string;
    nse_symbol: string;
    messages: {
        role: 'user' | 'assistant' | 'system';
        text: string;
        timestamp: string;
        input_mode?: 'voice' | 'text';
        has_audio?: boolean;
    }[];
    message_count: number;
    started_at: string;
    ended_at: string | null;
    created_at: string;
    updated_at: string;
}

// Portfolio
export interface CustomerPortfolio {
    id: string;
    user_id: string;
    name: string;
    created_at: string;
    updated_at: string;
}

export interface PortfolioHolding {
    id: string;
    portfolio_id: string;
    nse_symbol: string;
    company_name: string | null;
    quantity: number;
    buy_price: number;
    buy_date: string | null;       // For SELL records this holds the sell date
    investment_thesis: string | null; // '[SELL] ...' prefix marks a sell transaction
    created_at: string;
}

export interface EnrichedHolding extends PortfolioHolding {
    current_price: number | null;
    sector: string | null;
    invested: number;
    current_value: number | null;
    pnl: number | null;
    pnl_pct: number | null;
}

/** Pre-calculated IRR metrics written by the Python backend script. */
export interface PortfolioMetrics {
    portfolio_id: string;
    portfolio_irr: number | null;   // annualized % e.g. 18.5
    nifty_irr: number | null;       // Nifty 50 benchmark %
    alpha: number | null;           // portfolio_irr - nifty_irr
    avg_holding_days: number | null;
    avg_holding_years: number | null;
    valid_count: number | null;
    calculated_at: string | null;
}

// Profiling question (matches profiling_questions table)
export interface ProfilingQuestion {
    id: string;
    question_text: string;
    options: { text: string; score: number }[];
    difficulty: 'easy' | 'medium' | 'hard';
    sort_order: number;
    is_active: boolean;
}

// Subscription plans
export const PLANS = {
    midcap_wealth: {
        name: 'Mid Cap Wealth Builders',
        description: 'Consistent performers with long-term compounding potential',
        price: '₹24,999',
        period: '/year',
        tradeboxUrl: 'https://tradeboxlive.com/view/services/69b14ed46313330572f9419a',
        telegramUrl: 'https://t.me/+oW0wvTa0830xMDM1',
        features: [
            'Curated mid cap stock picks',
            'Consistent performer recommendations',
            'Detailed research reports',
            'Portfolio tracking',
            'Email support',
        ],
        limitations: [],
    },
    smallcap_alpha: {
        name: 'Smallcap Alpha Picks',
        description: 'Focused ideas for aggressive growth investors',
        price: '₹29,999',
        period: '/year',
        tradeboxUrl: 'https://tradeboxlive.com/view/services/69b14fe46313330572f95675',
        telegramUrl: 'https://t.me/+PVyybrFQfuhkYjA1',
        features: [
            'High-alpha smallcap ideas',
            'Aggressive growth picks',
            'In-depth company analysis',
            'Portfolio tracking',
            'Priority email support',
        ],
        limitations: [],
    },
    sme_emerging: {
        name: 'SME Emerging Business',
        description: 'Scalable models from the SME platform',
        price: '₹35,999',
        period: '/year',
        tradeboxUrl: 'https://tradeboxlive.com/view/services/69b2a7d66eea45a42e77510c',
        telegramUrl: 'https://t.me/+qiWl18xxG8k0YmE1',
        features: [
            'High-growth SME ideas',
            'Early-stage businesses',
            'In-depth company analysis',
            'Portfolio tracking',
            'Priority email support',
        ],
        limitations: [],
    },
    all_in_growth: {
        name: 'All In Growth Bundle',
        description: 'Complete access to all research plans',
        price: '₹74,999',
        period: '/year',
        tradeboxUrl: 'https://tradeboxlive.com/view/packages/69b2a8676eea45a42e7751ae',
        telegramUrl: 'https://t.me/+oW0wvTa0830xMDM1', // Assuming gives access to all or maybe just one. Let's provide midcap as fallback or contact support. I'll omit it or put a placeholder. Let's just leave it empty.
        features: [
            'Everything in all plans',
            'Mid cap + Smallcap + SME picks',
            'Personalised research calls',
            'Portfolio advisory sessions',
            'Priority dedicated support',
        ],
        limitations: [],
    },
} as const;
