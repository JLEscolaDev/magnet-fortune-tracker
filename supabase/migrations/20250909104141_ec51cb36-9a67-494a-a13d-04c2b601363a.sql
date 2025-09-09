-- Drop all fortune_update function overloads to fix conflicts
DROP FUNCTION IF EXISTS public.fortune_update(uuid, text, text, integer, text);
DROP FUNCTION IF EXISTS public.fortune_update(uuid, text, text, numeric, text);
DROP FUNCTION IF EXISTS public.fortune_update(uuid, text, text, integer);

-- Create single clean fortune_update function
CREATE OR REPLACE FUNCTION public.fortune_update(
  p_id UUID,
  p_text TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_fortune_value NUMERIC DEFAULT NULL,
  p_impact_level TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE fortunes 
  SET 
    text = CASE 
      WHEN p_text IS NOT NULL THEN public.encrypt_with_app_key(p_text)
      ELSE text 
    END,
    category = COALESCE(p_category, category), 
    fortune_value = COALESCE(p_fortune_value, fortune_value),
    impact_level = CASE 
      WHEN p_impact_level IS NOT NULL THEN p_impact_level::fortune_impact_level 
      ELSE impact_level 
    END
  WHERE id = p_id AND user_id = auth.uid();
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fortune not found or access denied';
  END IF;
END;
$$;