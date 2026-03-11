-- ==========================================
-- RESTORE PUBLIC POLICIES
-- Run this script in the Supabase SQL Editor
-- This script reverts the changes made by FIX_ALL_WARNINGS.sql
-- which broke the app because the app uses custom auth, not Supabase Auth.
-- ==========================================

-- 1. USERS
DROP POLICY IF EXISTS "Allow users to insert their profile" ON users;
DROP POLICY IF EXISTS "Allow users to update their profile" ON users;
DROP POLICY IF EXISTS "Allow users to delete their profile" ON users;
DROP POLICY IF EXISTS "Allow public insert" ON users;
CREATE POLICY "Allow public insert" ON users FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public update" ON users;
CREATE POLICY "Allow public update" ON users FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow public delete" ON users;
CREATE POLICY "Allow public delete" ON users FOR DELETE USING (true);

-- 2. WORK_LOGS
DROP POLICY IF EXISTS "Allow users to insert their logs" ON work_logs;
DROP POLICY IF EXISTS "Allow users to update their logs" ON work_logs;
DROP POLICY IF EXISTS "Allow users to delete their logs" ON work_logs;
DROP POLICY IF EXISTS "Allow public insert" ON work_logs;
CREATE POLICY "Allow public insert" ON work_logs FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public update" ON work_logs;
CREATE POLICY "Allow public update" ON work_logs FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow public delete" ON work_logs;
CREATE POLICY "Allow public delete" ON work_logs FOR DELETE USING (true);

-- 3. ACTIVE_SHIFTS
DROP POLICY IF EXISTS "Allow users to insert their shifts" ON active_shifts;
DROP POLICY IF EXISTS "Allow users to update their shifts" ON active_shifts;
DROP POLICY IF EXISTS "Allow users to delete their shifts" ON active_shifts;
DROP POLICY IF EXISTS "Allow public insert" ON active_shifts;
CREATE POLICY "Allow public insert" ON active_shifts FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public update" ON active_shifts;
CREATE POLICY "Allow public update" ON active_shifts FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow public delete" ON active_shifts;
CREATE POLICY "Allow public delete" ON active_shifts FOR DELETE USING (true);

-- 4. ORGANIZATIONS
DROP POLICY IF EXISTS "Allow owners to insert orgs" ON organizations;
DROP POLICY IF EXISTS "Allow owners to update orgs" ON organizations;
DROP POLICY IF EXISTS "Allow public insert" ON organizations;
CREATE POLICY "Allow public insert" ON organizations FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public update" ON organizations;
CREATE POLICY "Allow public update" ON organizations FOR UPDATE USING (true);

-- 5. BRANCHES
DROP POLICY IF EXISTS "Allow org users to insert branches" ON branches;
DROP POLICY IF EXISTS "Allow org users to update branches" ON branches;
DROP POLICY IF EXISTS "Allow org users to delete branches" ON branches;
DROP POLICY IF EXISTS "Allow public insert" ON branches;
CREATE POLICY "Allow public insert" ON branches FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public update" ON branches;
CREATE POLICY "Allow public update" ON branches FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow public delete" ON branches;
CREATE POLICY "Allow public delete" ON branches FOR DELETE USING (true);

-- 6. POSITIONS
DROP POLICY IF EXISTS "Allow org users to insert positions" ON positions;
DROP POLICY IF EXISTS "Allow org users to update positions" ON positions;
DROP POLICY IF EXISTS "Allow org users to delete positions" ON positions;
DROP POLICY IF EXISTS "Allow public insert" ON positions;
CREATE POLICY "Allow public insert" ON positions FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public update" ON positions;
CREATE POLICY "Allow public update" ON positions FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow public delete" ON positions;
CREATE POLICY "Allow public delete" ON positions FOR DELETE USING (true);

