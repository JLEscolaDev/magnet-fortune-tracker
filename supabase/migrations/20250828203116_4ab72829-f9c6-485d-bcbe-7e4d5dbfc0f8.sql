-- Update fortune_add function to support impact_level parameter
CREATE OR REPLACE FUNCTION public.fortune_add(
  p_text text, 
  p_category text DEFAULT 'General'::text, 
  p_level integer DEFAULT 0,
  p_created_at timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_impact_level fortune_impact_level DEFAULT 'small_step'::fortune_impact_level
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_id uuid;
  target_created_at timestamptz;
BEGIN
  -- Use provided date or current timestamp
  target_created_at := COALESCE(p_created_at, now());
  
  -- Insert the fortune with encryption using the correct function
  INSERT INTO public.fortunes (
    user_id, 
    text, 
    category, 
    fortune_level,
    impact_level,
    created_at
  ) 
  VALUES (
    auth.uid(),
    public.encrypt_with_app_key(p_text),
    p_category,
    p_level,
    p_impact_level,
    target_created_at
  )
  RETURNING id INTO new_id;
  
  RETURN new_id;
END;
$function$;