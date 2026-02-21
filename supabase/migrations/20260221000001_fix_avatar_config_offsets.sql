-- Fix missing custom_offsets column in user_avatar_config
ALTER TABLE public.user_avatar_config 
ADD COLUMN IF NOT EXISTS custom_offsets JSONB NOT NULL DEFAULT '{}'::jsonb;
