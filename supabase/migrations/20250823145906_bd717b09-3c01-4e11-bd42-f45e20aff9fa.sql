-- Phase 1: Critical Database Security Fixes

-- 1. Secure the app_secrets table with RLS
ALTER TABLE IF EXISTS private.app_secrets ENABLE ROW LEVEL SECURITY;

-- Create restrictive policy for app_secrets (service role only)
DROP POLICY IF EXISTS "service_role_only" ON private.app_secrets;
CREATE POLICY "service_role_only" ON private.app_secrets
  FOR ALL USING (auth.role() = 'service_role');

-- 2. Fix database function security by adding SET search_path TO 'public'

-- Update update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Update trigger_set_timestamp function
CREATE OR REPLACE FUNCTION public.trigger_set_timestamp()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ 
BEGIN 
    NEW.updated_at = now(); 
    RETURN NEW; 
END; 
$function$;

-- Update is_trial_active function
CREATE OR REPLACE FUNCTION public.is_trial_active(p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    (now() < p.trial_ends_at)
    AND (
      (SELECT count(*) FROM public.fortunes f WHERE f.user_id = p_user_id) < 100
    )
  FROM public.profiles p
  WHERE p.user_id = p_user_id;
$function$;

-- Update handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles(user_id, display_name, level, total_fortunes, trial_ends_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    1,
    0,
    timezone('utc', now()) + interval '60 days'
  )
  on conflict (user_id) do nothing;
  return new;
end;
$function$;

-- Update fortune_get function
CREATE OR REPLACE FUNCTION public.fortune_get(_id uuid)
 RETURNS TABLE(id uuid, text text, category text, created_at timestamp with time zone, fortune_level integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  _salt text := public.get_enc_salt();
begin
  return query
  select
    f.id,
    convert_from(
      pgsodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
        decode(f.text, 'base64'),
        null,
        pgsodium.crypto_generichash((f.id::text   || _salt)::bytea, 24),
        pgsodium.crypto_generichash((f.user_id::text || _salt)::bytea, 32)
      ),
      'utf8'
    ),
    f.category,
    f.created_at,
    f.fortune_level
  from public.fortunes f
  where f.id = _id and f.user_id = auth.uid();
end
$function$;

-- Update fortune_put function
CREATE OR REPLACE FUNCTION public.fortune_put(p_text text, p_category text DEFAULT NULL::text, p_fortune_level integer DEFAULT 0, p_created_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_key     text;
  v_id      uuid;
begin
  if v_user_id is null then
    raise exception 'not authorized';
  end if;

  select value into v_key from app_secrets where key='enc_key';
  if v_key is null then
    raise exception 'enc_key missing';
  end if;

  insert into public.fortunes(id, user_id, text, category, created_at, fortune_level)
  values (
    gen_random_uuid(),
    v_user_id,
    encode(pgp_sym_encrypt(p_text, v_key), 'base64'),  -- bytea -> base64 text
    p_category,
    coalesce(p_created_at, now()),
    coalesce(p_fortune_level, 0)
  )
  returning fortunes.id into v_id;

  return jsonb_build_object('success', true, 'id', v_id);
exception when others then
  return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$function$;

-- Update fortune_encrypt_bi function
CREATE OR REPLACE FUNCTION public.fortune_encrypt_bi()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  k text;
  _tmp text;
begin
  if new.text is null then
    return new;
  end if;

  -- si ya está en base64 de un pgp, intentar descifrar:
  begin
    k := public._enc_key_for(coalesce(new.user_id, auth.uid()));
    _tmp := pgp_sym_decrypt(decode(new.text,'base64'), k);
    -- si no lanza excepción, ya estaba cifrado -> no tocar
    return new;
  exception when others then
    -- venía en claro -> ciframos
    k := public._enc_key_for(coalesce(new.user_id, auth.uid()));
    new.text := encode(pgp_sym_encrypt(new.text, k), 'base64');
    return new;
  end;
end
$function$;

-- Update fortune_list function
CREATE OR REPLACE FUNCTION public.fortune_list(p_from timestamp with time zone, p_to timestamp with time zone)
 RETURNS TABLE(id uuid, user_id uuid, text text, category text, created_at timestamp with time zone, fortune_level integer)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    f.id,
    f.user_id,
    convert_from(
      pgp_sym_decrypt(
        decode(f.text, 'base64'),
        (select value from app_secrets where key='enc_key')
      )::bytea,
      'utf8'
    ) as text,
    f.category,
    f.created_at,
    f.fortune_level
  from public.fortunes f
  where f.user_id = auth.uid()
    and (p_from is null or f.created_at >= p_from)
    and (p_to   is null or f.created_at <  p_to)
  order by f.created_at desc;
$function$;

-- Update fortune_decrypt function
CREATE OR REPLACE FUNCTION public.fortune_decrypt(_id uuid)
 RETURNS TABLE(id uuid, text text, category text, fortune_level integer, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r record;
  _salt  text  := public.get_enc_salt();
  _key   bytea;
  _nonce bytea;
begin
  select * into r
  from public.fortunes
  where id = _id and user_id = auth.uid();  -- owner-only

  if not found then
    raise exception 'Not found or not yours';
  end if;

  _key   := digest((r.user_id::text || _salt)::bytea, 'sha256');
  _nonce := substr(digest((r.id::text || _salt)::bytea, 'md5')::bytea, 1, 16);

  return query
  select
    r.id,
    convert_from(
      decrypt_iv(
        decode(r.text, 'base64'),
        _key,
        _nonce,
        'aes-cbc'
      ),
      'utf8'
    ) as text,
    r.category,
    r.fortune_level,
    r.created_at;
end
$function$;

-- Update fortune_counts function  
CREATE OR REPLACE FUNCTION public.fortune_counts()
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with me as (select auth.uid() uid),
  t as (select count(*)::int total from public.fortunes f join me on f.user_id = me.uid),
  d as (
    select count(*)::int today
    from public.fortunes f join me on f.user_id = me.uid
    where f.created_at >= date_trunc('day', now() at time zone 'UTC')
      and f.created_at <  date_trunc('day', now() at time zone 'UTC') + interval '1 day'
  )
  select jsonb_build_object('total', t.total, 'today', d.today) from t,d;
$function$;

-- Update derive_passphrase function
CREATE OR REPLACE FUNCTION public.derive_passphrase()
 RETURNS text
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select encode(
    digest(
      convert_to(auth.uid()::text || (select value from private.app_secrets where key='enc_salt'),'UTF8'),
      'sha256'
    ),
    'hex'
  );
$function$;

-- Update _enc_key_for function
CREATE OR REPLACE FUNCTION public._enc_key_for(uid uuid)
 RETURNS text
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select encode(
    digest(
      convert_to(uid::text || (select value from app_secrets where key='enc_salt'),'utf8'),
      'sha256'
    ),
    'hex'
  );
$function$;