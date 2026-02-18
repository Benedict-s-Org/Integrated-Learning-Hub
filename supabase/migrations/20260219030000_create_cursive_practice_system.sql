
-- Create cursive exercises table
CREATE TABLE IF NOT EXISTS public.cursive_exercises (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    image_url TEXT NOT NULL,
    audio_url TEXT,
    stroke_data JSONB DEFAULT '[]'::JSONB, -- Array of {x, y, time, pressure}
    canvas_width INTEGER NOT NULL DEFAULT 1024,
    canvas_height INTEGER NOT NULL DEFAULT 768,
    created_by UUID REFERENCES auth.users(id),
    is_published BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create cursive practice results table (attempts)
CREATE TABLE IF NOT EXISTS public.cursive_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    exercise_id UUID REFERENCES public.cursive_exercises(id) ON DELETE CASCADE NOT NULL,
    score INTEGER CHECK (score >= 0 AND score <= 100),
    stroke_data JSONB DEFAULT '[]'::JSONB, -- Student's recorded path
    feedback TEXT, -- Optional automated feedback
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.cursive_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cursive_attempts ENABLE ROW LEVEL SECURITY;

-- Policies for cursive_exercises
CREATE POLICY "Admins can do everything with exercises" 
ON public.cursive_exercises 
FOR ALL 
USING (
  public.is_admin() OR 
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Everyone can view published exercises" 
ON public.cursive_exercises 
FOR SELECT 
USING (is_published = true);

-- Policies for cursive_attempts
CREATE POLICY "Users can view and create their own attempts" 
ON public.cursive_attempts 
FOR ALL 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all attempts" 
ON public.cursive_attempts 
FOR SELECT 
USING (
  public.is_admin() OR 
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- Storage bucket setup for cursive-assets
INSERT INTO storage.buckets (id, name, public) 
VALUES ('cursive-assets', 'cursive-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Admins can upload cursive assets" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'cursive-assets' AND (
    public.is_admin() OR 
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  )
);

CREATE POLICY "Admins can update cursive assets" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'cursive-assets' AND (
    public.is_admin() OR 
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  )
);

CREATE POLICY "Admins can delete cursive assets" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'cursive-assets' AND (
    public.is_admin() OR 
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  )
);

CREATE POLICY "Public Read Access for cursive assets" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'cursive-assets');
