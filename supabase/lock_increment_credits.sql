-- ═══════════════════════════════════════════════════════════════════
-- Lock down increment_ai_credits so ONLY service_role can call it.
-- This prevents any client/authenticated user from granting themselves
-- free credits by calling supabase.rpc('increment_ai_credits', ...).
--
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ═══════════════════════════════════════════════════════════════════

-- 1. Revoke execute from public (covers anon + authenticated)
REVOKE EXECUTE ON FUNCTION public.increment_ai_credits(text, integer, text, jsonb)
  FROM public, anon, authenticated;

-- 2. Grant execute ONLY to service_role (used by edge functions / webhooks)
GRANT EXECUTE ON FUNCTION public.increment_ai_credits(text, integer, text, jsonb)
  TO service_role;

-- ═══════════════════════════════════════════════════════════════════
-- Verify: After running this, try from the client:
--   const { data, error } = await supabase.rpc('increment_ai_credits', {
--     p_user_id: 'test', p_amount: 100
--   });
-- It should return: "permission denied for function increment_ai_credits"
-- ═══════════════════════════════════════════════════════════════════
