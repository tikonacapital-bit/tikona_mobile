-- ═══════════════════════════════════════════════════════════════════
-- Migration: Convert Fixed Credits → Token-Based Credits
--
-- WHAT: Multiplies all existing user balances by 1000
--       so that 1 old credit = 1000 new token-credits.
--
-- WHY:  The system now deducts real OpenRouter token usage
--       instead of a flat "1 credit per message." This migration
--       converts existing balances to the new token scale.
--
-- RUN THIS ONCE in Supabase SQL Editor, then deploy all
-- updated edge functions simultaneously.
-- ═══════════════════════════════════════════════════════════════════

-- 1. Multiply all existing wallet balances by 1000
UPDATE public.ai_wallets
SET
  credits_balance = credits_balance * 1000,
  lifetime_credits_used = lifetime_credits_used * 1000,
  updated_at = now();

-- 2. Update the default column value for new users
ALTER TABLE public.ai_wallets
  ALTER COLUMN credits_balance SET DEFAULT 50000;

-- 3. Re-create the deduct_ai_credits RPC with 50000 default
CREATE OR REPLACE FUNCTION public.deduct_ai_credits(
  p_user_id text,
  p_amount integer,
  p_transaction_type text,
  p_metadata jsonb default '{}'::jsonb
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance integer;
  v_new_balance integer;
BEGIN
  INSERT INTO public.ai_wallets (user_id, credits_balance)
  VALUES (p_user_id, 50000)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT credits_balance INTO v_current_balance
  FROM public.ai_wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_current_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient AI credits';
  END IF;

  v_new_balance := v_current_balance - p_amount;

  UPDATE public.ai_wallets
  SET
    credits_balance = v_new_balance,
    lifetime_credits_used = lifetime_credits_used + p_amount,
    updated_at = now()
  WHERE user_id = p_user_id;

  INSERT INTO public.ai_credit_transactions (
    user_id, amount, balance_after, transaction_type, metadata
  ) VALUES (
    p_user_id, -p_amount, v_new_balance, p_transaction_type, p_metadata
  );

  RETURN v_new_balance;
END;
$$;

-- 4. Re-create the increment_ai_credits RPC with 50000 default
CREATE OR REPLACE FUNCTION public.increment_ai_credits(
  p_user_id text,
  p_amount integer,
  p_transaction_type text DEFAULT 'top_up',
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance integer;
  v_new_balance integer;
BEGIN
  INSERT INTO public.ai_wallets (user_id, credits_balance)
  VALUES (p_user_id, 50000)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT credits_balance INTO v_current_balance
  FROM public.ai_wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  v_new_balance := v_current_balance + p_amount;

  UPDATE public.ai_wallets
  SET
    credits_balance = v_new_balance,
    updated_at = now()
  WHERE user_id = p_user_id;

  INSERT INTO public.ai_credit_transactions (
    user_id, amount, balance_after, transaction_type, metadata
  ) VALUES (
    p_user_id, p_amount, v_new_balance, p_transaction_type, p_metadata
  );

  RETURN v_new_balance;
END;
$$;

-- 5. Log the migration
INSERT INTO public.ai_credit_transactions (user_id, amount, balance_after, transaction_type, metadata)
SELECT
  user_id,
  0,
  credits_balance,
  'system_migration',
  '{"migration": "fixed_credits_to_token_credits", "multiplier": 1000}'::jsonb
FROM public.ai_wallets;

-- Done! Now deploy all edge functions:
--   npx supabase functions deploy sector-ai-chat --no-verify-jwt
--   npx supabase functions deploy report-ai-chat --no-verify-jwt
--   npx supabase functions deploy create-razorpay-link --no-verify-jwt
--   npx supabase functions deploy razorpay-webhook --no-verify-jwt
