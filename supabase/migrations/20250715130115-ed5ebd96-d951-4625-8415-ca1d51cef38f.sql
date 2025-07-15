-- Create avatars table for level-based avatar images
CREATE TABLE public.avatars (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  level INTEGER NOT NULL UNIQUE,
  url TEXT NOT NULL,
  title TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.avatars ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access to avatars
CREATE POLICY "Avatars are publicly readable" 
ON public.avatars 
FOR SELECT 
USING (true);

-- Insert some sample avatar data
INSERT INTO public.avatars (level, url, title) VALUES 
(1, 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face', 'Novice Seeker'),
(2, 'https://images.unsplash.com/photo-1494790108755-2616b412d1e0?w=200&h=200&fit=crop&crop=face', 'Fortune Apprentice'),
(3, 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop&crop=face', 'Wisdom Gatherer'),
(4, 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop&crop=face', 'Destiny Reader'),
(5, 'https://images.unsplash.com/photo-1507591064344-4c6ce005b128?w=200&h=200&fit=crop&crop=face', 'Master of Fortune');

-- Update profiles table to include avatar_url if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'profiles' 
                   AND column_name = 'avatar_url') THEN
        ALTER TABLE public.profiles ADD COLUMN avatar_url TEXT;
    END IF;
END $$;