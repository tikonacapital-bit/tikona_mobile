-- ═══════════════════════════════════════════════════════════════════
-- AI Wallet & Credits System
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════

-- 1. Create AI Wallets Table
create table if not exists public.ai_wallets (
  id uuid not null default gen_random_uuid(),
  user_id text not null,
  credits_balance integer not null default 50, -- 50 free credits on start
  lifetime_credits_used integer not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),

  constraint ai_wallets_pkey primary key (id),
  constraint ai_wallets_user_id_key unique (user_id)
) tablespace pg_default;

-- Auto-update updated_at
create trigger set_ai_wallets_updated_at
  before update on public.ai_wallets
  for each row
  execute function update_updated_at_column();

-- Enable RLS (Assuming RLS is enabled on your DB, if not, you can run `alter table ai_wallets enable row level security;`)
-- create policy "Users can view own wallet" on public.ai_wallets for select using (auth.uid()::text = user_id);

-- 2. Create AI Credit Transactions Ledger
create table if not exists public.ai_credit_transactions (
  id uuid not null default gen_random_uuid(),
  user_id text not null,
  amount integer not null,           -- +ve for credit, -ve for debit
  balance_after integer not null,    -- snapshot of balance
  transaction_type text not null,    -- 'sector_chat', 'report_chat', 'top_up', 'signup'
  metadata jsonb default '{}'::jsonb, -- { "sector": "Banking", "session_id": "..." }
  created_at timestamp with time zone not null default now(),

  constraint ai_credit_transactions_pkey primary key (id)
) tablespace pg_default;

create index if not exists idx_ai_credit_transactions_user_id
  on public.ai_credit_transactions using btree (user_id) tablespace pg_default;

-- Enable RLS
-- create policy "Users can view own transactions" on public.ai_credit_transactions for select using (auth.uid()::text = user_id);


-- 3. Modify AI Chat Sessions for Sector AI support
alter table public.ai_chat_sessions add column if not exists chat_type text not null default 'report';
alter table public.ai_chat_sessions alter column report_id drop not null;

-- Grant permissions (if needed)
grant all on table public.ai_wallets to anon;
grant all on table public.ai_wallets to authenticated;
grant all on table public.ai_wallets to service_role;

grant all on table public.ai_credit_transactions to anon;
grant all on table public.ai_credit_transactions to authenticated;
grant all on table public.ai_credit_transactions to service_role;

-- 4. RPC for Atomic Credit Deduction
create or replace function public.deduct_ai_credits(
  p_user_id text,
  p_amount integer,
  p_transaction_type text,
  p_metadata jsonb default '{}'::jsonb
) returns integer
language plpgsql
security definer -- runs as db owner to bypass RLS for this specific atomic op
as $$
declare
  v_current_balance integer;
  v_new_balance integer;
begin
  -- 1. Ensure wallet exists
  insert into public.ai_wallets (user_id, credits_balance)
  values (p_user_id, 50)
  on conflict (user_id) do nothing;

  -- 2. Lock the row for update and get balance
  select credits_balance into v_current_balance
  from public.ai_wallets
  where user_id = p_user_id
  for update;

  if v_current_balance < p_amount then
    raise exception 'Insufficient AI credits';
  end if;

  -- 3. Calculate new balance
  v_new_balance := v_current_balance - p_amount;

  -- 4. Update wallet
  update public.ai_wallets
  set 
    credits_balance = v_new_balance,
    lifetime_credits_used = lifetime_credits_used + p_amount,
    updated_at = now()
  where user_id = p_user_id;

  -- 5. Insert ledger entry
  insert into public.ai_credit_transactions (
    user_id, amount, balance_after, transaction_type, metadata
  ) values (
    p_user_id, -p_amount, v_new_balance, p_transaction_type, p_metadata
  );

  return v_new_balance;
end;
$$;

-- 5. RPC for Adding Credits (Testing / Top-ups)
create or replace function public.increment_ai_credits(
  p_user_id text,
  p_amount integer,
  p_transaction_type text default 'top_up',
  p_metadata jsonb default '{}'::jsonb
) returns integer
language plpgsql
security definer
as $$
declare
  v_current_balance integer;
  v_new_balance integer;
begin
  -- 1. Ensure wallet exists
  insert into public.ai_wallets (user_id, credits_balance)
  values (p_user_id, 50)
  on conflict (user_id) do nothing;

  -- 2. Lock the row for update and get balance
  select credits_balance into v_current_balance
  from public.ai_wallets
  where user_id = p_user_id
  for update;

  -- 3. Calculate new balance
  v_new_balance := v_current_balance + p_amount;

  -- 4. Update wallet
  update public.ai_wallets
  set 
    credits_balance = v_new_balance,
    updated_at = now()
  where user_id = p_user_id;

  -- 5. Insert ledger entry
  insert into public.ai_credit_transactions (
    user_id, amount, balance_after, transaction_type, metadata
  ) values (
    p_user_id, p_amount, v_new_balance, p_transaction_type, p_metadata
  );

  return v_new_balance;
end;
$$;

