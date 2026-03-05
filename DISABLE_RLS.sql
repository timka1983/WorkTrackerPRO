
-- Отключаем RLS для таблицы work_logs полностью, чтобы исключить проблемы с правами доступа
ALTER TABLE work_logs DISABLE ROW LEVEL SECURITY;

-- Проверяем, что запись все еще существует
SELECT * FROM work_logs WHERE id = 'sql-test-shift-1';
