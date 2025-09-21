-- Create the fortune_media table for storing photo attachments
CREATE TABLE public.fortune_media (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fortune_id UUID NOT NULL REFERENCES public.fortunes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  size_bytes INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add unique constraint to enforce one photo per fortune
ALTER TABLE public.fortune_media ADD CONSTRAINT unique_fortune_photo UNIQUE (fortune_id);

-- Enable RLS
ALTER TABLE public.fortune_media ENABLE ROW LEVEL SECURITY;

-- Create policies for user access (Pro/Lifetime only enforced by backend)
CREATE POLICY "Users can view their own fortune media" 
ON public.fortune_media 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own fortune media" 
ON public.fortune_media 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own fortune media" 
ON public.fortune_media 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own fortune media" 
ON public.fortune_media 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_fortune_media_updated_at
BEFORE UPDATE ON public.fortune_media
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for photos if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('photos', 'photos', false)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for fortune photos
CREATE POLICY "Users can view their own fortune photos" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can upload their own fortune photos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own fortune photos" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own fortune photos" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);