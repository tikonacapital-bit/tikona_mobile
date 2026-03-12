-- ═══════════════════════════════════════════════════════════════════
-- Webhook Logs table — audit trail for incoming Tradebox webhooks
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.webhook_logs (
  id uuid not null default gen_random_uuid(),
  source text not null default 'tradebox',
  event text not null,
  payload jsonb not null default '{}'::jsonb,
  user_id text null,
  processed boolean not null default false,
  error_message text null,
  created_at timestamp with time zone not null default now(),
  constraint webhook_logs_pkey primary key (id)
) tablespace pg_default;

-- Index for querying by source + event
create index if not exists idx_webhook_logs_source_event
  on public.webhook_logs using btree (source, event) tablespace pg_default;

-- Index for querying by user_id
create index if not exists idx_webhook_logs_user_id
  on public.webhook_logs using btree (user_id) tablespace pg_default;

-- Auto-cleanup: keep only last 90 days (optional — run as cron)
-- delete from public.webhook_logs where created_at < now() - interval '90 days';
