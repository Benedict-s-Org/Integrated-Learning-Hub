-- Add a default 'Absent' reward to the system
-- This makes it easier for teachers to find the 'Absent' button
INSERT INTO public.class_rewards (title, coins, type, icon, color)
SELECT '缺席 (Absent)', 0, 'consequence', 'Clock', 'text-gray-500 bg-gray-100'
WHERE NOT EXISTS (
    SELECT 1 FROM public.class_rewards WHERE title LIKE '%缺席%' OR title LIKE '%Absent%'
);
