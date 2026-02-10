-- Add target_class column to shared_links
ALTER TABLE public.shared_links
ADD COLUMN IF NOT EXISTS target_class TEXT;
