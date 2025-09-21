-- Create fortune_media table to track photo attachments
CREATE TABLE public.fortune_media (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fortune_id UUID NOT NULL,
  user_id UUID NOT NULL,
  path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  size_bytes BIGINT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on fortune_media
ALTER TABLE public.fortune_media ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for fortune_media
CREATE POLICY "Users can view their own fortune media" 
ON public.fortune_media 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own fortune media" 
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

-- Create index for better performance
CREATE INDEX idx_fortune_media_fortune_id ON public.fortune_media(fortune_id);
CREATE INDEX idx_fortune_media_user_id ON public.fortune_media(user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_fortune_media_updated_at
BEFORE UPDATE ON public.fortune_media
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();