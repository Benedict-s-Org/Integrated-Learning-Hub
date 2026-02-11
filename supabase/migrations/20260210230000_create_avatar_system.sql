-- Create Avatar System Tables

-- 1. Avatar Items Catalog
CREATE TABLE IF NOT EXISTS public.avatar_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('body', 'skin', 'eyes', 'nose', 'mouth', 'hair', 'outfit', 'accessory', 'frame', 'background', 'emote', 'companion')),
    layer_order INTEGER NOT NULL DEFAULT 0,
    rarity TEXT DEFAULT 'common' CHECK (rarity IN ('common', 'uncommon', 'rare', 'legendary')),
    asset_id TEXT NOT NULL, -- Corresponds to the ID in AvatarAssets.tsx (e.g., 'body-round')
    price INTEGER DEFAULT 0,
    duration_type TEXT DEFAULT 'permanent' CHECK (duration_type IN ('permanent', 'seasonal', 'event', 'consumable')),
    duration_days INTEGER,
    required_achievement TEXT,
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. User Avatar Inventory (Owned Items)
CREATE TABLE IF NOT EXISTS public.user_avatar_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES public.avatar_items(id) ON DELETE CASCADE,
    acquired_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    source TEXT DEFAULT 'shop', -- 'shop', 'achievement', 'gift', 'daily_spin', 'default'
    UNIQUE(user_id, item_id)
);

-- 3. User Avatar Config (Current Look)
CREATE TABLE IF NOT EXISTS public.user_avatar_config (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- Config structure:
    -- {
    --   body: "item_asset_id",
    --   skinColor: "#hex",
    --   eyes: "item_asset_id",
    --   eyeColor: "#hex",
    --   ...
    -- }
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.avatar_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_avatar_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_avatar_config ENABLE ROW LEVEL SECURITY;

-- Policies

-- Avatar Items: Everyone can read active items
CREATE POLICY "Everyone can view active avatar items"
    ON public.avatar_items FOR SELECT
    USING (is_active = true);

-- Inventory: Users can view their own inventory
CREATE POLICY "Users can view their own avatar inventory"
    ON public.user_avatar_inventory FOR SELECT
    USING (auth.uid() = user_id);

-- Inventory: System/Admins can insert (for shops/rewards) - Simplified for now to allow authenticated users to "buy" via RPC
-- Ideally, purchasing should be done via a secure RPC that checks coins. 
-- For MVP/Foundation, we'll allow users to insert if the item is 'default' or via a trusted function.
-- Let's create a policy that allows users to insert if the source is 'default' (starter items).
CREATE POLICY "Users can insert default items"
    ON public.user_avatar_inventory FOR INSERT
    WITH CHECK (auth.uid() = user_id AND source = 'default');

-- Config: Users can manage their own config
CREATE POLICY "Users can manage their own avatar config"
    ON public.user_avatar_config FOR ALL
    USING (auth.uid() = user_id);

-- Config: Everyone can view others' avatar configs (to see them on dashboard)
CREATE POLICY "Everyone can view avatar configs"
    ON public.user_avatar_config FOR SELECT
    USING (true);


-- 4. RPC to Initialize User Avatar (Seed defaults)
CREATE OR REPLACE FUNCTION public.initialize_user_avatar_defaults(target_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Insert default items into inventory if not exists
    INSERT INTO public.user_avatar_inventory (user_id, item_id, source)
    SELECT target_user_id, id, 'default'
    FROM public.avatar_items
    WHERE is_default = true
    ON CONFLICT (user_id, item_id) DO NOTHING;

    -- Create default config if not exists
    INSERT INTO public.user_avatar_config (user_id, config)
    VALUES (
        target_user_id,
        jsonb_build_object(
            'body', 'body-round',
            'skinColor', '#F5CBA7',
            'eyes', 'eyes-round',
            'eyeColor', '#654321',
            'nose', 'nose-dot',
            'mouth', 'mouth-smile',
            'hair', 'hair-short',
            'hairColor', '#3d2b1f',
            'outfit', 'outfit-tshirt',
            'outfitColor', '#3498db',
            'accessory', null
        )
    )
    ON CONFLICT (user_id) DO NOTHING;
END;
$$;
