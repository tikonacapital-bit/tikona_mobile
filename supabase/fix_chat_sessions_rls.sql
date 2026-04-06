-- ═══════════════════════════════════════════════════════════════════
-- Fix RLS for ai_chat_sessions
--
-- The table has RLS enabled but NO policies, which means all
-- authenticated inserts/updates/deletes are blocked.
-- This adds proper user-scoped policies using Clerk JWT 'sub' claim
-- (matching the pattern used across all other tables).
--
-- Run this in Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════════

-- 1. Ensure RLS is enabled
ALTER TABLE public.ai_chat_sessions ENABLE ROW LEVEL SECURITY;

-- 2. Drop any stale policies (safe to run even if they don't exist)
DROP POLICY IF EXISTS "Users can view own chat sessions" ON public.ai_chat_sessions;
DROP POLICY IF EXISTS "Users can insert own chat sessions" ON public.ai_chat_sessions;
DROP POLICY IF EXISTS "Users can update own chat sessions" ON public.ai_chat_sessions;
DROP POLICY IF EXISTS "Users can delete own chat sessions" ON public.ai_chat_sessions;

-- 3. Create proper RLS policies (using Clerk JWT sub claim)
-- Users can only SELECT their own sessions
CREATE POLICY "Users can view own chat sessions"
  ON public.ai_chat_sessions FOR SELECT
  USING (user_id = (auth.jwt() ->> 'sub'));

-- Users can only INSERT sessions for themselves
CREATE POLICY "Users can insert own chat sessions"
  ON public.ai_chat_sessions FOR INSERT
  WITH CHECK (user_id = (auth.jwt() ->> 'sub'));

-- Users can only UPDATE their own sessions
CREATE POLICY "Users can update own chat sessions"
  ON public.ai_chat_sessions FOR UPDATE
  USING (user_id = (auth.jwt() ->> 'sub'));

-- Users can only DELETE their own sessions
CREATE POLICY "Users can delete own chat sessions"
  ON public.ai_chat_sessions FOR DELETE
  USING (user_id = (auth.jwt() ->> 'sub'));
