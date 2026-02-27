-- SQL МИГРАЦИЯ ДЛЯ ОБЕСПЕЧЕНИЯ ЛИМИТОВ НА УРОВНЕ БАЗЫ ДАННЫХ
-- Выполните этот код в Supabase SQL Editor

-- 1. Функция проверки лимита сотрудников
CREATE OR REPLACE FUNCTION check_user_limit()
RETURNS TRIGGER AS $$
DECLARE
    current_count INTEGER;
    max_allowed INTEGER;
    org_plan TEXT;
BEGIN
    -- Получаем текущий план организации
    SELECT plan INTO org_plan FROM organizations WHERE id = NEW.organization_id;
    
    -- Получаем лимит из таблицы планов (предполагаем, что лимиты хранятся в JSONB колонке limits)
    SELECT (limits->>'maxUsers')::INTEGER INTO max_allowed 
    FROM plans 
    WHERE type = org_plan;

    -- Если план не найден в таблице plans, используем жестко заданные дефолты (fallback)
    IF max_allowed IS NULL THEN
        max_allowed := CASE 
            WHEN org_plan = 'FREE' THEN 3
            WHEN org_plan = 'PRO' THEN 20
            ELSE 1000
        END;
    END IF;

    -- Считаем текущее кол-во пользователей (исключая текущую операцию, если это INSERT)
    SELECT COUNT(*) INTO current_count FROM users WHERE organization_id = NEW.organization_id;

    IF current_count >= max_allowed THEN
        RAISE EXCEPTION 'LIMIT_REACHED: Организация достигла лимита сотрудников (%) для тарифа %', max_allowed, org_plan;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Триггер на вставку пользователя
DROP TRIGGER IF EXISTS enforce_user_limit ON users;
CREATE TRIGGER enforce_user_limit
BEFORE INSERT ON users
FOR EACH ROW EXECUTE FUNCTION check_user_limit();

-- 3. Функция проверки лимита оборудования
CREATE OR REPLACE FUNCTION check_machine_limit()
RETURNS TRIGGER AS $$
DECLARE
    current_count INTEGER;
    max_allowed INTEGER;
    org_plan TEXT;
BEGIN
    SELECT plan INTO org_plan FROM organizations WHERE id = NEW.organization_id;
    
    SELECT (limits->>'maxMachines')::INTEGER INTO max_allowed 
    FROM plans 
    WHERE type = org_plan;

    IF max_allowed IS NULL THEN
        max_allowed := CASE 
            WHEN org_plan = 'FREE' THEN 2
            WHEN org_plan = 'PRO' THEN 10
            ELSE 1000
        END;
    END IF;

    SELECT COUNT(*) INTO current_count FROM machines WHERE organization_id = NEW.organization_id;

    IF current_count >= max_allowed THEN
        RAISE EXCEPTION 'LIMIT_REACHED: Организация достигла лимита оборудования (%) для тарифа %', max_allowed, org_plan;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Триггер на вставку оборудования
DROP TRIGGER IF EXISTS enforce_machine_limit ON machines;
CREATE TRIGGER enforce_machine_limit
BEFORE INSERT ON machines
FOR EACH ROW EXECUTE FUNCTION check_machine_limit();

-- 5. Функция для получения серверного времени (защита от подмены времени на клиенте)
CREATE OR REPLACE FUNCTION get_server_time()
RETURNS TIMESTAMPTZ AS $$
BEGIN
    RETURN NOW();
END;
$$ LANGUAGE plpgsql;
