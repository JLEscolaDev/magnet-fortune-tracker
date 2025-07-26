-- Diagnostics: Check for legacy foreign key relationships
DO $$
DECLARE
    wrong_fortunes_count INTEGER;
    wrong_categories_count INTEGER;
    wrong_reflections_count INTEGER;
BEGIN
    -- Detect legacy rows where fortunes.user_id equals profiles.id instead of auth user_id
    SELECT count(*) INTO wrong_fortunes_count
    FROM fortunes f JOIN profiles p ON f.user_id = p.id;
    
    RAISE NOTICE 'Wrong fortunes count: %', wrong_fortunes_count;
    
    -- Check custom_categories
    SELECT count(*) INTO wrong_categories_count
    FROM custom_categories c JOIN profiles p ON c.user_id = p.id;
    
    RAISE NOTICE 'Wrong categories count: %', wrong_categories_count;
    
    -- Check reflections
    SELECT count(*) INTO wrong_reflections_count
    FROM reflections r JOIN profiles p ON r.user_id = p.id;
    
    RAISE NOTICE 'Wrong reflections count: %', wrong_reflections_count;
END $$;

-- Data normalization
create extension if not exists pgcrypto;

-- Ensure profiles table has proper defaults
alter table profiles alter column id set default gen_random_uuid();
alter table profiles alter column created_at set default now();
alter table profiles alter column updated_at set default now();

-- Create unique index on user_id
create unique index if not exists profiles_user_id_unique on profiles(user_id);

-- Backfill: rewrite old foreign keys from profile.id -> profile.user_id
update fortunes f
set user_id = p.user_id
from profiles p
where f.user_id = p.id;

update custom_categories c
set user_id = p.user_id
from profiles p
where c.user_id = p.id;

update reflections r
set user_id = p.user_id
from profiles p
where r.user_id = p.id;

-- RLS Policies

-- PROFILES
alter table profiles enable row level security;
drop policy if exists "read own profile" on profiles;
drop policy if exists "insert own profile" on profiles;
drop policy if exists "update own profile" on profiles;
drop policy if exists "Profiles are viewable by everyone" on profiles;
drop policy if exists "Users can insert their own profile" on profiles;
drop policy if exists "Users can update their own profile" on profiles;

create policy "read own profile" on profiles
for select using (user_id = auth.uid());

create policy "insert own profile" on profiles
for insert with check (user_id = auth.uid());

create policy "update own profile" on profiles
for update using (user_id = auth.uid());

-- FORTUNES
alter table fortunes enable row level security;
drop policy if exists "read own fortunes" on fortunes;
drop policy if exists "insert own fortunes" on fortunes;
drop policy if exists "update own fortunes" on fortunes;
drop policy if exists "user_owns_row" on fortunes;

create policy "read own fortunes" on fortunes
for select using (user_id = auth.uid());

create policy "insert own fortunes" on fortunes
for insert with check (user_id = auth.uid());

create policy "update own fortunes" on fortunes
for update using (user_id = auth.uid());

-- CUSTOM CATEGORIES
alter table custom_categories enable row level security;
drop policy if exists "read own categories" on custom_categories;
drop policy if exists "insert own categories" on custom_categories;
drop policy if exists "update own categories" on custom_categories;
drop policy if exists "delete own categories" on custom_categories;
drop policy if exists "Only owner can access their categories" on custom_categories;

create policy "read own categories" on custom_categories
for select using (user_id = auth.uid());

create policy "insert own categories" on custom_categories
for insert with check (user_id = auth.uid());

create policy "update own categories" on custom_categories
for update using (user_id = auth.uid());

create policy "delete own categories" on custom_categories
for delete using (user_id = auth.uid());

-- REFLECTIONS
alter table reflections enable row level security;
drop policy if exists "rw own reflections" on reflections;
drop policy if exists "Users can create their own reflections" on reflections;
drop policy if exists "Users can delete their own reflections" on reflections;
drop policy if exists "Users can update their own reflections" on reflections;
drop policy if exists "Users can view their own reflections" on reflections;

create policy "rw own reflections" on reflections
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- SUBSCRIPTIONS: read-only for client; writes via service role
alter table subscriptions enable row level security;
drop policy if exists "read own subscriptions" on subscriptions;
drop policy if exists "Users can view their own subscriptions" on subscriptions;

create policy "read own subscriptions" on subscriptions
for select using (user_id = auth.uid());

-- Keep existing service role policy for subscriptions (drop and recreate)
drop policy if exists "Service role can manage all subscriptions" on subscriptions;
create policy "Service role can manage all subscriptions" on subscriptions
for all using ((auth.jwt() ->> 'role'::text) = 'service_role'::text)
with check ((auth.jwt() ->> 'role'::text) = 'service_role'::text);

-- Timestamp trigger for updated_at on profiles
create or replace function trigger_set_timestamp() returns trigger as $$
begin 
    new.updated_at = now(); 
    return new; 
end; 
$$ language plpgsql;

drop trigger if exists set_timestamp_on_profiles on profiles;
create trigger set_timestamp_on_profiles
before update on profiles
for each row execute function trigger_set_timestamp();