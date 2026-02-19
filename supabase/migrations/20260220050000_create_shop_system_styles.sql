-- Create shop_system_styles table
CREATE TABLE IF NOT EXISTS public.shop_system_styles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('wall', 'floor')),
    color_hex TEXT NOT NULL,
    category TEXT NOT NULL,
    price INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.shop_system_styles ENABLE ROW LEVEL SECURITY;

-- Everyone can view system styles
CREATE POLICY "Allow public read access to system styles"
    ON public.shop_system_styles FOR SELECT
    USING (true);

-- Only admins can modify system styles
CREATE POLICY "Allow admins to manage system styles"
    ON public.shop_system_styles FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND role = 'admin'
    ));

-- Seed with some initial colors (representative of the 7 series)
-- I will add a broader selection later or via Admin UI
INSERT INTO public.shop_system_styles (name, type, color_hex, category, price) VALUES
-- Pink Series
('霧玫瑰', 'wall', '#FFE4E1', 'Pink Series', 200),
('粉嫩心', 'wall', '#FFC0CB', 'Pink Series', 200),
('浪漫粉', 'wall', '#FFB6C1', 'Pink Series', 200),
-- Blue Series
('淡天藍', 'wall', '#E0F7FA', 'Blue Series', 200),
('清透藍', 'wall', '#B3E5FC', 'Blue Series', 200),
('寧靜藍', 'wall', '#81D4FA', 'Blue Series', 200),
-- Purple Series
('薰衣草', 'wall', '#F3E5F5', 'Purple Series', 200),
('夢幻紫', 'wall', '#E1BEE7', 'Purple Series', 200),
('優雅紫', 'wall', '#CE93D8', 'Purple Series', 200),
-- Green Series
('嫩芽綠', 'wall', '#F1F8E9', 'Green Series', 200),
('抹茶綠', 'wall', '#DCEDC8', 'Green Series', 200),
('森林綠', 'wall', '#C5E1A5', 'Green Series', 200),
-- Yellow Series
('晨光黃', 'wall', '#FFFDE7', 'Yellow Series', 200),
('鮮奶黃', 'wall', '#FFF9C4', 'Yellow Series', 200),
('陽光黃', 'wall', '#FFF59D', 'Yellow Series', 200),
-- Orange Series
('落日橘', 'wall', '#FFF3E0', 'Orange Series', 200),
('暖心橘', 'wall', '#FFE0B2', 'Orange Series', 200),
('蜜桃橘', 'wall', '#FFCC80', 'Orange Series', 200),
-- Grey Series
('極簡灰', 'wall', '#FAFAFA', 'Grey Series', 200),
('沉穩灰', 'wall', '#F5F5F5', 'Grey Series', 200),
('冷酷灰', 'wall', '#EEEEEE', 'Grey Series', 200),

-- Floor versions (same colors for now)
('霧玫瑰地磚', 'floor', '#FFE4E1', 'Pink Series', 300),
('寧靜藍地磚', 'floor', '#81D4FA', 'Blue Series', 300),
('極簡灰地磚', 'floor', '#FAFAFA', 'Grey Series', 300);
