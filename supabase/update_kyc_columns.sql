-- 1. Add missing columns to the KYC table
ALTER TABLE public.kyc 
  ADD COLUMN IF NOT EXISTS tradebox_reference_id TEXT,
  ADD COLUMN IF NOT EXISTS razorpay_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS kyc_initiated_at TIMESTAMP WITH TIME ZONE;

-- 2. Important: After running this, reload your schema cache via the Supabase Dashboard!
-- Go to Settings -> API -> "Reload Schema Cache" button.
