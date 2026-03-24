-- ═══════════════════════════════════════════════════════════════════
-- Subscriptions table (updated for new plan structure)
-- Plans: midcap_wealth, smallcap_alpha, all_in_growth
-- ═══════════════════════════════════════════════════════════════════

create table public.subscriptions (
  id uuid not null default gen_random_uuid(),
  user_id text not null,
  plan text not null,
  is_active boolean not null default true,
  started_at timestamp with time zone not null default now(),
  expires_at timestamp with time zone null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint subscriptions_pkey primary key (id),
  constraint subscriptions_user_id_key unique (user_id),
  constraint subscriptions_plan_check check (
    plan = any (
      array[
        'midcap_wealth'::text,
        'smallcap_alpha'::text,
        'sme_emerging'::text,
        'all_in_growth'::text,
        'free'::text
      ]
    )
  )
) tablespace pg_default;

create index if not exists idx_subscriptions_user_id
  on public.subscriptions using btree (user_id) tablespace pg_default;

create trigger set_subscriptions_updated_at
  before update on subscriptions
  for each row
  execute function update_updated_at_column();


-- ═══════════════════════════════════════════════════════════════════
-- MIGRATION: If the table already exists, run this instead
-- ═══════════════════════════════════════════════════════════════════

-- 1. Drop old check constraint
-- alter table public.subscriptions drop constraint subscriptions_plan_check;

-- 2. Add new check constraint with updated plans
-- alter table public.subscriptions add constraint subscriptions_plan_check check (
--   plan = any (
--     array[
--       'midcap_wealth'::text,
--       'smallcap_alpha'::text,
--       'sme_emerging'::text,
--       'all_in_growth'::text,
--       'free'::text
--     ]
--   )
-- );

-- 3. Remove razorpay_payment_id column
-- alter table public.subscriptions drop column if exists razorpay_payment_id;

-- 4. Remove default 'free' from plan column
-- alter table public.subscriptions alter column plan drop default;
