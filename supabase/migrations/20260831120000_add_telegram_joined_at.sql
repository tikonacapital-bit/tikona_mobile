-- Track whether a subscriber has already claimed their plan's Telegram group invite.
-- Prevents the "Join Telegram" button being reused from a different device/session
-- logged into the same account after the group has already been joined once.
--
-- No new RLS policy needed: "Users can update own subscription" (see
-- supabase/rls_policies.sql) already lets a user update any column on their
-- own row, keyed off the Clerk JWT's `sub` claim.

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS telegram_joined_at timestamptz;
