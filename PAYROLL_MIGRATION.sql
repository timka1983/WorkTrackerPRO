-- SQL MIGRATION FOR PAYROLL SYSTEM
-- Run this in Supabase SQL Editor

-- 1. Add 'payroll' column to 'users' table (stores personal financial settings)
ALTER TABLE users ADD COLUMN IF NOT EXISTS payroll JSONB;

-- 2. Add 'payroll' column to 'positions' table (stores default financial settings for a role)
ALTER TABLE positions ADD COLUMN IF NOT EXISTS payroll JSONB;

-- 3. Add 'fine' column to 'work_logs' table (stores manual fines for a shift)
ALTER TABLE work_logs ADD COLUMN IF NOT EXISTS fine INTEGER;

-- 4. Update existing positions with default payroll config (Optional but recommended)
-- This sets a default hourly rate structure if none exists
UPDATE positions 
SET payroll = '{"type": "hourly", "rate": 0, "overtimeMultiplier": 1.5, "nightShiftBonus": 0}'::jsonb 
WHERE payroll IS NULL;
