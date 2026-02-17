-- Add image_url to spaced_repetition_questions table
ALTER TABLE public.spaced_repetition_questions
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Create storage bucket for question images if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('question-images', 'question-images', true)
ON CONFLICT (id) DO NOTHING;

-- Policy to allow authenticated users to upload images
CREATE POLICY "Authenticated users can upload question images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'question-images');

-- Policy to allow public to view images
CREATE POLICY "Public can view question images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'question-images');
