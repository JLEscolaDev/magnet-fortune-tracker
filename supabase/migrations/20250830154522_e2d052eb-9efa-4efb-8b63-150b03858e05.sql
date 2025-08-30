-- Add unique constraint to display_name in profiles table
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_display_name_unique UNIQUE (display_name);

-- Create index for faster lookups
CREATE INDEX idx_profiles_display_name ON public.profiles(display_name);

-- Create function to check if username is available
CREATE OR REPLACE FUNCTION public.is_username_available(username text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Return false if username exists, true if available
  RETURN NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE display_name = username
  );
END;
$$;