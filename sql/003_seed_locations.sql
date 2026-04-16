insert into public.locations (name, country, latitude, longitude, timezone)
values
  ('New York', 'US', 40.7128, -74.0060, 'America/New_York'),
  ('London', 'GB', 51.5072, -0.1276, 'Europe/London'),
  ('Tokyo', 'JP', 35.6762, 139.6503, 'Asia/Tokyo'),
  ('Sydney', 'AU', -33.8688, 151.2093, 'Australia/Sydney'),
  ('Beijing', 'CN', 39.9042, 116.4074, 'Asia/Shanghai')
on conflict do nothing;

