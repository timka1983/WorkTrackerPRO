
BEGIN;

-- 1. Завершаем смену в work_logs
UPDATE work_logs 
SET check_out = NOW(), 
    duration_minutes = 60 -- Пусть будет 1 час для теста
WHERE id = 'sql-test-shift-1';

-- 2. Удаляем запись из active_shifts (так как смена завершена)
DELETE FROM active_shifts WHERE user_id = '2';

COMMIT;

-- 3. Выводим результат для проверки
SELECT * FROM work_logs WHERE id = 'sql-test-shift-1';
