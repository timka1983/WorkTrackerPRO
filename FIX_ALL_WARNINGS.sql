-- ==========================================
-- FIX ALL SUPABASE LINTER WARNINGS
-- Run this script in the Supabase SQL Editor
-- ==========================================

-- ==========================================
-- PART 1: FIX FUNCTION SEARCH PATHS
-- Detects functions where the search_path parameter is not set.
-- ==========================================
DO $$
DECLARE
    func_record RECORD;
BEGIN
    FOR func_record IN SELECT oid::regprocedure AS func_sig FROM pg_proc WHERE proname IN (
        'get_dashboard_stats',
        'check_machine_limit',
        'get_user_counts_by_org',
        'enforce_limit',
        'check_user_limit',
        'get_monthly_report',
        'get_user_stats'
    ) LOOP
        EXECUTE 'ALTER FUNCTION ' || func_record.func_sig || ' SET search_path = public';
    END LOOP;
END $$;


-- ==========================================
-- PART 2: FIX RLS POLICIES (Remove USING true)
-- Detects RLS policies that use overly permissive expressions.
-- ==========================================

-- 1. USERS
DROP POLICY IF EXISTS "Allow public insert" ON users;
CREATE POLICY "Allow users to insert their profile" ON users FOR INSERT WITH CHECK (auth.uid()::text = id);

DROP POLICY IF EXISTS "Allow public update" ON users;
CREATE POLICY "Allow users to update their profile" ON users FOR UPDATE USING (auth.uid()::text = id);

DROP POLICY IF EXISTS "Allow public delete" ON users;
CREATE POLICY "Allow users to delete their profile" ON users FOR DELETE USING (auth.uid()::text = id);


-- 2. WORK_LOGS
DROP POLICY IF EXISTS "Allow public insert" ON work_logs;
CREATE POLICY "Allow users to insert their logs" ON work_logs FOR INSERT WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Allow public update" ON work_logs;
CREATE POLICY "Allow users to update their logs" ON work_logs FOR UPDATE USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Allow public delete" ON work_logs;
CREATE POLICY "Allow users to delete their logs" ON work_logs FOR DELETE USING (auth.uid()::text = user_id);


-- 3. ACTIVE_SHIFTS
DROP POLICY IF EXISTS "Allow public insert" ON active_shifts;
CREATE POLICY "Allow users to insert their shifts" ON active_shifts FOR INSERT WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Allow public update" ON active_shifts;
CREATE POLICY "Allow users to update their shifts" ON active_shifts FOR UPDATE USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Allow public delete" ON active_shifts;
CREATE POLICY "Allow users to delete their shifts" ON active_shifts FOR DELETE USING (auth.uid()::text = user_id);


-- 4. ORGANIZATIONS
DROP POLICY IF EXISTS "Allow public insert" ON organizations;
CREATE POLICY "Allow owners to insert orgs" ON organizations FOR INSERT WITH CHECK (auth.uid()::text = owner_id);

DROP POLICY IF EXISTS "Allow public update" ON organizations;
CREATE POLICY "Allow owners to update orgs" ON organizations FOR UPDATE USING (auth.uid()::text = owner_id);

DROP POLICY IF EXISTS "Allow public delete" ON organizations;


-- 5. BRANCHES
DROP POLICY IF EXISTS "Allow public insert" ON branches;
CREATE POLICY "Allow org users to insert branches" ON branches FOR INSERT WITH CHECK (
  organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()::text)
);

DROP POLICY IF EXISTS "Allow public update" ON branches;
CREATE POLICY "Allow org users to update branches" ON branches FOR UPDATE USING (
  organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()::text)
);

DROP POLICY IF EXISTS "Allow public delete" ON branches;
CREATE POLICY "Allow org users to delete branches" ON branches FOR DELETE USING (
  organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()::text)
);


-- 6. POSITIONS
DROP POLICY IF EXISTS "Allow public insert" ON positions;
CREATE POLICY "Allow org users to insert positions" ON positions FOR INSERT WITH CHECK (
  organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()::text)
);

DROP POLICY IF EXISTS "Allow public update" ON positions;
CREATE POLICY "Allow org users to update positions" ON positions FOR UPDATE USING (
  organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()::text)
);

