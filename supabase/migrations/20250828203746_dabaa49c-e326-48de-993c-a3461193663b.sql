-- Drop existing fortune_list functions and recreate them with impact_level support
DROP FUNCTION IF EXISTS public.fortune_list();
DROP FUNCTION IF EXISTS public.fortune_list(timestamp with time zone, timestamp with time zone);

-- Recreate fortune_list function without parameters, including impact_level
CREATE OR REPLACE FUNCTION public.fortune_list()
 RETURNS TABLE(id uuid, user_id uuid, text text, category text, created_at timestamp with time zone, fortune_level integer, impact_level fortune_impact_level)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'private'
AS $function$
  with cur as (
    select value as k from private.app_secrets where key = 'enc_key' limit 1
  ),
  raw as (
    select
      f.id,
      f.user_id,
      coalesce(
        public.try_decrypt_with_key(f.text,(select k from cur)),
        public.try_decrypt_with_derived(f.text,f.user_id),
        f.text
      ) as raw_text,
      f.category,
      f.created_at,
      f.fortune_level,
      f.impact_level
    from public.fortunes f
    where f.user_id = auth.uid()
  )
  select
    id,
    user_id,
    coalesce(public.try_base64_text(raw_text), raw_text) as text,
    category,
    created_at,
    fortune_level,
    impact_level
  from raw
  order by created_at desc;
$function$;

-- Recreate fortune_list function with date range parameters, including impact_level
CREATE OR REPLACE FUNCTION public.fortune_list(p_from timestamp with time zone, p_to timestamp with time zone)
 RETURNS TABLE(id uuid, user_id uuid, text text, category text, created_at timestamp with time zone, fortune_level integer, impact_level fortune_impact_level)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'private'
AS $function$
  with cur as (
    select value as k from private.app_secrets where key = 'enc_key' limit 1
  ),
  raw as (
    select
      f.id,
      f.user_id,
      coalesce(
        public.try_decrypt_with_key(f.text,(select k from cur)),
        public.try_decrypt_with_derived(f.text,f.user_id),
        f.text
      ) as raw_text,
      f.category,
      f.created_at,
      f.fortune_level,
      f.impact_level
    from public.fortunes f
    where f.user_id = auth.uid()
      and (p_from is null or f.created_at >= p_from)
      and (p_to   is null or f.created_at <  p_to)
  )
  select
    id, user_id,
    coalesce(public.try_base64_text(raw_text), raw_text) as text,
    category, created_at, fortune_level, impact_level
  from raw
  order by created_at desc;
$function$;