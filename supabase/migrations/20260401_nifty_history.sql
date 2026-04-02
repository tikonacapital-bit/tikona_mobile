-- Nifty 50 historical closing prices
-- Populated by scripts/seed_nifty.py (run once to backfill, then update daily)

create table if not exists nifty_history (
    date        date primary key,
    close       numeric(10, 2) not null
);

-- Allow anyone to read (anon key) — these are public market prices
alter table nifty_history enable row level security;

create policy "public read nifty_history"
    on nifty_history for select
    using (true);
