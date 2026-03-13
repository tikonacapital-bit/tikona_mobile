-- ═══════════════════════════════════════════════════════════════════
-- Tikona Capital — Full Refund System Database Migration
-- Run this entire file in your Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════

-- 1. Ensure subscriptions table has amount_paid column
ALTER TABLE public.subscriptions
ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(10,2);

-- 2. Drop the old refund_requests table (since we added new columns)
DROP TABLE IF EXISTS public.refund_requests CASCADE;

-- 3. Create the new refund_requests table with UPI ID support
CREATE TABLE public.refund_requests (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    subscription_id UUID NOT NULL REFERENCES public.subscriptions(id),
    plan TEXT NOT NULL,
    
    -- Financial breakdown
    total_paid NUMERIC(10,2) NOT NULL,
    months_used INTEGER NOT NULL,
    months_remaining INTEGER NOT NULL,
    refund_amount NUMERIC(10,2) NOT NULL,
    
    -- Status workflow: pending → approved/rejected → processed
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected', 'processed')),
        
    -- User fields
    upi_id TEXT NOT NULL,                      -- User's UPI ID for 1-click payment
    reason TEXT,                               -- User's optional reason
    
    -- Admin fields
    admin_notes TEXT,                          -- Admin notes on decision
    reviewed_by TEXT,                          -- Admin email who reviewed
    reviewed_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    
    CONSTRAINT refund_requests_pkey PRIMARY KEY (id)
) TABLESPACE pg_default;

-- 4. Create indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_refund_requests_user_id
    ON public.refund_requests USING btree (user_id) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_refund_requests_status
    ON public.refund_requests USING btree (status) TABLESPACE pg_default;

-- 5. Auto-update updated_at on row changes
DROP TRIGGER IF EXISTS set_refund_requests_updated_at ON public.refund_requests;
CREATE TRIGGER set_refund_requests_updated_at
    BEFORE UPDATE ON public.refund_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 6. Reactivate all subscriptions (so you can test requesting a new refund)
UPDATE public.subscriptions SET is_active = true;
