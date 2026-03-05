
-- Отключаем RLS для таблицы active_shifts
ALTER TABLE active_shifts DISABLE ROW LEVEL SECURITY;

-- На всякий случай убедимся, что RLS отключен и для work_logs
ALTER TABLE work_logs DISABLE ROW LEVEL SECURITY;
