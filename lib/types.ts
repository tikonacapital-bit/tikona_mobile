/**
 * Shared TypeScript types for the mobile app
 * Mirrors tikona-research-os database schema
 */


export interface ResearchReport {
    report_id: string;
    session_id: string;
    company_name: string;
    nse_symbol: string;
    recommendation: 'BUY' | 'SELL' | 'HOLD' | null;
    target_price: number | null;
    recommendation_rationale: string | null;
    // Sections
    company_background: string | null;
    business_model: string | null;
    management_analysis: string | null;
    industry_overview: string | null;
    industry_tailwinds: string | null;
    demand_drivers: string | null;
    industry_risks: string | null;
    // Media
    pdf_file_id: string | null;
    pdf_file_url: string | null;
    audio_file_url: string | null;
    video_file_url: string | null;
    // Publishing
    is_published: boolean;
    published_at: string | null;
    status: 'generating' | 'draft' | 'completed' | 'error';
    created_at: string;
    updated_at: string;
}

// Report assignment (links reports to individual users)
export interface UserReportAssignment {
    id: string;
    user_id: string;
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
    created_at: string;
    updated_at: string;
}

// Subscription
export interface Subscription {
    id: string;
    user_id: string;
    plan: 'free' | 'basic' | 'premium';
    started_at: string;
    expires_at: string | null;
    is_active: boolean;
    created_at: string;
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
    buy_date: string | null;
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
    free: {
        name: 'Free',
        price: '₹0',
        period: '',
        features: [
            'View 3 reports per month',
            'Basic stock info',
            'Portfolio (up to 5 stocks)',
        ],
        limitations: ['No audio summaries', 'No video briefings', 'No PDF downloads'],
    },
    basic: {
        name: 'Basic',
        price: '₹499',
        period: '/month',
        features: [
            'Unlimited report access',
            'Audio summaries',
            'Full portfolio tracking',
            'Email support',
        ],
        limitations: ['No video briefings'],
    },
    premium: {
        name: 'Premium',
        price: '₹999',
        period: '/month',
        features: [
            'Everything in Basic',
            'Video research briefings',
            'PDF report downloads',
            'Priority research requests',
            'Dedicated support',
        ],
        limitations: [],
    },
} as const;
