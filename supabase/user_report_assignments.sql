-- ============================================================
-- Table: user_report_assignments
-- Purpose: Assigns specific research reports to specific users.
--          The mobile app will only show reports assigned to the
--          logged-in user, instead of all published reports.
-- ============================================================

CREATE TABLE IF NOT EXISTS user_report_assignments (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     TEXT NOT NULL,                        -- Clerk user ID
    report_id   TEXT NOT NULL,                        -- FK to research_reports.report_id
    assigned_at TIMESTAMPTZ DEFAULT now() NOT NULL,

    -- Prevent duplicate assignments
    UNIQUE (user_id, report_id)
);

-- Index for fast lookups by user
CREATE INDEX idx_user_report_assignments_user_id
    ON user_report_assignments (user_id);

-- Index for fast lookups by report
CREATE INDEX idx_user_report_assignments_report_id
    ON user_report_assignments (report_id);

-- ============================================================
-- Row Level Security (RLS)
-- Users can only read their own assignments
-- ============================================================

ALTER TABLE user_report_assignments ENABLE ROW LEVEL SECURITY;

-- Users can read only their own assigned reports
CREATE POLICY "Users can view own assignments"
    ON user_report_assignments
    FOR SELECT
    USING (user_id = auth.uid()::text);

-- Only service role / admin can insert/update/delete assignments
-- (No policy needed — defaults to deny for non-service-role)
