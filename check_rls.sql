SELECT 
    relname as table_name,
    relrowsecurity as rls_enabled
FROM pg_class
WHERE relname IN ('system_config', 'daily_homework', 'student_records');
