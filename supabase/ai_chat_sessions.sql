-- ═══════════════════════════════════════════════════════════════════
-- AI Chat Sessions — Stores full conversation logs from AI Chat
-- ═══════════════════════════════════════════════════════════════════
--
-- Each row = one chat session (one open → close of the AI Chat modal).
-- Messages are stored as a JSONB array inside the session row,
-- so there's no separate messages table to join — simple and fast.
--
-- Run this in Supabase SQL Editor (Dashboard → SQL → New Query).
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.ai_chat_sessions (
  id            uuid        not null default gen_random_uuid(),
  user_id       text        not null,              -- Clerk user ID
  report_id     text        not null,              -- research_reports.report_id
  company_name  text        not null,              -- denormalized for quick querying
  nse_symbol    text        not null,              -- denormalized for quick querying
  messages      jsonb       not null default '[]', -- array of { role, text, timestamp, input_mode? }
  message_count integer     not null default 0,    -- quick count without parsing JSONB
  started_at    timestamp with time zone not null default now(),
  ended_at      timestamp with time zone,          -- set when session closes
  created_at    timestamp with time zone not null default now(),
  updated_at    timestamp with time zone not null default now(),

  constraint ai_chat_sessions_pkey primary key (id)
) tablespace pg_default;

-- Indexes for common queries
create index if not exists idx_ai_chat_sessions_user_id
  on public.ai_chat_sessions using btree (user_id) tablespace pg_default;

create index if not exists idx_ai_chat_sessions_report_id
  on public.ai_chat_sessions using btree (report_id) tablespace pg_default;

create index if not exists idx_ai_chat_sessions_created_at
  on public.ai_chat_sessions using btree (created_at desc) tablespace pg_default;

-- Auto-update updated_at on every row change
-- (Assumes the trigger function already exists from subscriptions table; if not, uncomment below)
-- create or replace function update_updated_at_column()
-- returns trigger as $$
-- begin
--   new.updated_at = now();
--   return new;
-- end;
-- $$ language plpgsql;

create trigger set_ai_chat_sessions_updated_at
  before update on public.ai_chat_sessions
  for each row
  execute function update_updated_at_column();

-- Provide access to the Supabase roles (crucial if your database defaults restrict access)
grant all on table public.ai_chat_sessions to anon;
grant all on table public.ai_chat_sessions to authenticated;
grant all on table public.ai_chat_sessions to service_role;
