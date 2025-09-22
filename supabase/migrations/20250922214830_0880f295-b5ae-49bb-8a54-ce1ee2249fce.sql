-- Create private bucket for fortune photos
INSERT INTO storage.buckets (id, name, public) VALUES ('fortune-photos', 'fortune-photos', false);

-- Create fortune_media table
CREATE TABLE public.fortune_media (
  fortune_id uuid PRIMARY KEY REFERENCES public.fortunes(id) ON DELETE CASCADE,
  bucket text NOT NULL DEFAULT 'fortune-photos',
  path text NOT NULL,
  width integer,
  height integer,
  size_bytes integer,
  mime_type text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.fortune_media ENABLE ROW LEVEL SECURITY;

-- RLS policies: users can only access media for their own fortunes
CREATE POLICY "Users can view their own fortune media" 
ON public.fortune_media 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.fortunes f 
    WHERE f.id = fortune_media.fortune_id AND f.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert their own fortune media" 
ON public.fortune_media 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.fortunes f 
    WHERE f.id = fortune_media.fortune_id AND f.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own fortune media" 
ON public.fortune_media 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.fortunes f 
    WHERE f.id = fortune_media.fortune_id AND f.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their own fortune media" 
ON public.fortune_media 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.fortunes f 
    WHERE f.id = fortune_media.fortune_id AND f.user_id = auth.uid()
  )
);

-- Deny anonymous access
CREATE POLICY "Deny anonymous access to fortune media" 
ON public.fortune_media 
FOR ALL 
TO anon 
USING (false);

-- Storage policies for fortune-photos bucket
CREATE POLICY "Users can view their own photos" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'fortune-photos' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can upload their own photos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'fortune-photos' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update their own photos" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'fortune-photos' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete their own photos" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'fortune-photos' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);