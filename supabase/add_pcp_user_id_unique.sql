-- ═══════════════════════════════════════════════════════════════════
-- Migration: Fix pending_credit_purchases for Tradebox flow
--
-- Changes:
--   1. Add `email` column — stores the user's registered email so the
--      webhook can match payments even if the user pays with a
--      different email on Tradebox.
--   2. Add `phone` column — same fallback strategy for phone.
--   3. Add UNIQUE constraint on user_id — needed for upsert.
--   4. Make amount_paise nullable — not needed for Tradebox flow.
--
-- Run this in Supabase SQL Editor BEFORE deploying the webhook.
-- ═══════════════════════════════════════════════════════════════════

-- Step 1: Add email and phone columns
ALTER TABLE public.pending_credit_purchases
  ADD COLUMN IF NOT EXISTS email TEXT NULL;

ALTER TABLE public.pending_credit_purchases
  ADD COLUMN IF NOT EXISTS phone TEXT NULL;

-- Step 2: Remove duplicate user_id rows (keep only the latest per user)
DELETE FROM public.pending_credit_purchases
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id) id
  FROM public.pending_credit_purchases
  ORDER BY user_id, created_at DESC
);

-- Step 3: Add unique constraint on user_id (required for upsert)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pending_credit_purchases_user_id_key'
  ) THEN
    ALTER TABLE public.pending_credit_purchases
      ADD CONSTRAINT pending_credit_purchases_user_id_key UNIQUE (user_id);
  END IF;
END $$;

-- Step 4: Make amount_paise nullable (not needed for Tradebox flow)
ALTER TABLE public.pending_credit_purchases
  ALTER COLUMN amount_paise SET DEFAULT 0;

ALTER TABLE public.pending_credit_purchases
  ALTER COLUMN amount_paise DROP NOT NULL;

-- Step 5: Add index on email for webhook reverse-lookup
CREATE INDEX IF NOT EXISTS idx_pcp_email
  ON public.pending_credit_purchases USING btree (email);
