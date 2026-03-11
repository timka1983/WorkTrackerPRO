-- SQL SCRIPT TO FIX DUPLICATES AND VIEW
-- Run this in Supabase SQL Editor

-- 1. Remove duplicates from 'positions' table using system column ctid
DELETE FROM positions a USING positions b
WHERE a.ctid < b.ctid 
  AND a.organization_id = b.organization_id 
  AND a.name = b.name;

-- 2. Add Primary Key to 'positions' to prevent future duplicates
-- If this fails, it means duplicates still exist or PK already exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'positions'::regclass
          AND contype = 'p'
    ) THEN
        ALTER TABLE positions ADD PRIMARY KEY (organization_id, name);
    END IF;
END $$;

-- 3. Remove duplicates from 'active_shifts' table
DELETE FROM active_shifts a USING active_shifts b
WHERE a.ctid < b.ctid 
  AND a.user_id = b.user_id;

-- 4. Add Unique Constraint to 'active_shifts'
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'unique_active_shift_per_user'
    ) THEN
        ALTER TABLE active_shifts ADD CONSTRAINT unique_active_shift_per_user UNIQUE (user_id);
    END IF;
END $$;

-- 5. Recreate 'monthly_report_view' with correct definition
DROP VIEW IF EXISTS monthly_report_view;

CREATE OR REPLACE VIEW monthly_report_view WITH (security_invoker = true) AS
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
