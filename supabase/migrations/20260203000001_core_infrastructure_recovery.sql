-- Core Infrastructure Recovery Migration
-- This file restores tables that were lost or missing from the migration files.

-- 1. Rooms Table
CREATE TABLE IF NOT EXISTS public.rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    layout JSONB DEFAULT '[]'::jsonb,
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for rooms
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own rooms" ON public.rooms
    FOR ALL USING (auth.uid() = owner_id);
CREATE POLICY "Public can view public rooms" ON public.rooms
    FOR SELECT USING (is_public = true);

-- 2. Items Catalog
CREATE TABLE IF NOT EXISTS public.items_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category TEXT,
    sprite_key TEXT,
    default_properties JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for items_catalog
ALTER TABLE public.items_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view inventory items" ON public.items_catalog
    FOR SELECT USING (true);

-- 3. User Room Data
CREATE TABLE IF NOT EXISTS public.user_room_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
    coins INTEGER DEFAULT 0,
    virtual_coins INTEGER DEFAULT 0,
    daily_counts JSONB DEFAULT '{}'::jsonb,
    house_level INTEGER DEFAULT 1,
    inventory TEXT[] DEFAULT '{}',
    placements JSONB DEFAULT '[]'::jsonb,
    wall_placements JSONB DEFAULT '[]'::jsonb,
    custom_catalog JSONB DEFAULT '{}'::jsonb,
    custom_floors JSONB DEFAULT '{}'::jsonb,
    custom_walls JSONB DEFAULT '{}'::jsonb,
    custom_models JSONB DEFAULT '{}'::jsonb,
    active_floor_id TEXT,
    active_wall_id TEXT,
    morning_status TEXT DEFAULT 'todo',
    last_morning_update DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Enable RLS for user_room_data
ALTER TABLE public.user_room_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own room data" ON public.user_room_data
    FOR ALL USING (auth.uid() = user_id);

-- 4. Memorization Practice Sessions
CREATE TABLE IF NOT EXISTS public.memorization_practice_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    assignment_id UUID REFERENCES public.memorization_assignments(id) ON DELETE SET NULL,
    session_type TEXT,
    difficulty_level INTEGER,
    score INTEGER DEFAULT 0,
    performance_data JSONB DEFAULT '{}'::jsonb,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for memorization_practice_sessions
ALTER TABLE public.memorization_practice_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own sessions" ON public.memorization_practice_sessions
    FOR ALL USING (auth.uid() = user_id);
