-- Update UI Builder Assets Table with Categorization
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ui_builder_assets' AND column_name = 'category') THEN
        ALTER TABLE public.ui_builder_assets ADD COLUMN category text;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ui_builder_assets' AND column_name = 'context') THEN
        ALTER TABLE public.ui_builder_assets ADD COLUMN context text;
    END IF;
END $$;

-- Update existing records to 'general' if null
UPDATE public.ui_builder_assets SET category = 'general' WHERE category IS NULL;
UPDATE public.ui_builder_assets SET context = 'general' WHERE context IS NULL;
