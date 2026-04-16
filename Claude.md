# Weather Pulse

## Project Overview
Weather Pulse is a multi-service weather dashboard built for a Week 4-style distributed system project.

Architecture:
Open-Meteo API -> Railway Worker -> Supabase (Postgres + Auth + Realtime) -> Next.js Frontend on Vercel

This project is a system, not just a single app:
- the worker runs independently on Railway
- the frontend runs independently on Vercel
- Supabase is the shared state layer
- the frontend never calls the weather API directly
- users should see updates without manually refreshing the page

## Product Goals
Build a weather dashboard where:
- users can sign up, sign in, and sign out
- users can save favorite cities
- logged-in users see weather cards only for their saved cities
- logged-out users see a default public city list
- current weather updates automatically when the worker writes new data
- the frontend receives updates through Supabase Realtime
- the worker polls weather data on a schedule and upserts it into Supabase

## Monorepo Structure
/
  CLAUDE.md
  apps/
    web/        # Next.js frontend -> deploy to Vercel
    worker/     # Node.js background worker -> deploy to Railway

## Tech Stack
Frontend:
- Next.js
- TypeScript
- Tailwind CSS
- Supabase JS client

Backend / Data:
- Supabase Postgres
- Supabase Auth
- Supabase Realtime

Worker:
- Node.js
- @supabase/supabase-js
- fetch to Open-Meteo API

Deployment:
- Vercel for apps/web
- Railway for apps/worker

## Data Model

### locations
Stores canonical city/location data.

Columns:
- id uuid primary key default gen_random_uuid()
- name text not null
- country text
- latitude numeric not null
- longitude numeric not null
- timezone text not null
- created_at timestamptz default now()

Constraints:
- unique(name, country, latitude, longitude)

### favorite_locations
Stores which cities each user follows.

Columns:
- user_id uuid not null references auth.users(id) on delete cascade
- location_id uuid not null references public.locations(id) on delete cascade
- created_at timestamptz default now()

Constraints:
- primary key (user_id, location_id)

### current_weather
Stores the latest weather snapshot for each location.

Columns:
- location_id uuid primary key references public.locations(id) on delete cascade
- temperature_c numeric
- apparent_temperature_c numeric
- relative_humidity integer
- wind_speed_kmh numeric
- precipitation numeric
- weather_code integer
- is_day boolean
- observed_at timestamptz
- updated_at timestamptz default now()

## RLS Rules
### locations
- readable by everyone
- no client-side insert/update/delete

### current_weather
- readable by everyone
- no client-side insert/update/delete

### favorite_locations
- authenticated users can read only their own rows
- authenticated users can insert only rows with user_id = auth.uid()
- authenticated users can delete only their own rows

## Realtime
Enable Realtime on:
- current_weather

Frontend subscribes to changes on:
- public.current_weather

Use the classroom-style pattern:
- initial fetch for current state
- subscribe for future changes
- cleanup subscription on unmount

## Frontend Requirements
### Public behavior
- if the user is not logged in, show a default list of cities
- show current temperature, feels like, humidity, wind speed, weather state, and last updated time

### Authenticated behavior
- show only the user's favorite cities
- allow users to add/remove favorite cities
- include pages or sections for:
  - Home / Dashboard
  - My Cities
  - Sign In / Sign Out

### UI behavior
- use responsive cards
- top section: app title + auth controls
- left/main area: weather cards
- right/secondary area: city picker / saved cities
- show loading, empty state, and error state
- clearly show when data was last updated

## Worker Requirements
The worker runs independently from users.

Responsibilities:
1. load all cities from public.locations
2. request weather data from Open-Meteo for each city
3. normalize the response
4. upsert into public.current_weather using location_id
5. log success/failure
6. repeat on a schedule

Worker must:
- use SUPABASE_SERVICE_ROLE_KEY
- never expose service-role credentials to the frontend
- continue running even if one fetch fails
- use upsert instead of insert
- avoid crashing on temporary API failures

Recommended default polling interval:
- 10 minutes (POLL_INTERVAL_MS=600000)

## Environment Variables

### apps/web/.env.local
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

### apps/worker/.env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
OPEN_METEO_BASE_URL=https://api.open-meteo.com/v1/forecast
POLL_INTERVAL_MS=600000

## Local Development Commands

### web
cd apps/web
npm install
npm run dev

### worker
cd apps/worker
npm install
npm run dev

## Suggested Worker Package Scripts
In apps/worker/package.json use:
- "start": "node index.js"
- "dev": "node --watch index.js"

## Deployment Rules
### Vercel
- deploy apps/web only
- set root directory to apps/web
- add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY

### Railway
- deploy apps/worker only
- set root directory to apps/worker
- add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
- worker runs as a long-running process

## Important Safety Rules
- never put service role keys in NEXT_PUBLIC variables
- never import worker secrets into the frontend
- keep worker and frontend loosely coupled through Supabase only
- no hardcoded secrets in the repo
- all schema changes should update this CLAUDE.md

## Implementation Guidance for Claude
When working on this repo:
1. preserve the monorepo structure
2. keep frontend and worker independent
3. prefer small, reviewable changes
4. if adding a new weather field:
   - update schema
   - update worker normalization
   - update frontend types and UI
5. when debugging missing live updates, check:
   - worker logs
   - current_weather writes
   - Realtime enabled on the table
   - frontend subscription code
6. when debugging auth issues, check RLS policies first
7. use upsert for weather snapshots keyed by location_id
8. keep the UI simple, clean, and responsive