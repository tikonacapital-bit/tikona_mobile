    -- ═══════════════════════════════════════════════════════════════════
    -- RLS Policies for Clerk JWT Authentication
    --
    -- These policies use the Clerk JWT 'sub' claim to identify users.
    -- The JWT is signed with HS256 using the Supabase JWT secret.
    --
    -- PREREQUISITE: In your Clerk JWT template ("supabase"), 
    -- set the Signing Key to your Supabase JWT Secret
    -- (Supabase Dashboard → Settings → API → JWT Settings → JWT Secret)
    --
    -- Run this ONCE in Supabase SQL Editor after enabling RLS.
    -- ═══════════════════════════════════════════════════════════════════


    -- ── 1. SUBSCRIPTIONS ────────────────────────────────────────────────

    ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

    -- Users can read their own subscription
    CREATE POLICY "Users can view own subscription"
        ON public.subscriptions FOR SELECT
        USING (user_id::text = (auth.jwt() ->> 'sub'));

    -- Users can insert their own subscription (for profiling free plan)
    CREATE POLICY "Users can insert own subscription"
        ON public.subscriptions FOR INSERT
        WITH CHECK (user_id::text = (auth.jwt() ->> 'sub'));

    -- Users can update their own subscription
    CREATE POLICY "Users can update own subscription"
        ON public.subscriptions FOR UPDATE
        USING (user_id::text = (auth.jwt() ->> 'sub'));

    -- Service role (webhook) can do everything (bypasses RLS automatically)


    -- ── 2. PROFILES ─────────────────────────────────────────────────────

    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

    -- Users can read their own profile
    CREATE POLICY "Users can view own profile"
        ON public.profiles FOR SELECT
        USING (user_id::text = (auth.jwt() ->> 'sub'));

    -- Users can insert their own profile (profiling quiz)
    CREATE POLICY "Users can insert own profile"
        ON public.profiles FOR INSERT
        WITH CHECK (user_id::text = (auth.jwt() ->> 'sub'));

    -- Users can update their own profile
    CREATE POLICY "Users can update own profile"
        ON public.profiles FOR UPDATE
        USING (user_id::text = (auth.jwt() ->> 'sub'));


    -- ── 3. KYC ──────────────────────────────────────────────────────────

    ALTER TABLE public.kyc ENABLE ROW LEVEL SECURITY;

    -- Users can read their own KYC record
    CREATE POLICY "Users can view own kyc"
        ON public.kyc FOR SELECT
        USING (user_id::text = (auth.jwt() ->> 'sub'));


    -- ── 4. REFUND REQUESTS ──────────────────────────────────────────────

    ALTER TABLE public.refund_requests ENABLE ROW LEVEL SECURITY;

    -- Users can read their own refund requests
    CREATE POLICY "Users can view own refund requests"
        ON public.refund_requests FOR SELECT
        USING (user_id::text = (auth.jwt() ->> 'sub'));

    -- Users can insert refund requests for themselves
    CREATE POLICY "Users can insert own refund request"
        ON public.refund_requests FOR INSERT
        WITH CHECK (user_id::text = (auth.jwt() ->> 'sub'));


    -- ── 5. PENDING PAYMENTS ─────────────────────────────────────────────

    ALTER TABLE public.pending_payments ENABLE ROW LEVEL SECURITY;

    -- Users can manage their own pending payments
    CREATE POLICY "Users can view own pending payments"
        ON public.pending_payments FOR SELECT
        USING (user_id::text = (auth.jwt() ->> 'sub'));

    CREATE POLICY "Users can insert own pending payment"
        ON public.pending_payments FOR INSERT
        WITH CHECK (user_id::text = (auth.jwt() ->> 'sub'));

    CREATE POLICY "Users can update own pending payment"
        ON public.pending_payments FOR UPDATE
        USING (user_id::text = (auth.jwt() ->> 'sub'));


    -- ── 6. CUSTOMER PORTFOLIOS ──────────────────────────────────────────

    ALTER TABLE public.customer_portfolios ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Users can view own portfolios"
        ON public.customer_portfolios FOR SELECT
        USING (user_id::text = (auth.jwt() ->> 'sub'));

    CREATE POLICY "Users can insert own portfolio"
        ON public.customer_portfolios FOR INSERT
        WITH CHECK (user_id::text = (auth.jwt() ->> 'sub'));

    CREATE POLICY "Users can update own portfolio"
        ON public.customer_portfolios FOR UPDATE
        USING (user_id::text = (auth.jwt() ->> 'sub'));

    CREATE POLICY "Users can delete own portfolio"
        ON public.customer_portfolios FOR DELETE
        USING (user_id::text = (auth.jwt() ->> 'sub'));


    -- ── 7. PORTFOLIO HOLDINGS ───────────────────────────────────────────
    -- Holdings are linked via portfolio_id, so we check ownership through the portfolio

    ALTER TABLE public.portfolio_holdings ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Users can view own holdings"
        ON public.portfolio_holdings FOR SELECT
        USING (
            portfolio_id IN (
                SELECT id FROM public.customer_portfolios
                WHERE user_id::text = (auth.jwt() ->> 'sub')
            )
        );

    CREATE POLICY "Users can insert own holdings"
        ON public.portfolio_holdings FOR INSERT
        WITH CHECK (
            portfolio_id IN (
                SELECT id FROM public.customer_portfolios
                WHERE user_id::text = (auth.jwt() ->> 'sub')
            )
        );

    CREATE POLICY "Users can delete own holdings"
        ON public.portfolio_holdings FOR DELETE
        USING (
            portfolio_id IN (
                SELECT id FROM public.customer_portfolios
                WHERE user_id::text = (auth.jwt() ->> 'sub')
            )
        );


    -- ── 8. PUBLIC TABLES (read-only for everyone) ───────────────────────
    -- These tables should be readable by any authenticated or anon user

    -- Research reports (Users can only read assigned published reports)
    ALTER TABLE public.research_reports ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Users can view assigned published reports"
        ON public.research_reports FOR SELECT
        USING (
            is_published = true AND
            EXISTS (
                SELECT 1 FROM public.user_report_assignments
                WHERE user_report_assignments.report_id::text = research_reports.report_id::text
                  AND user_report_assignments.email = (auth.jwt() ->> 'email')
            )
        );

    -- User report assignments — restrict to own email via JWT
    -- Run this to replace the old USING (true) policy:
    --   DROP POLICY IF EXISTS "Users can view own assignments" ON public.user_report_assignments;
    ALTER TABLE public.user_report_assignments ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Users can view own assignments"
        ON public.user_report_assignments FOR SELECT
        USING (email = (auth.jwt() ->> 'email'));

    -- Equity universe (public data)
    ALTER TABLE public.equity_universe ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Anyone can view equity universe"
        ON public.equity_universe FOR SELECT
        USING (true);


    -- ═══════════════════════════════════════════════════════════════════
    -- IMPORTANT NOTES:
    -- 
    -- 1. The Supabase SERVICE_ROLE_KEY (used by your webhook Edge Function)
    --    BYPASSES RLS completely. So your tradebox-webhook will continue to
    --    work without any changes.
    --
    -- 2. Make sure your Clerk JWT template's signing key matches
    --    your Supabase JWT Secret exactly.
    --
    -- 3. If you get errors about policies already existing, drop them first:
    --    DROP POLICY IF EXISTS "policy name" ON public.table_name;
    -- ═══════════════════════════════════════════════════════════════════