DROP POLICY IF EXISTS "Allow public delete" ON positions;
CREATE POLICY "Allow org users to delete positions" ON positions FOR DELETE USING (
  organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()::text)
);


-- 7. MACHINES
DROP POLICY IF EXISTS "Allow public insert" ON machines;
CREATE POLICY "Allow org users to insert machines" ON machines FOR INSERT WITH CHECK (
  organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()::text)
);

DROP POLICY IF EXISTS "Allow public update" ON machines;
CREATE POLICY "Allow org users to update machines" ON machines FOR UPDATE USING (
  organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()::text)
);

DROP POLICY IF EXISTS "Allow public delete" ON machines;
CREATE POLICY "Allow org users to delete machines" ON machines FOR DELETE USING (
  organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()::text)
);


-- 8. PAYROLL_PAYMENTS
DROP POLICY IF EXISTS "Allow public insert" ON payroll_payments;
CREATE POLICY "Allow org users to insert payroll_payments" ON payroll_payments FOR INSERT WITH CHECK (
  organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()::text)
);

DROP POLICY IF EXISTS "Allow public update" ON payroll_payments;
CREATE POLICY "Allow org users to update payroll_payments" ON payroll_payments FOR UPDATE USING (
  organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()::text)
);

DROP POLICY IF EXISTS "Allow public delete" ON payroll_payments;
CREATE POLICY "Allow org users to delete payroll_payments" ON payroll_payments FOR DELETE USING (
  organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()::text)
);


-- 9. PAYROLL_SNAPSHOTS
DROP POLICY IF EXISTS "Allow public insert" ON payroll_snapshots;
CREATE POLICY "Allow org users to insert payroll_snapshots" ON payroll_snapshots FOR INSERT WITH CHECK (
  organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()::text)
);

DROP POLICY IF EXISTS "Allow public update" ON payroll_snapshots;
CREATE POLICY "Allow org users to update payroll_snapshots" ON payroll_snapshots FOR UPDATE USING (
  organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()::text)
);

DROP POLICY IF EXISTS "Allow public delete" ON payroll_snapshots;
CREATE POLICY "Allow org users to delete payroll_snapshots" ON payroll_snapshots FOR DELETE USING (
  organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()::text)
);


-- 10. PAYROLL_PERIODS
DROP POLICY IF EXISTS "Allow public insert" ON payroll_periods;
CREATE POLICY "Allow org users to insert payroll_periods" ON payroll_periods FOR INSERT WITH CHECK (
  organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()::text)
);

DROP POLICY IF EXISTS "Allow public update" ON payroll_periods;
CREATE POLICY "Allow org users to update payroll_periods" ON payroll_periods FOR UPDATE USING (
  organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()::text)
);

DROP POLICY IF EXISTS "Allow public delete" ON payroll_periods;
CREATE POLICY "Allow org users to delete payroll_periods" ON payroll_periods FOR DELETE USING (
  organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()::text)
);


-- 11. PLANS (Global table)
DROP POLICY IF EXISTS "Allow public insert" ON plans;
CREATE POLICY "Allow authenticated users to insert plans" ON plans FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Allow public update" ON plans;
CREATE POLICY "Allow authenticated users to update plans" ON plans FOR UPDATE USING (auth.uid() IS NOT NULL);


-- 12. PROMO_CODES (Global table)
DROP POLICY IF EXISTS "Allow public insert" ON promo_codes;
CREATE POLICY "Allow authenticated users to insert promo_codes" ON promo_codes FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Allow public update" ON promo_codes;
CREATE POLICY "Allow authenticated users to update promo_codes" ON promo_codes FOR UPDATE USING (auth.uid() IS NOT NULL);


-- 13. SYSTEM_CONFIG (Global table)
DROP POLICY IF EXISTS "Allow public insert" ON system_config;
CREATE POLICY "Allow authenticated users to insert system_config" ON system_config FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Allow public update" ON system_config;
CREATE POLICY "Allow authenticated users to update system_config" ON system_config FOR UPDATE USING (auth.uid() IS NOT NULL);
