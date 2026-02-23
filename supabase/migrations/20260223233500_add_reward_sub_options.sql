-- Add sub_options column to class_rewards table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='class_rewards' AND column_name='sub_options') THEN
        ALTER TABLE public.class_rewards ADD COLUMN sub_options JSONB DEFAULT NULL;
    END IF;
END $$;

-- Seed or Update the "完成班務（欠功課）" reward
WITH upsert AS (
    UPDATE public.class_rewards 
    SET sub_options = '{
        "中文": ["預習冊", "詞語", "語基冊", "課練冊", "視聽冊", "實用冊", "作文", "補充", "閱補", "閱讀理解工作紙", "書練習"],
        "英文": ["WS1", "WS2", "WS3", "Pen", "GE(A)", "GE(B)", "Word Bank", "RWD", "Dict C/S", "Writing WS", "All-in-One", "Handwriting"],
        "數學": ["A簿", "B簿", "作業", "補充", "複工", "難工", "知多啲", "3下A 工", "3下b 工", "書"],
        "常識": [],
        "其他": []
    }'::jsonb
    WHERE title = '完成班務（欠功課）'
    RETURNING *
)
INSERT INTO public.class_rewards (title, coins, type, icon, color, sub_options)
SELECT '完成班務（欠功課）', 10, 'reward', 'BookOpen', 'text-blue-500 bg-blue-100', '{
    "中文": ["預習冊", "詞語", "語基冊", "課練冊", "視聽冊", "實用冊", "作文", "補充", "閱補", "閱讀理解工作紙", "書練習"],
    "英文": ["WS1", "WS2", "WS3", "Pen", "GE(A)", "GE(B)", "Word Bank", "RWD", "Dict C/S", "Writing WS", "All-in-One", "Handwriting"],
    "數學": ["A簿", "B簿", "作業", "補充", "複工", "難工", "知多啲", "3下A 工", "3下b 工", "書"],
    "常識": [],
    "其他": []
}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM upsert);
