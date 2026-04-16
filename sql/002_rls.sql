alter table public.locations enable row level security;
alter table public.current_weather enable row level security;
alter table public.daily_forecasts enable row level security;
alter table public.hourly_forecasts enable row level security;
alter table public.favorite_locations enable row level security;
alter table public.user_preferences enable row level security;
alter table public.alert_rules enable row level security;
alter table public.sync_runs enable row level security;

create policy "locations_select_public" on public.locations
for select
using (true);

create policy "current_weather_select_public" on public.current_weather
for select
using (true);

create policy "daily_forecasts_select_public" on public.daily_forecasts
for select
using (true);

create policy "hourly_forecasts_select_public" on public.hourly_forecasts
for select
using (true);

create policy "favorite_locations_select_own" on public.favorite_locations
for select
to authenticated
using (auth.uid() = user_id);

create policy "favorite_locations_insert_own" on public.favorite_locations
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "favorite_locations_delete_own" on public.favorite_locations
for delete
to authenticated
using (auth.uid() = user_id);

create policy "user_preferences_select_own" on public.user_preferences
for select
to authenticated
using (auth.uid() = user_id);

create policy "user_preferences_insert_own" on public.user_preferences
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "user_preferences_update_own" on public.user_preferences
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "user_preferences_delete_own" on public.user_preferences
for delete
to authenticated
using (auth.uid() = user_id);

create policy "alert_rules_select_own" on public.alert_rules
for select
to authenticated
using (auth.uid() = user_id);

create policy "alert_rules_insert_own" on public.alert_rules
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "alert_rules_update_own" on public.alert_rules
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "alert_rules_delete_own" on public.alert_rules
for delete
to authenticated
using (auth.uid() = user_id);

create policy "sync_runs_select_public" on public.sync_runs
for select
using (true);

grant usage on schema public to anon, authenticated;
grant select on table public.locations to anon, authenticated;
grant select on table public.current_weather to anon, authenticated;
grant select on table public.daily_forecasts to anon, authenticated;
grant select on table public.hourly_forecasts to anon, authenticated;
grant select, insert, delete on table public.favorite_locations to authenticated;
grant select, insert, update, delete on table public.user_preferences to authenticated;
grant select, insert, update, delete on table public.alert_rules to authenticated;
grant select on table public.sync_runs to anon, authenticated;
