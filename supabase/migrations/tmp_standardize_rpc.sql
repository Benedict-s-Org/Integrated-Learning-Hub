CREATE OR REPLACE FUNCTION public.tmp_standardize_rewards()
RETURNS VOID AS $$
BEGIN
    UPDATE public.class_rewards SET coins = -5 WHERE title ILIKE '%Introducing Off-Topic%';
    UPDATE public.target_behaviors SET coin_value = 5 WHERE label = 'Insightful Question';
    UPDATE public.target_behaviors SET coin_value = 5 WHERE label = 'Positive Attitude';
    
    -- Also check for any others
    UPDATE public.class_rewards SET coins = 5 WHERE coins IN (2, 3);
    UPDATE public.target_behaviors SET coin_value = 5 WHERE coin_value IN (2, 3);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
