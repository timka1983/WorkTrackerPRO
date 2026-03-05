
SELECT * FROM users WHERE name LIKE '%Анна Сидорова%';
SELECT * FROM work_logs WHERE user_id IN (SELECT id FROM users WHERE name LIKE '%Анна Сидорова%');
SELECT * FROM active_shifts WHERE user_id IN (SELECT id FROM users WHERE name LIKE '%Анна Сидорова%');
