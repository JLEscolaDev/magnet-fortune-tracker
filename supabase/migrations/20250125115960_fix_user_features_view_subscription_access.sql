-- Fix user_features view to correctly check subscription access
-- Access should be: (is_lifetime=true AND status='active') OR status IN ('active', 'trialing')
-- Previous version incorrectly granted access for any is_lifetime=true regardless of status
-- Also adds missing early_bird_eligible column

CREATE OR REPLACE VIEW public.user_features
AS
SELECT
  p.user_id,
  p.trial_ends_at,
  p.early_bird_seen,
  p.early_bird_redeemed,
  -- early_bird_eligible: user has seen the offer but not redeemed it, and is in trial
  (p.early_bird_seen = true 
   AND (p.early_bird_redeemed IS NULL OR p.early_bird_redeemed = false)
   AND public.is_trial_active(p.user_id)) AS early_bird_eligible,
  COALESCE(s.tier, 'free') AS subscription_tier,
  s.status AS subscription_status,
  s.is_lifetime,
  s.current_period_end,
  public.is_trial_active(p.user_id) AS is_trial_active,
  (SELECT count(*) FROM public.fortunes f WHERE f.user_id = p.user_id) AS total_fortunes,
  CASE
    -- Lifetime: must have is_lifetime=true AND status='active'
    WHEN s.is_lifetime = true AND s.status = 'active' THEN true
    -- Recurring: status must be 'active' or 'trialing' (not 'past_due' or 'canceled')
    WHEN s.status = 'active' OR s.status = 'trialing' THEN true
    -- Trial access
    WHEN public.is_trial_active(p.user_id) THEN true
    ELSE false
  END AS has_full_access
FROM public.profiles p
LEFT JOIN public.subscriptions s
  ON s.user_id = p.user_id
  -- Only join subscriptions that are potentially active (excludes canceled, past_due unless lifetime)
  AND (
    (s.is_lifetime = true AND s.status = 'active')
    OR s.status IN ('active', 'trialing')
  );

-- Quita permisos por defecto y da SELECT a 'authenticated'
REVOKE ALL ON public.user_features FROM PUBLIC;
GRANT SELECT ON public.user_features TO authenticated;
