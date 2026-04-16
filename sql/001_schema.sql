create extension if not exists pgcrypto;

create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country text,
  latitude numeric not null,
  longitude numeric not null,
  timezone text not null,
  created_at timestamptz not null default now(),
  unique (name, country, latitude, longitude)
);

create table if not exists public.favorite_locations (
  user_id uuid not null references auth.users(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, location_id)
);

create table if not exists public.current_weather (
  location_id uuid primary key references public.locations(id) on delete cascade,
  temperature_c numeric,
  apparent_temperature_c numeric,
  relative_humidity integer,
  wind_speed_kmh numeric,
  precipitation numeric,
  weather_code integer,
  is_day boolean,
  observed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  temperature_unit text not null default 'c' check (temperature_unit in ('c', 'f')),
  wind_speed_unit text not null default 'kmh' check (wind_speed_unit in ('kmh', 'mph')),
  default_location_id uuid references public.locations(id) on delete set null,
  timezone_display text not null default 'location' check (timezone_display in ('location', 'utc')),
  time_format text not null default '24h' check (time_format in ('12h', '24h')),
  alerts_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.daily_forecasts (
  location_id uuid not null references public.locations(id) on delete cascade,
  forecast_date date not null,
  temp_max_c numeric,
  temp_min_c numeric,
  precipitation_sum_mm numeric,
  precipitation_probability_max integer,
  wind_speed_max_kmh numeric,
  weather_code integer,
  sunrise timestamp,
  sunset timestamp,
  uv_index_max numeric,
  updated_at timestamptz not null default now(),
  primary key (location_id, forecast_date)
);

create table if not exists public.hourly_forecasts (
  location_id uuid not null references public.locations(id) on delete cascade,
  forecast_time timestamptz not null,
  temperature_c numeric,
  precipitation_probability integer,
  wind_speed_kmh numeric,
  weather_code integer,
  is_day boolean,
  updated_at timestamptz not null default now(),
  primary key (location_id, forecast_time)
);

create table if not exists public.alert_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  location_id uuid references public.locations(id) on delete cascade,
  rule_type text not null check (rule_type in ('precipitation', 'temperature_max', 'wind_speed')),
  comparator text not null check (comparator in ('gt', 'gte', 'lt', 'lte')),
  threshold numeric not null,
  horizon_days integer not null default 3 check (horizon_days between 1 and 15),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists alert_rules_user_id_idx on public.alert_rules(user_id);
create index if not exists alert_rules_location_id_idx on public.alert_rules(location_id);

create table if not exists public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running', 'success', 'partial', 'failed')),
  locations_total integer not null default 0,
  locations_ok integer not null default 0,
  locations_failed integer not null default 0,
  poll_interval_ms integer,
  open_meteo_base_url text,
  source_http_status integer,
  error_message text,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_current_weather_updated_at on public.current_weather;
create trigger set_current_weather_updated_at
before update on public.current_weather
for each row execute function public.set_updated_at();

drop trigger if exists set_daily_forecasts_updated_at on public.daily_forecasts;
create trigger set_daily_forecasts_updated_at
before update on public.daily_forecasts
for each row execute function public.set_updated_at();

drop trigger if exists set_hourly_forecasts_updated_at on public.hourly_forecasts;
create trigger set_hourly_forecasts_updated_at
before update on public.hourly_forecasts
for each row execute function public.set_updated_at();

drop trigger if exists set_user_preferences_updated_at on public.user_preferences;
create trigger set_user_preferences_updated_at
before update on public.user_preferences
for each row execute function public.set_updated_at();

drop trigger if exists set_alert_rules_updated_at on public.alert_rules;
create trigger set_alert_rules_updated_at
before update on public.alert_rules
for each row execute function public.set_updated_at();

do $$
begin
  alter publication supabase_realtime add table public.current_weather;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.sync_runs;
exception
  when duplicate_object then null;
end $$;
