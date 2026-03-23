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
-- ============================================================

ALTER TABLE user_report_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own assignments"
    ON user_report_assignments
    FOR SELECT
    USING (true);

-- ============================================================
-- Add plan column to research_reports
-- Each report belongs to a plan so only matching subscribers get it
-- ============================================================

ALTER TABLE research_reports
    ADD COLUMN IF NOT EXISTS plan TEXT
    CHECK (plan IN ('midcap_wealth', 'smallcap_alpha', 'sme_emerging'));

-- ============================================================
-- DB Trigger: Auto-assign report to all active subscribers
-- when a report is published (is_published set to TRUE)
-- ============================================================

CREATE OR REPLACE FUNCTION auto_assign_report_on_publish()
RETURNS TRIGGER AS $$
BEGIN
    -- Only run when is_published changes from false/null to true
    IF NEW.is_published = true AND (OLD.is_published IS NULL OR OLD.is_published = false) THEN
        -- Assign to subscribers whose plan matches the report's plan
        -- all_in_growth users get ALL reports
        INSERT INTO user_report_assignments (email, report_id)
        SELECT p.email, NEW.report_id::text
        FROM profiles p
        JOIN subscriptions s ON s.user_id = p.user_id
        WHERE s.is_active = true
          AND p.email IS NOT NULL
          AND (s.plan = NEW.plan OR s.plan = 'all_in_growth')
        ON CONFLICT (email, report_id) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_auto_assign_report_on_publish
    AFTER UPDATE ON research_reports
    FOR EACH ROW
    EXECUTE FUNCTION auto_assign_report_on_publish();

-- Also trigger on INSERT (if report is inserted already published)
CREATE TRIGGER trg_auto_assign_report_on_insert
    AFTER INSERT ON research_reports
    FOR EACH ROW
    WHEN (NEW.is_published = true)
    EXECUTE FUNCTION auto_assign_report_on_publish();
