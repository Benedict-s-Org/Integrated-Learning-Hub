-- Create the reading-passages storage bucket for saving cropped PDF preview images
INSERT INTO storage.buckets (id, name, public)
VALUES ('reading-passages', 'reading-passages', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload reading passages"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'reading-passages');

-- Allow public read access to reading passage images
CREATE POLICY "Public read access for reading passages"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'reading-passages');

-- Allow authenticated users to delete their own uploads
CREATE POLICY "Authenticated users can delete reading passages"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'reading-passages');
