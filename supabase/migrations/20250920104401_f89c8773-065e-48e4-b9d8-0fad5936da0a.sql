-- Add mood tracking columns to lifestyle_entries
ALTER TABLE public.lifestyle_entries 
ADD COLUMN IF NOT EXISTS mood_set_at TIMESTAMP WITH TIME ZONE;

-- Create daily_log table for streak tracking
CREATE TABLE IF NOT EXISTS public.daily_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  date DATE NOT NULL,
  first_action_at TIMESTAMP WITH TIME ZONE NOT NULL,
  first_action_source TEXT NOT NULL CHECK (first_action_source IN ('fortune', 'know', 'mood')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);

-- Enable RLS on daily_log table
ALTER TABLE public.daily_log ENABLE ROW LEVEL SECURITY;

-- Create policies for daily_log
CREATE POLICY "Users can view their own daily logs"
ON public.daily_log
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own daily logs"
ON public.daily_log
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own daily logs"
ON public.daily_log
FOR UPDATE
USING (auth.uid() = user_id);

-- Create RPC function to set daily mood
CREATE OR REPLACE FUNCTION public.set_daily_mood(
  mood_value text,
  event_ts timestamptz DEFAULT now(),
  timezone_arg text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_id_val uuid;
  user_timezone text;
  local_date date;
  result jsonb;
BEGIN
  -- Get current user
  user_id_val := auth.uid();
  IF user_id_val IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get user timezone from profiles, fallback to provided timezone or UTC
  SELECT COALESCE(timezone_arg, 'UTC') INTO user_timezone;
  
  -- Calculate local date
  local_date := (event_ts AT TIME ZONE user_timezone)::date;

  -- Upsert mood in lifestyle_entries
  INSERT INTO public.lifestyle_entries (user_id, date, mood, mood_set_at, created_at)
  VALUES (user_id_val, local_date, mood_value, event_ts, now())
  ON CONFLICT (user_id, date)
  DO UPDATE SET 
    mood = EXCLUDED.mood,
    mood_set_at = EXCLUDED.mood_set_at,
    updated_at = now();

  -- Track daily action and get streak info
  SELECT public.track_daily_action('mood', event_ts, timezone_arg) INTO result;

  RETURN result;
END;
$$;

-- Create RPC function to track daily actions and calculate streaks
CREATE OR REPLACE FUNCTION public.track_daily_action(
  source_type text,
  event_ts timestamptz DEFAULT now(),
  timezone_arg text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_id_val uuid;
  user_timezone text;
  local_date date;
  is_first_of_day boolean := false;
  current_streak int := 0;
  longest_streak int := 0;
  streak_start date;
  streak_end date;
  check_date date;
BEGIN
  -- Get current user
  user_id_val := auth.uid();
  IF user_id_val IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get user timezone, fallback to UTC
  SELECT COALESCE(timezone_arg, 'UTC') INTO user_timezone;
  
  -- Calculate local date
  local_date := (event_ts AT TIME ZONE user_timezone)::date;

  -- Check if this is the first action of the day
  INSERT INTO public.daily_log (user_id, date, first_action_at, first_action_source)
  VALUES (user_id_val, local_date, event_ts, source_type)
  ON CONFLICT (user_id, date) DO NOTHING
  RETURNING date INTO streak_start;

  -- If we got a return value, this was the first action of the day
  is_first_of_day := (streak_start IS NOT NULL);

  -- Calculate current streak (consecutive days up to today)
  current_streak := 0;
  check_date := local_date;
  
  WHILE EXISTS (
    SELECT 1 FROM public.daily_log 
    WHERE user_id = user_id_val AND date = check_date
  ) LOOP
    current_streak := current_streak + 1;
    check_date := check_date - interval '1 day';
  END LOOP;

  -- Calculate longest streak ever
  WITH streak_groups AS (
    SELECT 
      date,
      date - (row_number() OVER (ORDER BY date))::int * interval '1 day' as grp
    FROM public.daily_log 
    WHERE user_id = user_id_val
    ORDER BY date
  ),
  streak_lengths AS (
    SELECT 
      grp,
      count(*) as streak_length
    FROM streak_groups 
    GROUP BY grp
  )
  SELECT COALESCE(MAX(streak_length), 0) INTO longest_streak FROM streak_lengths;

  RETURN jsonb_build_object(
    'firstOfDay', is_first_of_day,
    'currentStreak', current_streak,
    'longestStreak', longest_streak
  );
END;
$$;