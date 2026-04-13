CREATE TABLE IF NOT EXISTS public.sebi_compliance_vault (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    original_user_id UUID NOT NULL,
    email TEXT,
    kyc_data JSONB,
    financial_data JSONB,
    app_data JSONB,
    deleted_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    retention_until TIMESTAMPTZ DEFAULT (now() + INTERVAL '5 years') NOT NULL,
    notes TEXT DEFAULT 'Auto-archived during account deletion for DPDP / SEBI compliance'
);

-- Enable RLS so it cannot be accessed from client sides.
ALTER TABLE public.sebi_compliance_vault ENABLE ROW LEVEL SECURITY;

-- No policies means it is strictly locked down or we can explicitly allow service role.
-- (Supabase service role bypasses RLS).
