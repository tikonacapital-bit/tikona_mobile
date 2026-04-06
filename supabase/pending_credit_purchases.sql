-- ═══════════════════════════════════════════════════════════════════
-- pending_credit_purchases table
-- Tracks AI credit purchase attempts (NOT subscriptions — those stay in pending_payments)
-- This table is read by razorpay-webhook to grant credits after payment.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.pending_credit_purchases (
  id              UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id         TEXT NOT NULL,
  plan_id         TEXT NOT NULL,                          -- e.g. 'pack_100', 'pack_500', 'pack_2000'
  credits         INTEGER NOT NULL,                       -- 100, 500, 2000
  amount_paise    INTEGER NOT NULL,                       -- amount in paise sent to Razorpay
  razorpay_link_id TEXT NULL,                             -- Razorpay payment link id (plink_xxxxx)
  razorpay_payment_id TEXT NULL,                          -- filled by webhook after capture
  status          TEXT NOT NULL DEFAULT 'pending',        -- pending | paid | expired | failed
  created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  paid_at         TIMESTAMP WITH TIME ZONE NULL,
  CONSTRAINT pending_credit_purchases_pkey PRIMARY KEY (id)
) TABLESPACE pg_default;

-- Index for webhook lookups
CREATE INDEX IF NOT EXISTS idx_pcp_user_id
  ON public.pending_credit_purchases USING btree (user_id);

CREATE INDEX IF NOT EXISTS idx_pcp_razorpay_link_id
  ON public.pending_credit_purchases USING btree (razorpay_link_id);

CREATE INDEX IF NOT EXISTS idx_pcp_status
  ON public.pending_credit_purchases USING btree (status);

-- ═══════════════════════════════════════════════════════════════════
-- RLS Policies — users can only see their own pending purchases
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE public.pending_credit_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own credit purchases"
  ON public.pending_credit_purchases FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own credit purchases"
  ON public.pending_credit_purchases FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

-- Service role (webhook) will bypass RLS for updates

-- Grant permissions
GRANT ALL ON TABLE public.pending_credit_purchases TO anon;
GRANT ALL ON TABLE public.pending_credit_purchases TO authenticated;
GRANT ALL ON TABLE public.pending_credit_purchases TO service_role;
