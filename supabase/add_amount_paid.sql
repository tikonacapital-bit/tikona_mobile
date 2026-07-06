-- ═══════════════════════════════════════════════════════════════════
-- Add amount_paid column to subscriptions
-- Stores the actual payment amount (in INR) for accurate refund calculations
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.subscriptions
ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(10,2);

-- Backfill existing subscriptions with plan prices (if needed)
-- UPDATE public.subscriptions SET amount_paid = 24999 WHERE plan = 'midcap_wealth' AND amount_paid IS NULL;
-- UPDATE public.subscriptions SET amount_paid = 28999 WHERE plan = 'smallcap_alpha' AND amount_paid IS NULL;
-- UPDATE public.subscriptions SET amount_paid = 35999 WHERE plan = 'sme_emerging' AND amount_paid IS NULL;
-- UPDATE public.subscriptions SET amount_paid = 75999 WHERE plan = 'all_in_growth' AND amount_paid IS NULL;
