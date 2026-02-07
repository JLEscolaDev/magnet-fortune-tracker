-- Aggregate community benchmarks for reports
create or replace function public.report_global_averages(p_start date, p_end date)
returns table (
  entries_total bigint,
  avg_energy numeric,
  avg_dream numeric,
  avg_sickness numeric,
  avg_appetite numeric,
  avg_performance numeric,
  mood_good bigint,
  mood_very_good bigint,
  mood_neutral bigint,
  mood_bad bigint,
  mood_very_bad bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  has_performance boolean;
begin
  if auth.role() is distinct from 'authenticated' then
    raise exception 'unauthorized';
  end if;

  select exists(
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'lifestyle_entries'
      and column_name = 'sexual_performance'
  ) into has_performance;

  if has_performance then
    execute '
      select
        count(*),
        avg(energy_level),
        avg(dream_quality),
        avg(sickness_level),
        avg(sexual_appetite),
        avg(sexual_performance)
      from public.lifestyle_entries
      where date >= $1 and date <= $2
    '
    into entries_total, avg_energy, avg_dream, avg_sickness, avg_appetite, avg_performance
    using p_start, p_end;
  else
    execute '
      select
        count(*),
        avg(energy_level),
        avg(dream_quality),
        avg(sickness_level),
        avg(sexual_appetite)
      from public.lifestyle_entries
      where date >= $1 and date <= $2
    '
    into entries_total, avg_energy, avg_dream, avg_sickness, avg_appetite
    using p_start, p_end;
    avg_performance := null;
  end if;

  select
    count(*) filter (where mood ilike '%very_good%' or mood ilike '%very good%'),
    count(*) filter (where mood ilike '%good%' and mood not ilike '%very%'),
    count(*) filter (where mood ilike '%neutral%' or mood ilike '%okay%'),
    count(*) filter (where mood ilike '%very_bad%' or mood ilike '%very bad%'),
    count(*) filter (where mood ilike '%bad%' and mood not ilike '%very%')
  into mood_very_good, mood_good, mood_neutral, mood_very_bad, mood_bad
  from public.lifestyle_entries
  where date >= p_start and date <= p_end;

  return next;
end;
$$;

grant execute on function public.report_global_averages(date, date) to anon, authenticated;
