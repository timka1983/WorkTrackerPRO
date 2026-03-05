-- SQL SCRIPT TO FIX RLS POLICIES FOR ALL TABLES (FIXED SYNTAX)
-- Run this in Supabase SQL Editor

-- 1. Fix 'users' table policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read" ON users;
CREATE POLICY "Allow public read" ON users FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert" ON users;
CREATE POLICY "Allow public insert" ON users FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public update" ON users;
CREATE POLICY "Allow public update" ON users FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow public delete" ON users;
CREATE POLICY "Allow public delete" ON users FOR DELETE USING (true);

-- 2. Fix 'work_logs' table policies
ALTER TABLE work_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read" ON work_logs;
CREATE POLICY "Allow public read" ON work_logs FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert" ON work_logs;
CREATE POLICY "Allow public insert" ON work_logs FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public update" ON work_logs;
CREATE POLICY "Allow public update" ON work_logs FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow public delete" ON work_logs;
CREATE POLICY "Allow public delete" ON work_logs FOR DELETE USING (true);

-- 3. Fix 'active_shifts' table policies
ALTER TABLE active_shifts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public access" ON active_shifts;
DROP POLICY IF EXISTS "Allow public read" ON active_shifts;
CREATE POLICY "Allow public read" ON active_shifts FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert" ON active_shifts;
CREATE POLICY "Allow public insert" ON active_shifts FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public update" ON active_shifts;
CREATE POLICY "Allow public update" ON active_shifts FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow public delete" ON active_shifts;
CREATE POLICY "Allow public delete" ON active_shifts FOR DELETE USING (true);

-- 4. Enable Realtime for these tables (PostgreSQL 14+ syntax)
DO $$
BEGIN
  -- We use dynamic SQL to safely add tables to publication if they aren't already there
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'users'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE users;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'work_logs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE work_logs;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'active_shifts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE active_shifts;
  END IF;
END $$;
