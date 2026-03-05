
BEGIN;

-- 1. Очищаем старые тестовые данные за сегодня для чистоты эксперимента
DELETE FROM active_shifts WHERE user_id = '2';
DELETE FROM work_logs WHERE user_id = '2' AND date = CURRENT_DATE;

-- 2. Создаем запись о начале смены в work_logs
INSERT INTO work_logs (id, user_id, organization_id, date, entry_type, check_in, duration_minutes)
VALUES (
  'sql-test-shift-1', 
  '2', 
  'default_org', 
  CURRENT_DATE, 
  'WORK', 
  NOW(), 
  0
);

-- 3. Создаем запись в active_shifts (чтобы сотрудник отображался как "В работе")
INSERT INTO active_shifts (user_id, organization_id, shifts_json)
VALUES (
  '2', 
  'default_org', 
  jsonb_build_object(
    '1', jsonb_build_object(
      'id', 'sql-test-shift-1',
      'userId', '2',
      'checkIn', NOW(),
      'entryType', 'WORK',
      'organizationId', 'default_org'
    )
  )
);

COMMIT;

-- 4. Выводим результат для проверки
SELECT * FROM work_logs WHERE id = 'sql-test-shift-1';
