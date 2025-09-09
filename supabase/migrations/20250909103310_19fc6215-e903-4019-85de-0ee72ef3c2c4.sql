-- Create fortune_update RPC function to handle encrypted updates
CREATE OR REPLACE FUNCTION fortune_update(
  p_id UUID,
  p_text TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_fortune_value INTEGER DEFAULT NULL,
  p_impact_level TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE fortunes 
  SET 
    text = COALESCE(p_text, text),
    category = COALESCE(p_category, category), 
    fortune_value = COALESCE(p_fortune_value, fortune_value),
    impact_level = COALESCE(p_impact_level, impact_level),
    updated_at = NOW()
  WHERE id = p_id AND user_id = auth.uid();
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fortune not found or access denied';
  END IF;
END;
$$;