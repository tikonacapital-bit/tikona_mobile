-- ═══════════════════════════════════════════════════════════════════
-- Add upi_id column to refund_requests
-- Stores the user's UPI ID to enable 1-click refund payments for the admin
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.refund_requests
ADD COLUMN IF NOT EXISTS upi_id TEXT;
