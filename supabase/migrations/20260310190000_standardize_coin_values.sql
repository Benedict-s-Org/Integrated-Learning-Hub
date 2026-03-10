-- Standardize rewards and behaviors to multiples of 5

-- 1. Update class_rewards
UPDATE public.class_rewards
SET coins = CASE 
    WHEN coins = -3 THEN -5
    WHEN coins = 3 THEN 5
    WHEN coins = 2 THEN 5
    WHEN coins = -2 THEN -5
    ELSE coins
END
WHERE coins IN (-3, 3, 2, -2);

-- 2. Update target_behaviors
UPDATE public.target_behaviors
SET coin_value = CASE 
    WHEN coin_value = -3 THEN -5
    WHEN coin_value = 3 THEN 5
    WHEN coin_value = 2 THEN 5
    WHEN coin_value = -2 THEN -5
    ELSE coin_value
END
WHERE coin_value IN (-3, 3, 2, -2);

-- 3. Specifically fix known entries
UPDATE public.class_rewards SET coins = -5 WHERE title LIKE '%Introducing Off-Topic%';
UPDATE public.target_behaviors SET coin_value = 5 WHERE label = 'Insightful Question';
UPDATE public.target_behaviors SET coin_value = 5 WHERE label = 'Positive Attitude';
