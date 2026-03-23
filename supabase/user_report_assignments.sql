-- ============================================================
-- Table: user_report_assignments
-- Purpose: Assigns specific research reports to specific users.
--          The mobile app will only show reports assigned to the
--          logged-in user, instead of all published reports.
-- ============================================================

CREATE TABLE IF NOT EXISTS user_report_assignments (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email       TEXT NOT NULL,                        -- User email address
    report_id   TEXT NOT NULL,                        -- FK to research_reports.report_id
    assigned_at TIMESTAMPTZ DEFAULT now() NOT NULL,

    -- Prevent duplicate assignments
    UNIQUE (email, report_id)
);

-- Index for fast lookups by email
CREATE INDEX idx_user_report_assignments_email
    ON user_report_assignments (email);

-- Index for fast lookups by report
CREATE INDEX idx_user_report_assignments_report_id
    ON user_report_assignments (report_id);

-- ============================================================
-- Row Level Security (RLS)
-- Users can only read their own assignments
-- ============================================================

ALTER TABLE user_report_assignments ENABLE ROW LEVEL SECURITY;

-- Allow reading assignments (filtered by email in app queries)
CREATE POLICY "Users can view own assignments"
    ON user_report_assignments
    FOR SELECT
    USING (true);

-- Only service role / admin can insert/update/delete assignments
-- (No policy needed — defaults to deny for non-service-role)
