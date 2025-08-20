-- Add trial_ends_at, early_bird_seen, early_bird_redeemed to profiles if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'trial_ends_at') THEN
    ALTER TABLE public.profiles ADD COLUMN trial_ends_at TIMESTAMPTZ;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'early_bird_seen') THEN
    ALTER TABLE public.profiles ADD COLUMN early_bird_seen BOOLEAN DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'early_bird_redeemed') THEN
    ALTER TABLE public.profiles ADD COLUMN early_bird_redeemed BOOLEAN DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'stripe_customer_id') THEN
    ALTER TABLE public.profiles ADD COLUMN stripe_customer_id TEXT;
  END IF;
END $$;

-- Update subscriptions table structure
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscriptions' AND column_name = 'tier') THEN
    ALTER TABLE public.subscriptions ADD COLUMN tier TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscriptions' AND column_name = 'is_lifetime') THEN
    ALTER TABLE public.subscriptions ADD COLUMN is_lifetime BOOLEAN DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscriptions' AND column_name = 'stripe_price_id') THEN
    ALTER TABLE public.subscriptions ADD COLUMN stripe_price_id TEXT;
  END IF;
END $$;

-- Asegura RLS activado
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Limpia políticas previas por si existen
DROP POLICY IF EXISTS "profiles read own" ON public.profiles;
DROP POLICY IF EXISTS "profiles update own flags" ON public.profiles;

DROP POLICY IF EXISTS "Service role can manage all subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can read own subscriptions only" ON public.subscriptions;
DROP POLICY IF EXISTS "Deny user modifications" ON public.subscriptions;
DROP POLICY IF EXISTS "Deny user modifications u" ON public.subscriptions;
DROP POLICY IF EXISTS "Deny user modifications d" ON public.subscriptions;
DROP POLICY IF EXISTS "Deny anonymous access" ON public.subscriptions;

-- PROFILES: leer solo lo propio
CREATE POLICY "profiles read own"
ON public.profiles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- PROFILES: actualizar solo flags propios (p.ej. early_bird_seen)
CREATE POLICY "profiles update own flags"
ON public.profiles
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- SUBSCRIPTIONS: service_role todo (webhooks)
CREATE POLICY "Service role can manage all subscriptions"
ON public.subscriptions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- SUBSCRIPTIONS: usuarios solo SELECT de lo suyo
CREATE POLICY "Users can read own subscriptions only"
ON public.subscriptions
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- SUBSCRIPTIONS: deniega modificaciones a usuarios normales
CREATE POLICY "Deny user modifications"
ON public.subscriptions
FOR INSERT TO authenticated
WITH CHECK (false);

CREATE POLICY "Deny user modifications u"
ON public.subscriptions
FOR UPDATE TO authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "Deny user modifications d"
ON public.subscriptions
FOR DELETE TO authenticated
USING (false);

-- Índices útiles
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);

-- Función de trial estable (no SECURITY DEFINER; usamos RLS en tablas)
CREATE OR REPLACE FUNCTION public.is_trial_active(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT
    (now() < p.trial_ends_at)
    AND (
      (SELECT count(*) FROM public.fortunes f WHERE f.user_id = p_user_id) < 100
    )
  FROM public.profiles p
  WHERE p.user_id = p_user_id;
$$;

-- View derivada sin RLS (con GRANTS)
CREATE OR REPLACE VIEW public.user_features
AS
SELECT
  p.user_id,
  p.trial_ends_at,
  p.early_bird_seen,
  p.early_bird_redeemed,
  COALESCE(s.tier, 'free') AS subscription_tier,
  s.status AS subscription_status,
  s.is_lifetime,
  s.current_period_end,
  public.is_trial_active(p.user_id) AS is_trial_active,
  (SELECT count(*) FROM public.fortunes f WHERE f.user_id = p.user_id) AS total_fortunes,
  CASE
    WHEN s.status = 'active' OR s.is_lifetime = true THEN true
    WHEN public.is_trial_active(p.user_id) THEN true
    ELSE false
  END AS has_full_access
FROM public.profiles p
LEFT JOIN public.subscriptions s
  ON s.user_id = p.user_id
 AND (s.status = 'active' OR s.is_lifetime = true);

-- Quita permisos por defecto y da SELECT a 'authenticated'
REVOKE ALL ON public.user_features FROM PUBLIC;
GRANT SELECT ON public.user_features TO authenticated;

-- Trigger de usuario nuevo (actualizado)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, trial_ends_at)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'display_name',
    timezone('utc', now()) + INTERVAL '60 days'
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;