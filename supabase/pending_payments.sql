-- ═══════════════════════════════════════════════════════════════════
-- pending_payments table
-- Stores which plan a user intends to buy before they go to Tradebox.
-- Webhook reads this to identify the plan regardless of payment amount.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.pending_payments (
  id         UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id    TEXT NOT NULL,
  plan       TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT pending_payments_pkey PRIMARY KEY (id),
  CONSTRAINT pending_payments_user_id_key UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_pending_payments_user_id
  ON public.pending_payments USING btree (user_id);
