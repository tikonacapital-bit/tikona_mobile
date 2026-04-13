-- Migration: portfolio_metrics
-- Run this in Supabase SQL Editor
-- Stores pre-calculated IRR results written by the Python backend script

CREATE TABLE IF NOT EXISTS public.portfolio_metrics (
    portfolio_id       uuid        NOT NULL PRIMARY KEY,
    portfolio_irr      numeric,          -- annualized IRR % e.g. 18.5
    nifty_irr          numeric,          -- Nifty 50 benchmark IRR %
    alpha              numeric,          -- portfolio_irr - nifty_irr
    avg_holding_days   integer,
    avg_holding_years  numeric,
    valid_count        integer,          -- number of holdings used in calculation
    calculated_at      timestamptz DEFAULT now(),
    CONSTRAINT portfolio_metrics_portfolio_fkey
        FOREIGN KEY (portfolio_id) REFERENCES public.customer_portfolios(id) ON DELETE CASCADE
);

-- RLS: users can only read their own portfolio's metrics
ALTER TABLE public.portfolio_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own metrics" ON public.portfolio_metrics;

CREATE POLICY "Users read own metrics"
    ON public.portfolio_metrics FOR SELECT
    USING (
        portfolio_id IN (
            SELECT id FROM public.customer_portfolios
            WHERE user_id = (SELECT auth.uid()::text)
        )
    );

-- Service role (used by Python script) bypasses RLS automatically
-- No insert/update policy needed — only the backend writes to this table

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_portfolio_metrics_portfolio_id
    ON public.portfolio_metrics (portfolio_id);

-- Also add investment_thesis column to portfolio_holdings if it doesn't exist yet
-- (some older projects may not have it)
ALTER TABLE public.portfolio_holdings
    ADD COLUMN IF NOT EXISTS investment_thesis text;
