-- Update fortune_add function to accept optional date parameter
CREATE OR REPLACE FUNCTION public.fortune_add(
  p_text text,
  p_category text DEFAULT NULL,
  p_level int DEFAULT NULL,
  p_created_at timestamptz DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_id uuid;
  target_created_at timestamptz;
BEGIN
  -- Use provided date or current timestamp
  target_created_at := COALESCE(p_created_at, now());
  
  -- Insert the fortune with encryption
  INSERT INTO public.fortunes (
    user_id, 
    text, 
    category, 
    fortune_level,
    created_at
  ) 
  VALUES (
    auth.uid(),
    public._encrypt_text(p_text, public._enc_key_for(auth.uid())),
    p_category,
    p_level,
    target_created_at
  )
  RETURNING id INTO new_id;
  
  RETURN new_id;
END;
$$;