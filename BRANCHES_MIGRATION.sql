-- SQL MIGRATION FOR MULTI-BRANCH SYSTEM [SAAS-007]
-- Run this in Supabase SQL Editor

-- 1. Create 'branches' table
CREATE TABLE IF NOT EXISTS branches (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    name TEXT NOT NULL,
    address TEXT,
    location_settings JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add 'branch_id' column to existing tables
ALTER TABLE users ADD COLUMN IF NOT EXISTS branch_id TEXT;
ALTER TABLE machines ADD COLUMN IF NOT EXISTS branch_id TEXT;
ALTER TABLE work_logs ADD COLUMN IF NOT EXISTS branch_id TEXT;

-- 3. Enable RLS on 'branches'
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS Policies for 'branches' (following the public access pattern used in this app)
DROP POLICY IF EXISTS "Allow public read" ON branches;
CREATE POLICY "Allow public read" ON branches FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert" ON branches;
CREATE POLICY "Allow public insert" ON branches FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update" ON branches;
CREATE POLICY "Allow public update" ON branches FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow public delete" ON branches;
CREATE POLICY "Allow public delete" ON branches FOR DELETE USING (true);

-- 5. Enable Realtime for 'branches'
BEGIN;
  -- Remove if exists to avoid errors
  ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS branches;
  -- Add back
  ALTER PUBLICATION supabase_realtime ADD TABLE branches;
COMMIT;
