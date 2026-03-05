
-- Try to insert a log for Anna Sidorova (user_id = '2')
INSERT INTO work_logs (
  id, 
  user_id, 
  organization_id, 
  date, 
  entry_type, 
  check_in, 
  duration_minutes
) VALUES (
  'test-log-manual-1', 
  '2', 
  'default_org', 
  '2026-03-05', 
  'WORK', 
  NOW(), 
  0
) RETURNING *;
