-- Миграция для таблицы оборудования (machines)
-- Добавление колонок для архивации и привязки к филиалам

-- 1. Добавляем колонку branch_id, если её нет
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='machines' AND column_name='branch_id') THEN
        ALTER TABLE machines ADD COLUMN branch_id TEXT;
    END IF;
END $$;

-- 2. Добавляем колонку is_archived, если её нет
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='machines' AND column_name='is_archived') THEN
        ALTER TABLE machines ADD COLUMN is_archived BOOLEAN DEFAULT false;
    END IF;
END $$;

-- 3. Обновляем политики RLS (на всякий случай)
ALTER TABLE machines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read" ON machines;
CREATE POLICY "Allow public read" ON machines FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert" ON machines;
CREATE POLICY "Allow public insert" ON machines FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update" ON machines;
CREATE POLICY "Allow public update" ON machines FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow public delete" ON machines;
CREATE POLICY "Allow public delete" ON machines FOR DELETE USING (true);
