-- Create the morning_duty_assets bucket for audio uploads
insert into storage.buckets (id, name, public, allowed_mime_types)
values (
  'morning_duty_assets', 
  'morning_duty_assets', 
  true, 
  '{"audio/mpeg", "audio/wav", "audio/x-wav", "audio/mp3", "audio/mp4", "audio/x-m4a"}'
)
on conflict (id) do update set 
  public = true,
  allowed_mime_types = '{"audio/mpeg", "audio/wav", "audio/x-wav", "audio/mp3", "audio/mp4", "audio/x-m4a"}';

-- Allow public read access to the bucket
create policy "Morning Duty Assets Public Access"
  on storage.objects for select
  using ( bucket_id = 'morning_duty_assets' );

-- Allow authenticated users to upload files to the bucket
create policy "Authenticated users can upload morning duty assets"
  on storage.objects for insert
  with check ( bucket_id = 'morning_duty_assets' and auth.role() = 'authenticated' );

-- Allow authenticated users to update their files
create policy "Authenticated users can update morning duty assets"
  on storage.objects for update
  using ( bucket_id = 'morning_duty_assets' and auth.role() = 'authenticated' );

-- Allow authenticated users to delete their files
create policy "Authenticated users can delete morning duty assets"
  on storage.objects for delete
  using ( bucket_id = 'morning_duty_assets' and auth.role() = 'authenticated' );