-- 7. MACHINES
DROP POLICY IF EXISTS "Allow org users to insert machines" ON machines;
DROP POLICY IF EXISTS "Allow org users to update machines" ON machines;
DROP POLICY IF EXISTS "Allow org users to delete machines" ON machines;
DROP POLICY IF EXISTS "Allow public insert" ON machines;
CREATE POLICY "Allow public insert" ON machines FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public update" ON machines;
CREATE POLICY "Allow public update" ON machines FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow public delete" ON machines;
CREATE POLICY "Allow public delete" ON machines FOR DELETE USING (true);

-- 8. PAYROLL_PAYMENTS
DROP POLICY IF EXISTS "Allow org users to insert payroll_payments" ON payroll_payments;
DROP POLICY IF EXISTS "Allow org users to update payroll_payments" ON payroll_payments;
DROP POLICY IF EXISTS "Allow org users to delete payroll_payments" ON payroll_payments;
DROP POLICY IF EXISTS "Allow public insert" ON payroll_payments;
CREATE POLICY "Allow public insert" ON payroll_payments FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public update" ON payroll_payments;
CREATE POLICY "Allow public update" ON payroll_payments FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow public delete" ON payroll_payments;
CREATE POLICY "Allow public delete" ON payroll_payments FOR DELETE USING (true);

-- 9. PAYROLL_SNAPSHOTS
DROP POLICY IF EXISTS "Allow org users to insert payroll_snapshots" ON payroll_snapshots;
DROP POLICY IF EXISTS "Allow org users to update payroll_snapshots" ON payroll_snapshots;
DROP POLICY IF EXISTS "Allow org users to delete payroll_snapshots" ON payroll_snapshots;
DROP POLICY IF EXISTS "Allow public insert" ON payroll_snapshots;
CREATE POLICY "Allow public insert" ON payroll_snapshots FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public update" ON payroll_snapshots;
CREATE POLICY "Allow public update" ON payroll_snapshots FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow public delete" ON payroll_snapshots;
CREATE POLICY "Allow public delete" ON payroll_snapshots FOR DELETE USING (true);

-- 10. PAYROLL_PERIODS
DROP POLICY IF EXISTS "Allow org users to insert payroll_periods" ON payroll_periods;
DROP POLICY IF EXISTS "Allow org users to update payroll_periods" ON payroll_periods;
DROP POLICY IF EXISTS "Allow org users to delete payroll_periods" ON payroll_periods;
DROP POLICY IF EXISTS "Allow public insert" ON payroll_periods;
CREATE POLICY "Allow public insert" ON payroll_periods FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public update" ON payroll_periods;
CREATE POLICY "Allow public update" ON payroll_periods FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow public delete" ON payroll_periods;
CREATE POLICY "Allow public delete" ON payroll_periods FOR DELETE USING (true);

-- 11. PLANS
DROP POLICY IF EXISTS "Allow authenticated users to insert plans" ON plans;
DROP POLICY IF EXISTS "Allow authenticated users to update plans" ON plans;
DROP POLICY IF EXISTS "Allow public insert" ON plans;
CREATE POLICY "Allow public insert" ON plans FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public update" ON plans;
CREATE POLICY "Allow public update" ON plans FOR UPDATE USING (true);

-- 12. PROMO_CODES
DROP POLICY IF EXISTS "Allow authenticated users to insert promo_codes" ON promo_codes;
DROP POLICY IF EXISTS "Allow authenticated users to update promo_codes" ON promo_codes;
DROP POLICY IF EXISTS "Allow public insert" ON promo_codes;
CREATE POLICY "Allow public insert" ON promo_codes FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public update" ON promo_codes;
CREATE POLICY "Allow public update" ON promo_codes FOR UPDATE USING (true);

-- 13. SYSTEM_CONFIG
DROP POLICY IF EXISTS "Allow authenticated users to insert system_config" ON system_config;
DROP POLICY IF EXISTS "Allow authenticated users to update system_config" ON system_config;
DROP POLICY IF EXISTS "Allow public insert" ON system_config;
CREATE POLICY "Allow public insert" ON system_config FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public update" ON system_config;
CREATE POLICY "Allow public update" ON system_config FOR UPDATE USING (true);
