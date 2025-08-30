-- First, let's update duplicate display_names to make them unique
-- Add a suffix to duplicates to preserve existing data
UPDATE public.profiles 
SET display_name = display_name || '_' || user_id::text
WHERE display_name IN (
  SELECT display_name 
  FROM public.profiles 
  WHERE display_name IS NOT NULL
  GROUP BY display_name 
  HAVING COUNT(*) > 1
);

-- Also handle NULL display_names by setting them to a default value
UPDATE public.profiles 
SET display_name = 'user_' || user_id::text
WHERE display_name IS NULL;

-- Now add the unique constraint
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