-- ═══════════════════════════════════════════════════════════════════
-- Fix: Add 'sme_emerging' to the subscriptions plan check constraint
-- The webhook sends sme_emerging for ₹35,999 and test amounts,
-- but the DB constraint only allowed 3 plans. This adds the 4th.
-- ═══════════════════════════════════════════════════════════════════

-- Step 1: Drop the old check constraint
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_check;

-- Step 2: Add the updated check constraint with all 4 plans
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_plan_check CHECK (
  plan = ANY (
    ARRAY[
      'midcap_wealth'::text,
      'smallcap_alpha'::text,
      'sme_emerging'::text,
      'all_in_growth'::text
    ]
  )
);
