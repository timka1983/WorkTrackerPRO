-- ==========================================
-- OPTIMIZE DATABASE FOR 1000+ ORGANIZATIONS
-- Run this script in the Supabase SQL Editor
-- ==========================================

-- Add indexes to organization_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_org_id ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_work_logs_org_id ON work_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_machines_org_id ON machines(organization_id);
CREATE INDEX IF NOT EXISTS idx_active_shifts_org_id ON active_shifts(organization_id);
CREATE INDEX IF NOT EXISTS idx_payroll_snapshots_org_id ON payroll_snapshots(organization_id);
CREATE INDEX IF NOT EXISTS idx_payroll_payments_org_id ON payroll_payments(organization_id);
CREATE INDEX IF NOT EXISTS idx_payroll_periods_org_id ON payroll_periods(organization_id);
CREATE INDEX IF NOT EXISTS idx_branches_org_id ON branches(organization_id);

-- Add indexes for date/time filtering in work_logs
CREATE INDEX IF NOT EXISTS idx_work_logs_date ON work_logs(date);
CREATE INDEX IF NOT EXISTS idx_work_logs_user_date ON work_logs(user_id, date);

-- Add index for active shifts user lookups
CREATE INDEX IF NOT EXISTS idx_active_shifts_user_id ON active_shifts(user_id);
