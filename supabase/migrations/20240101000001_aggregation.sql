-- 1. View for Monthly Report
CREATE OR REPLACE VIEW monthly_report_view AS
SELECT
    u.id AS user_id,
    u.name AS user_name,
    u.organization_id,
    to_char(wl.date::date, 'YYYY-MM') AS month,
    COUNT(wl.id) FILTER (WHERE wl.entry_type = 'WORK') AS work_days,
    COALESCE(SUM(wl.duration_minutes) FILTER (WHERE wl.entry_type = 'WORK'), 0) AS total_minutes,
    COUNT(wl.id) FILTER (WHERE wl.entry_type = 'SICK') AS sick_days,
    COUNT(wl.id) FILTER (WHERE wl.entry_type = 'VACATION') AS vacation_days
FROM users u
LEFT JOIN work_logs wl ON u.id = wl.user_id
GROUP BY u.id, u.name, u.organization_id, to_char(wl.date::date, 'YYYY-MM');

-- 2. RPC function to get monthly report
CREATE OR REPLACE FUNCTION get_monthly_report(
    p_org_id TEXT,
    p_month TEXT
)
RETURNS TABLE (
    user_id TEXT,
    user_name TEXT,
    work_days BIGINT,
    total_minutes BIGINT,
    sick_days BIGINT,
    vacation_days BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        mrv.user_id,
        mrv.user_name,
        mrv.work_days,
        mrv.total_minutes,
        mrv.sick_days,
        mrv.vacation_days
    FROM monthly_report_view mrv
    WHERE mrv.organization_id = p_org_id AND mrv.month = p_month;
END;
$$;

-- 3. RPC function to get user stats
CREATE OR REPLACE FUNCTION get_user_stats(
    p_user_id TEXT,
    p_month TEXT
)
RETURNS TABLE (
    total_work_minutes BIGINT,
    shifts_count BIGINT,
    avg_shift_minutes NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(SUM(duration_minutes), 0) as total_work_minutes,
        COUNT(id) as shifts_count,
        COALESCE(AVG(duration_minutes), 0) as avg_shift_minutes
    FROM work_logs
    WHERE user_id = p_user_id 
      AND to_char(date::date, 'YYYY-MM') = p_month
      AND entry_type = 'WORK';
END;
$$;
