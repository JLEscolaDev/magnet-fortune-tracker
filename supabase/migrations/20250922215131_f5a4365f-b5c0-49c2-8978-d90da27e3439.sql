-- Update fortune_media table to match the new schema requirements
ALTER TABLE public.fortune_media 
DROP COLUMN IF EXISTS bucket;

-- Add bucket column if it doesn't exist with default value
ALTER TABLE public.fortune_media 
ADD COLUMN IF NOT EXISTS bucket text NOT NULL DEFAULT 'fortune-photos';