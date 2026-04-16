const dotenv = require("dotenv");
const { createClient } = require("@supabase/supabase-js");

dotenv.config({ path: ".env.local" });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPEN_METEO_BASE_URL =
  process.env.OPEN_METEO_BASE_URL ?? "https://api.open-meteo.com/v1/forecast";
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS ?? "600000");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in apps/worker/.env.local"
  );
}

if (!Number.isFinite(POLL_INTERVAL_MS) || POLL_INTERVAL_MS <= 0) {
  throw new Error("POLL_INTERVAL_MS must be a positive number");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function loadLocations() {
  const result = await supabase
    .from("locations")
    .select("id,name,latitude,longitude,timezone");

  if (result.error) throw result.error;
  return result.data ?? [];
}

async function fetchWeatherBundle({ latitude, longitude, timezone }) {
  const url = new URL(OPEN_METEO_BASE_URL);
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set(
    "current",
    [
      "temperature_2m",
      "apparent_temperature",
      "relative_humidity_2m",
      "wind_speed_10m",
      "precipitation",
      "weather_code",
      "is_day",
    ].join(",")
  );
  url.searchParams.set(
    "hourly",
    [
      "temperature_2m",
      "precipitation_probability",
      "wind_speed_10m",
      "weather_code",
      "is_day",
    ].join(",")
  );
  url.searchParams.set(
    "daily",
    [
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_sum",
      "precipitation_probability_max",
      "wind_speed_10m_max",
      "weather_code",
      "sunrise",
      "sunset",
      "uv_index_max",
    ].join(",")
  );
  url.searchParams.set("forecast_days", "15");
  url.searchParams.set("forecast_hours", "24");
  url.searchParams.set("timezone", "UTC");

  const response = await fetch(url.toString());
  if (!response.ok) {
    const err = new Error(
      `Open-Meteo error: ${response.status} ${response.statusText}`
    );
    err.status = response.status;
    throw err;
  }

  const json = await response.json();
  const current = json.current;
  if (!current) throw new Error("Open-Meteo response missing current field");

  const daily = json.daily;
  if (!daily || !Array.isArray(daily.time)) {
    throw new Error("Open-Meteo response missing daily field");
  }

  const hourly = json.hourly;
  if (!hourly || !Array.isArray(hourly.time)) {
    throw new Error("Open-Meteo response missing hourly field");
  }

  const nowIso = new Date().toISOString();

  const currentWeather = {
    temperature_c: current.temperature_2m ?? null,
    apparent_temperature_c: current.apparent_temperature ?? null,
    relative_humidity: current.relative_humidity_2m ?? null,
    wind_speed_kmh: current.wind_speed_10m ?? null,
    precipitation: current.precipitation ?? null,
    weather_code: current.weather_code ?? null,
    is_day: current.is_day == null ? null : Boolean(Number(current.is_day)),
    observed_at: current.time ?? null,
    updated_at: nowIso,
  };

  const dailyForecasts = daily.time.map((date, i) => ({
    forecast_date: date,
    temp_max_c: daily.temperature_2m_max?.[i] ?? null,
    temp_min_c: daily.temperature_2m_min?.[i] ?? null,
    precipitation_sum_mm: daily.precipitation_sum?.[i] ?? null,
    precipitation_probability_max: daily.precipitation_probability_max?.[i] ?? null,
    wind_speed_max_kmh: daily.wind_speed_10m_max?.[i] ?? null,
    weather_code: daily.weather_code?.[i] ?? null,
    sunrise: daily.sunrise?.[i] ?? null,
    sunset: daily.sunset?.[i] ?? null,
    uv_index_max: daily.uv_index_max?.[i] ?? null,
    updated_at: nowIso,
  }));

  const hourlyForecasts = hourly.time.slice(0, 24).map((time, i) => ({
    forecast_time: time,
    temperature_c: hourly.temperature_2m?.[i] ?? null,
    precipitation_probability: hourly.precipitation_probability?.[i] ?? null,
    wind_speed_kmh: hourly.wind_speed_10m?.[i] ?? null,
    weather_code: hourly.weather_code?.[i] ?? null,
    is_day: hourly.is_day?.[i] == null ? null : Boolean(Number(hourly.is_day[i])),
    updated_at: nowIso,
  }));

  return { currentWeather, dailyForecasts, hourlyForecasts };
}

async function upsertCurrentWeather(locationId, normalizedWeather) {
  const result = await supabase
    .from("current_weather")
    .upsert(
      { location_id: locationId, ...normalizedWeather },
      { onConflict: "location_id" }
    );

  if (result.error) throw result.error;
}

async function upsertDailyForecasts(locationId, forecasts) {
  if (!forecasts.length) return;
  const rows = forecasts.map((f) => ({ location_id: locationId, ...f }));
  const result = await supabase
    .from("daily_forecasts")
    .upsert(rows, { onConflict: "location_id,forecast_date" });
  if (result.error) throw result.error;
}

async function upsertHourlyForecasts(locationId, forecasts) {
  if (!forecasts.length) return;
  const rows = forecasts.map((f) => ({ location_id: locationId, ...f }));
  const result = await supabase
    .from("hourly_forecasts")
    .upsert(rows, { onConflict: "location_id,forecast_time" });
  if (result.error) throw result.error;
}

async function createSyncRun() {
  const result = await supabase
    .from("sync_runs")
    .insert({
      status: "running",
      poll_interval_ms: POLL_INTERVAL_MS,
      open_meteo_base_url: OPEN_METEO_BASE_URL,
    })
    .select("id")
    .maybeSingle();
  if (result.error) throw result.error;
  return result.data?.id ?? null;
}

async function finalizeSyncRun(runId, patch) {
  if (!runId) return;
  const result = await supabase
    .from("sync_runs")
    .update(patch)
    .eq("id", runId);
  if (result.error) throw result.error;
}

async function pollOnce() {
  const startedAt = new Date();
  let runId = null;

  let ok = 0;
  let failed = 0;
  let locationsTotal = 0;
  let sourceHttpStatus = null;
  let fatalErrorMessage = null;

  try {
    runId = await createSyncRun();
  } catch (err) {
    console.error("[sync_runs] create failed", err?.message ?? err);
  }

  let locations;
  try {
    locations = await loadLocations();
    locationsTotal = locations.length;
    await finalizeSyncRun(runId, { locations_total: locationsTotal });
  } catch (err) {
    fatalErrorMessage = err?.message ?? String(err);
    await finalizeSyncRun(runId, {
      finished_at: new Date().toISOString(),
      status: "failed",
      locations_total: locationsTotal,
      locations_ok: ok,
      locations_failed: failed,
      error_message: fatalErrorMessage,
    });
    throw err;
  }

  for (const loc of locations) {
    try {
      const bundle = await fetchWeatherBundle({
        latitude: loc.latitude,
        longitude: loc.longitude,
        timezone: loc.timezone,
      });
      await upsertCurrentWeather(loc.id, bundle.currentWeather);
      await upsertDailyForecasts(loc.id, bundle.dailyForecasts);
      await upsertHourlyForecasts(loc.id, bundle.hourlyForecasts);
      ok += 1;
      console.log(`[ok] ${loc.name} (${loc.id})`);
    } catch (err) {
      failed += 1;
      if (typeof err?.status === "number") sourceHttpStatus = err.status;
      console.error(`[fail] ${loc.name} (${loc.id})`, err?.message ?? err);
    }
  }

  const status = failed === 0 ? "success" : ok > 0 ? "partial" : "failed";

  const durationMs = Date.now() - startedAt.getTime();
  console.log(
    `[poll] locations=${locations.length} ok=${ok} failed=${failed} duration_ms=${durationMs}`
  );

  try {
    await finalizeSyncRun(runId, {
      finished_at: new Date().toISOString(),
      status,
      locations_total: locationsTotal,
      locations_ok: ok,
      locations_failed: failed,
      error_message: fatalErrorMessage,
      source_http_status: sourceHttpStatus,
    });
  } catch (err) {
    console.error("[sync_runs] finalize failed", err?.message ?? err);
  }
}

let running = false;

async function tick() {
  if (running) return;
  running = true;
  try {
    await pollOnce();
  } catch (err) {
    console.error("[poll] fatal error", err?.message ?? err);
  } finally {
    running = false;
  }
}

console.log(`[worker] starting poll interval ${POLL_INTERVAL_MS}ms`);
void tick();

const interval = setInterval(() => void tick(), POLL_INTERVAL_MS);

function shutdown(signal) {
  console.log(`[worker] received ${signal}, shutting down`);
  clearInterval(interval);
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
