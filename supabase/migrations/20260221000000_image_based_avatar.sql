-- Drop existing avatar specific tables to rebuild for Image-Based approach
DROP TABLE IF EXISTS public.user_avatar_inventory CASCADE;
DROP TABLE IF EXISTS public.user_avatar_config CASCADE;
DROP TABLE IF EXISTS public.avatar_items CASCADE;

-- 1. Create the new avatar_items table supporting image layers
CREATE TABLE public.avatar_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL CHECK (category IN (
        'background', 'body', 'face', 'bottoms', 'shoes', 
        'tops', 'mouth', 'eyes', 'hair_back', 'hair_front', 'accessories'
    )),
    image_url TEXT NOT NULL, -- Supabase storage path or public URL
    layer_z_index INTEGER NOT NULL DEFAULT 50, -- Render order: low (back) to high (front)
    base_price INTEGER NOT NULL DEFAULT 0,
    is_default BOOLEAN NOT NULL DEFAULT false, -- If true, all users own this from the start
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for efficient querying by category during Builder UI load
CREATE INDEX idx_avatar_items_category ON public.avatar_items(category);

-- 2. Create the user_avatar_inventory table
CREATE TABLE public.user_avatar_inventory (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    item_id UUID REFERENCES public.avatar_items(id) ON DELETE CASCADE NOT NULL,
    acquired_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    source TEXT NOT NULL DEFAULT 'purchase' CHECK (source IN ('purchase', 'reward', 'default', 'admin')),
    UNIQUE(user_id, item_id) -- User can only own one of each item
);

-- 3. Create the user_avatar_config table specifying equipped items AND their custom offsets
CREATE TABLE public.user_avatar_config (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    -- JSONB format:
    -- {
    --   "eyes": { "item_id": "uuid", "x": 0, "y": 5, "scale": 1.0 },
    --   "mouth": { "item_id": "uuid", "x": -2, "y": 0, "scale": 1.1 }
    -- }
    equipped_items JSONB NOT NULL DEFAULT '{}'::jsonb,
    custom_offsets JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Set up Row Level Security (RLS)
ALTER TABLE public.avatar_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_avatar_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_avatar_config ENABLE ROW LEVEL SECURITY;

-- avatar_items Policies
CREATE POLICY "Avatar items are viewable by everyone" ON public.avatar_items FOR SELECT USING (true);
CREATE POLICY "Only MVP Admin can modify items MVP MVP" ON public.avatar_items
    FOR ALL
    USING (
        auth.uid() IN (SELECT id FROM auth.users WHERE email = 'cftsang@superleekam.edu.hk')
    );

-- user_avatar_inventory Policies
CREATE POLICY "Users can view their own inventory" ON public.user_avatar_inventory FOR SELECT USING (auth.uid() = user_id);
-- Allow system to insert default/purchased items (Requires secure RPC for actual purchase logic, we rely on RLS/RPC integration)
CREATE POLICY "Users can insert default items" ON public.user_avatar_inventory 
    FOR INSERT 
    WITH CHECK (auth.uid() = user_id AND source = 'default');

-- user_avatar_config Policies
CREATE POLICY "Users can manage their own config" ON public.user_avatar_config FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Everyone can view avatar configs" ON public.user_avatar_config FOR SELECT USING (true);


-- 4. Set up the Storage Bucket for custom images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatar-assets', 
  'avatar-assets', 
  true, 
  5242880, -- 5MB limit per file
  ARRAY['image/png', 'image/jpeg', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET 
  public = true,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/svg+xml'];

-- Storage Policies for 'avatar-assets' bucket
CREATE POLICY "Avatar assets are publicly accessible" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatar-assets');

CREATE POLICY "Admin can upload avatar assets" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatar-assets' AND
    auth.uid() IN (SELECT id FROM auth.users WHERE email = 'cftsang@superleekam.edu.hk')
  );

CREATE POLICY "Admin can update avatar assets" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'avatar-assets' AND
    auth.uid() IN (SELECT id FROM auth.users WHERE email = 'cftsang@superleekam.edu.hk')
  );

CREATE POLICY "Admin can delete avatar assets" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'avatar-assets' AND
    auth.uid() IN (SELECT id FROM auth.users WHERE email = 'cftsang@superleekam.edu.hk')
  );
