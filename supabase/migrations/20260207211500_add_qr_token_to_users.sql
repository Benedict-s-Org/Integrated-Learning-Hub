-- Add qr_token column to users table for QR code-based reward system
-- Each student gets a unique token embedded in their QR code URL

ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS qr_token UUID UNIQUE DEFAULT gen_random_uuid();

-- Create index for fast lookups when scanning QR codes
CREATE INDEX IF NOT EXISTS idx_users_qr_token ON public.users(qr_token);

-- Backfill existing users with tokens
UPDATE public.users 
SET qr_token = gen_random_uuid() 
WHERE qr_token IS NULL;
