"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { LocationRow } from "@/lib/types/db";
import { describeWeatherCode } from "@/lib/weather";
import {
  cToF,
  formatDateISO,
  formatDateTimeISO,
  formatNumber,
  kmhToMph,
} from "@/components/pro/format";
import {
  IconCalendar,
  IconDatabase,
  IconMapPin,
  IconThermometer,
  IconTrend,
} from "@/components/ui/icons";

type TemperatureUnit = "c" | "f";
type WindSpeedUnit = "kmh" | "mph";

type CurrentWeatherRow = {
  location_id: string;
  temperature_c: number | null;
  apparent_temperature_c: number | null;
  relative_humidity: number | null;
  wind_speed_kmh: number | null;
  precipitation: number | null;
  weather_code: number | null;
  is_day: boolean | null;
  observed_at: string | null;
  updated_at: string;
};

type DailyForecastRow = {
  location_id: string;
  forecast_date: string;
  temp_max_c: number | null;
  temp_min_c: number | null;
  precipitation_sum_mm: number | null;
  precipitation_probability_max: number | null;
  wind_speed_max_kmh: number | null;
  weather_code: number | null;
  sunrise: string | null;
  sunset: string | null;
  uv_index_max: number | null;
  updated_at: string;
};

type HourlyForecastRow = {
  location_id: string;
  forecast_time: string;
  temperature_c: number | null;
  precipitation_probability: number | null;
  wind_speed_kmh: number | null;
  weather_code: number | null;
  is_day: boolean | null;
  updated_at: string;
};

type SyncRunRow = {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: "running" | "success" | "partial" | "failed";
  locations_total: number;
  locations_ok: number;
  locations_failed: number;
  poll_interval_ms: number | null;
  open_meteo_base_url: string | null;
  source_http_status: number | null;
  error_message: string | null;
  created_at: string;
};

function GlassCard({
  icon,
  title,
  subtitle,
  children,
}: {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/60 bg-white/70 p-5 shadow-sm ring-1 ring-black/5 backdrop-blur-xl dark:border-zinc-800/70 dark:bg-black/40 dark:ring-white/10">
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          {icon ? (
            <span className="mt-0.5 text-zinc-500 dark:text-zinc-400">{icon}</span>
          ) : null}
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              {title}
            </h2>
          {subtitle ? (
            <p className="mt-1 text-xs text-zinc-500">{subtitle}</p>
          ) : null}
          </div>
        </div>
      </header>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function UnitToggle({
  temperatureUnit,
  windSpeedUnit,
  onTemperatureUnitChange,
  onWindSpeedUnitChange,
}: {
  temperatureUnit: TemperatureUnit;
  windSpeedUnit: WindSpeedUnit;
  onTemperatureUnitChange: (unit: TemperatureUnit) => void;
  onWindSpeedUnitChange: (unit: WindSpeedUnit) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-2 rounded-full border border-zinc-200/80 bg-white/60 p-1 shadow-sm ring-1 ring-black/5 dark:border-zinc-800/80 dark:bg-black/40 dark:ring-white/10">
        <button
          type="button"
          onClick={() => onTemperatureUnitChange("c")}
          className={[
            "rounded-full px-3 py-1 text-xs font-medium transition-colors",
            temperatureUnit === "c"
              ? "bg-black/[0.06] text-zinc-900 dark:bg-white/[0.10] dark:text-zinc-50"
              : "text-zinc-600 hover:bg-black/[0.04] dark:text-zinc-400 dark:hover:bg-white/[0.06]",
          ].join(" ")}
        >
          ℃
        </button>
        <button
          type="button"
          onClick={() => onTemperatureUnitChange("f")}
          className={[
            "rounded-full px-3 py-1 text-xs font-medium transition-colors",
            temperatureUnit === "f"
              ? "bg-black/[0.06] text-zinc-900 dark:bg-white/[0.10] dark:text-zinc-50"
              : "text-zinc-600 hover:bg-black/[0.04] dark:text-zinc-400 dark:hover:bg-white/[0.06]",
          ].join(" ")}
        >
          ℉
        </button>
      </div>

      <div className="flex items-center gap-2 rounded-full border border-zinc-200/80 bg-white/60 p-1 shadow-sm ring-1 ring-black/5 dark:border-zinc-800/80 dark:bg-black/40 dark:ring-white/10">
        <button
          type="button"
          onClick={() => onWindSpeedUnitChange("kmh")}
          className={[
            "rounded-full px-3 py-1 text-xs font-medium transition-colors",
            windSpeedUnit === "kmh"
              ? "bg-black/[0.06] text-zinc-900 dark:bg-white/[0.10] dark:text-zinc-50"
              : "text-zinc-600 hover:bg-black/[0.04] dark:text-zinc-400 dark:hover:bg-white/[0.06]",
          ].join(" ")}
        >
          km/h
        </button>
        <button
          type="button"
          onClick={() => onWindSpeedUnitChange("mph")}
          className={[
            "rounded-full px-3 py-1 text-xs font-medium transition-colors",
            windSpeedUnit === "mph"
              ? "bg-black/[0.06] text-zinc-900 dark:bg-white/[0.10] dark:text-zinc-50"
              : "text-zinc-600 hover:bg-black/[0.04] dark:text-zinc-400 dark:hover:bg-white/[0.06]",
          ].join(" ")}
        >
          mph
        </button>
      </div>
    </div>
  );
}

function CityPicker({
  user,
  selectedLocationId,
  onSelectedLocationIdChange,
}: {
  user: User | null;
  selectedLocationId: string;
  onSelectedLocationIdChange: (locationId: string) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const selectedLocation = useMemo(
    () => locations.find((l) => l.id === selectedLocationId) ?? null,
    [locations, selectedLocationId]
  );

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);

      if (user) {
        const result = await supabase
          .from("favorite_locations")
          .select(
            "location_id, locations (id,name,country,latitude,longitude,timezone,created_at)"
          )
          .eq("user_id", user.id);

        if (!active) return;
        if (result.error) {
          setError(result.error.message);
          setLoading(false);
          return;
        }

        const rows = (result.data ?? [])
          .map((r) => r.locations)
          .filter(Boolean) as unknown as LocationRow[];

        const favoriteIds = rows.map((r) => r.id);
        if (favoriteIds.length === 0) {
          setLocations([]);
          setLoading(false);
          return;
        }

        const availableResult = await supabase
          .from("current_weather")
          .select("location_id")
          .in("location_id", favoriteIds);

        if (!active) return;
        if (availableResult.error) {
          setError(availableResult.error.message);
          setLoading(false);
          return;
        }

        const availableIds = new Set(
          (availableResult.data ?? []).map((r) => r.location_id)
        );
        const availableRows = rows
          .filter((r) => availableIds.has(r.id))
          .sort((a, b) => a.name.localeCompare(b.name));

        setLocations(availableRows);
        setLoading(false);
        return;
      }

      const result = await supabase
        .from("current_weather")
        .select(
          "location_id, locations (id,name,country,latitude,longitude,timezone,created_at)"
        )
        .order("updated_at", { ascending: false })
        .limit(12);

      if (!active) return;
      if (result.error) {
        setError(result.error.message);
        setLoading(false);
        return;
      }

      const rows = (result.data ?? [])
        .map((r) => r.locations)
        .filter(Boolean) as unknown as LocationRow[];
      rows.sort((a, b) => a.name.localeCompare(b.name));
      setLocations(rows);
      setLoading(false);
    }

    void load();

    return () => {
      active = false;
    };
  }, [user?.id]);

  useEffect(() => {
    if (selectedLocationId) return;
    if (locations.length === 0) return;
    onSelectedLocationIdChange(locations[0].id);
  }, [locations, selectedLocationId, onSelectedLocationIdChange]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-500">
          {selectedLocation
            ? `${selectedLocation.name}${selectedLocation.country ? `, ${selectedLocation.country}` : ""}`
            : "City"}
        </span>
        {loading ? <span className="text-xs text-zinc-500">Loading…</span> : null}
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200/70 bg-red-50/80 p-3 text-xs text-red-700 shadow-sm ring-1 ring-black/5 backdrop-blur dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300 dark:ring-white/10">
          {error}
        </div>
      ) : null}

      <select
        value={selectedLocationId}
        onChange={(e) => onSelectedLocationIdChange(e.target.value)}
        className="w-full rounded-xl border border-zinc-200/80 bg-white/70 px-3 py-2 text-sm text-zinc-900 shadow-sm ring-1 ring-black/5 backdrop-blur dark:border-zinc-800/80 dark:bg-black/30 dark:text-zinc-50 dark:ring-white/10"
      >
        <option value="" disabled>
          Select a city…
        </option>
        {locations.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
            {l.country ? `, ${l.country}` : ""}
          </option>
        ))}
      </select>

      {user && locations.length === 0 ? (
        <p className="text-xs text-zinc-500">
          No favorite cities with data yet. Add cities in My Cities and wait for
          the next worker sync.
        </p>
      ) : null}
    </div>
  );
}

function HourlyTrend({
  items,
  temperatureUnit,
}: {
  items: HourlyForecastRow[];
  temperatureUnit: TemperatureUnit;
}) {
  const temps = items
    .map((i) => i.temperature_c)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v))
    .map((v) => (temperatureUnit === "c" ? v : cToF(v)));

  const min = temps.length ? Math.min(...temps) : 0;
  const max = temps.length ? Math.max(...temps) : 0;
  const range = max - min || 1;

  const tickMin = min;
  const tickMid = min + range / 2;
  const tickMax = max;

  const left = 14;
  const right = 4;
  const top = 8;
  const bottom = 18;
  const width = 120;
  const height = 100;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;

  const points = items
    .map((i, idx) => {
      const raw = i.temperature_c;
      if (raw == null || !Number.isFinite(raw)) return null;
      const value = temperatureUnit === "c" ? raw : cToF(raw);
      const x = left + (idx / Math.max(1, items.length - 1)) * plotWidth;
      const y = top + (1 - (value - min) / range) * plotHeight;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .filter(Boolean)
    .join(" ");

  const firstTime = items[0]?.forecast_time;
  const lastTime = items[items.length - 1]?.forecast_time;

  function formatHour(iso: string | undefined) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }

  const xTicks = [
    { idx: 0, label: formatHour(items[0]?.forecast_time) },
    { idx: 6, label: formatHour(items[6]?.forecast_time) },
    { idx: 12, label: formatHour(items[12]?.forecast_time) },
    { idx: 18, label: formatHour(items[18]?.forecast_time) },
    { idx: items.length - 1, label: formatHour(items[items.length - 1]?.forecast_time) },
  ]
    .filter((t) => t.idx >= 0 && t.idx < items.length)
    .filter((t, i, arr) => arr.findIndex((x) => x.idx === t.idx) === i);

  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs text-zinc-500">Temperature range</p>
          <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-50">
            {temps.length
              ? `${formatNumber(min, 1)}–${formatNumber(max, 1)}°${temperatureUnit.toUpperCase()}`
              : "—"}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-zinc-500">Window</p>
          <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-50">
            {formatHour(firstTime)} → {formatHour(lastTime)}
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-zinc-200/80 bg-white/60 p-3 shadow-sm ring-1 ring-black/5 backdrop-blur dark:border-zinc-800/80 dark:bg-black/30 dark:ring-white/10">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-40 w-full">
          <g className="text-zinc-900/10 dark:text-white/10" stroke="currentColor">
            <line x1={left} y1={top} x2={width - right} y2={top} strokeWidth="1" />
            <line
              x1={left}
              y1={top + plotHeight / 2}
              x2={width - right}
              y2={top + plotHeight / 2}
              strokeWidth="1"
            />
            <line
              x1={left}
              y1={top + plotHeight}
              x2={width - right}
              y2={top + plotHeight}
              strokeWidth="1"
            />
          </g>

          <g className="text-zinc-500" fill="currentColor">
            <text x={left - 2} y={top + 3} fontSize="7" textAnchor="end">
              {formatNumber(tickMax, 1)}
            </text>
            <text x={left - 2} y={top + plotHeight / 2 + 3} fontSize="7" textAnchor="end">
              {formatNumber(tickMid, 1)}
            </text>
            <text x={left - 2} y={top + plotHeight + 3} fontSize="7" textAnchor="end">
              {formatNumber(tickMin, 1)}
            </text>
          </g>

          <g className="text-zinc-900 dark:text-zinc-50">
            <polyline
              points={points}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </g>

          <g className="text-zinc-500" fill="currentColor">
            {xTicks.map((t) => {
              const x = left + (t.idx / Math.max(1, items.length - 1)) * plotWidth;
              return (
                <g key={t.idx}>
                  <line
                    x1={x}
                    y1={top + plotHeight}
                    x2={x}
                    y2={top + plotHeight + 2}
                    stroke="currentColor"
                    strokeWidth="1"
                    opacity="0.35"
                  />
                  <text
                    x={x}
                    y={height - 6}
                    fontSize="7"
                    textAnchor="middle"
                  >
                    {t.label}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    </div>
  );
}

export function ProDashboard({ user }: { user: User | null }) {
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [temperatureUnit, setTemperatureUnit] = useState<TemperatureUnit>("c");
  const [windSpeedUnit, setWindSpeedUnit] = useState<WindSpeedUnit>("kmh");

  const [currentWeather, setCurrentWeather] = useState<CurrentWeatherRow | null>(
    null
  );
  const [dailyForecasts, setDailyForecasts] = useState<DailyForecastRow[]>([]);
  const [hourlyForecasts, setHourlyForecasts] = useState<HourlyForecastRow[]>([]);
  const [syncRuns, setSyncRuns] = useState<SyncRunRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const tempDisplay = useMemo(() => {
    if (!currentWeather) return "—";
    if (currentWeather.temperature_c == null) return "—";
    const v =
      temperatureUnit === "c"
        ? currentWeather.temperature_c
        : cToF(currentWeather.temperature_c);
    return `${formatNumber(v, 1)}°${temperatureUnit.toUpperCase()}`;
  }, [currentWeather, temperatureUnit]);

  const windDisplay = useMemo(() => {
    if (!currentWeather) return "—";
    if (currentWeather.wind_speed_kmh == null) return "—";
    const v =
      windSpeedUnit === "kmh"
        ? currentWeather.wind_speed_kmh
        : kmhToMph(currentWeather.wind_speed_kmh);
    return `${formatNumber(v, 1)} ${windSpeedUnit === "kmh" ? "km/h" : "mph"}`;
  }, [currentWeather, windSpeedUnit]);

  useEffect(() => {
    if (!selectedLocationId) return;
    const supabase = getSupabaseBrowserClient();
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);

      const [cw, df, hf, sr] = await Promise.all([
        supabase
          .from("current_weather")
          .select(
            "location_id,temperature_c,apparent_temperature_c,relative_humidity,wind_speed_kmh,precipitation,weather_code,is_day,observed_at,updated_at"
          )
          .eq("location_id", selectedLocationId)
          .maybeSingle(),
        supabase
          .from("daily_forecasts")
          .select(
            "location_id,forecast_date,temp_max_c,temp_min_c,precipitation_sum_mm,precipitation_probability_max,wind_speed_max_kmh,weather_code,sunrise,sunset,uv_index_max,updated_at"
          )
          .eq("location_id", selectedLocationId)
          .order("forecast_date", { ascending: true })
          .limit(15),
        supabase
          .from("hourly_forecasts")
          .select(
            "location_id,forecast_time,temperature_c,precipitation_probability,wind_speed_kmh,weather_code,is_day,updated_at"
          )
          .eq("location_id", selectedLocationId)
          .order("forecast_time", { ascending: true })
          .limit(24),
        supabase
          .from("sync_runs")
          .select(
            "id,started_at,finished_at,status,locations_total,locations_ok,locations_failed,poll_interval_ms,open_meteo_base_url,source_http_status,error_message,created_at"
          )
          .order("started_at", { ascending: false })
          .limit(5),
      ]);

      if (!active) return;

      if (cw.error) {
        setError(cw.error.message);
      } else {
        setCurrentWeather((cw.data ?? null) as CurrentWeatherRow | null);
      }

      if (df.error) {
        setError((prev) => prev ?? df.error?.message ?? null);
        setDailyForecasts([]);
      } else {
        setDailyForecasts((df.data ?? []) as DailyForecastRow[]);
      }

      if (hf.error) {
        setError((prev) => prev ?? hf.error?.message ?? null);
        setHourlyForecasts([]);
      } else {
        setHourlyForecasts((hf.data ?? []) as HourlyForecastRow[]);
      }

      if (sr.error) {
        setError((prev) => prev ?? sr.error?.message ?? null);
        setSyncRuns([]);
      } else {
        setSyncRuns((sr.data ?? []) as SyncRunRow[]);
      }

      setLoading(false);
    }

    void load();

    const channel = supabase
      .channel(`pro-dashboard:${selectedLocationId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "current_weather" },
        (payload) => {
          const locationId =
            (payload.new as { location_id?: string } | null)?.location_id ??
            (payload.old as { location_id?: string } | null)?.location_id;
          if (locationId !== selectedLocationId) return;
          if (payload.eventType === "DELETE") {
            setCurrentWeather(null);
            return;
          }
          setCurrentWeather(payload.new as CurrentWeatherRow);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sync_runs" },
        () => {
          void supabase
            .from("sync_runs")
            .select(
              "id,started_at,finished_at,status,locations_total,locations_ok,locations_failed,poll_interval_ms,open_meteo_base_url,source_http_status,error_message,created_at"
            )
            .order("started_at", { ascending: false })
            .limit(5)
            .then(({ data }) => {
              setSyncRuns((data ?? []) as SyncRunRow[]);
            });
        }
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [selectedLocationId]);

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-[-0.02em] text-zinc-900 dark:text-zinc-50">
            Weather Pulse Pro
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            15-day dashboard with preferences, alerts, comparisons, and sync
            status.
          </p>
        </div>
        <UnitToggle
          temperatureUnit={temperatureUnit}
          windSpeedUnit={windSpeedUnit}
          onTemperatureUnitChange={setTemperatureUnit}
          onWindSpeedUnitChange={setWindSpeedUnit}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[360px_1fr]">
        <aside className="space-y-4">
          <GlassCard
            icon={<IconMapPin className="h-4 w-4" />}
            title={user ? "My Cities" : "Public Cities"}
            subtitle={user ? "Pick from your favorites" : "Pick from default list"}
          >
            <CityPicker
              user={user}
              selectedLocationId={selectedLocationId}
              onSelectedLocationIdChange={setSelectedLocationId}
            />
          </GlassCard>

          <GlassCard
            icon={<IconDatabase className="h-4 w-4" />}
            title="Data Status"
            subtitle="Freshness and last sync runs"
          >
            {loading ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Loading…
              </p>
            ) : (
              <>
                <dl className="grid grid-cols-2 gap-3">
                  <div>
                    <dt className="text-xs text-zinc-500">Current updated</dt>
                    <dd className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                      {currentWeather?.updated_at
                        ? formatDateTimeISO(currentWeather.updated_at)
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-zinc-500">Observed at</dt>
                    <dd className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                      {currentWeather?.observed_at
                        ? formatDateTimeISO(currentWeather.observed_at)
                        : "—"}
                    </dd>
                  </div>
                </dl>

                <div className="mt-4">
                  {syncRuns.length === 0 ? (
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      No sync run logs yet. Run updated SQL and restart worker.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {syncRuns.map((r) => (
                        <li
                          key={r.id}
                          className="rounded-xl border border-zinc-200/80 bg-white/60 px-3 py-2 text-sm shadow-sm ring-1 ring-black/5 backdrop-blur dark:border-zinc-800/80 dark:bg-black/30 dark:ring-white/10"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-zinc-900 dark:text-zinc-50">
                              {r.status}
                            </span>
                            <span className="text-xs text-zinc-500">
                              {formatDateTimeISO(r.started_at)}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-zinc-500">
                            ok {r.locations_ok}/{r.locations_total} · failed{" "}
                            {r.locations_failed}
                            {r.source_http_status
                              ? ` · source ${r.source_http_status}`
                              : ""}
                          </p>
                          {r.error_message ? (
                            <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                              {r.error_message}
                            </p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}
          </GlassCard>
        </aside>

        <div className="space-y-4">
          <GlassCard
            icon={<IconThermometer className="h-4 w-4" />}
            title="Now"
            subtitle="Current snapshot (Realtime via current_weather)"
          >
            {error ? (
              <div className="mb-4 rounded-xl border border-red-200/70 bg-red-50/80 p-3 text-sm text-red-700 shadow-sm ring-1 ring-black/5 backdrop-blur dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300 dark:ring-white/10">
                {error}
              </div>
            ) : null}

            {loading ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Loading…
              </p>
            ) : (
              <div className="flex flex-wrap items-end justify-between gap-6">
                <div>
                  <p className="text-xs text-zinc-500">Temperature</p>
                  <p className="mt-1 text-3xl font-semibold tracking-[-0.03em] text-zinc-900 dark:text-zinc-50">
                    {tempDisplay}
                  </p>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    {describeWeatherCode(currentWeather?.weather_code)}
                  </p>
                </div>
                <dl className="grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-xs text-zinc-500">Feels like</dt>
                    <dd className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                      {currentWeather?.apparent_temperature_c == null
                        ? "—"
                        : temperatureUnit === "c"
                          ? `${formatNumber(currentWeather.apparent_temperature_c, 1)}°C`
                          : `${formatNumber(cToF(currentWeather.apparent_temperature_c), 1)}°F`}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-zinc-500">Humidity</dt>
                    <dd className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                      {currentWeather?.relative_humidity == null
                        ? "—"
                        : `${formatNumber(currentWeather.relative_humidity)}%`}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-zinc-500">Wind</dt>
                    <dd className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                      {windDisplay}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-zinc-500">Precip</dt>
                    <dd className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                      {currentWeather?.precipitation == null
                        ? "—"
                        : `${formatNumber(currentWeather.precipitation, 1)} mm`}
                    </dd>
                  </div>
                </dl>
              </div>
            )}
          </GlassCard>

          <GlassCard
            icon={<IconTrend className="h-4 w-4" />}
            title="Next 24 Hours"
            subtitle="Hourly trend"
          >
            {loading ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Loading…
              </p>
            ) : hourlyForecasts.length === 0 ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                No hourly forecasts yet. Run updated SQL and restart worker.
              </p>
            ) : (
              <HourlyTrend
                items={hourlyForecasts}
                temperatureUnit={temperatureUnit}
              />
            )}
          </GlassCard>

          <GlassCard
            icon={<IconCalendar className="h-4 w-4" />}
            title="15-Day Forecast"
            subtitle="Daily forecast rows"
          >
            {loading ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Loading…
              </p>
            ) : dailyForecasts.length === 0 ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                No daily forecasts yet. Run updated SQL and restart worker.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-separate border-spacing-y-2 text-sm">
                  <thead>
                    <tr className="text-left text-xs text-zinc-500">
                      <th className="px-3">Day</th>
                      <th className="px-3">Max</th>
                      <th className="px-3">Min</th>
                      <th className="px-3">Rain</th>
                      <th className="px-3">Wind</th>
                      <th className="px-3">Code</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyForecasts.map((d) => {
                      const max =
                        d.temp_max_c == null
                          ? null
                          : temperatureUnit === "c"
                            ? d.temp_max_c
                            : cToF(d.temp_max_c);
                      const min =
                        d.temp_min_c == null
                          ? null
                          : temperatureUnit === "c"
                            ? d.temp_min_c
                            : cToF(d.temp_min_c);
                      const wind =
                        d.wind_speed_max_kmh == null
                          ? null
                          : windSpeedUnit === "kmh"
                            ? d.wind_speed_max_kmh
                            : kmhToMph(d.wind_speed_max_kmh);

                      return (
                        <tr
                          key={d.forecast_date}
                          className="rounded-xl border border-zinc-200/80 bg-white/60 shadow-sm ring-1 ring-black/5 backdrop-blur dark:border-zinc-800/80 dark:bg-black/30 dark:ring-white/10"
                        >
                          <td className="px-3 py-2 font-medium text-zinc-900 dark:text-zinc-50">
                            {formatDateISO(d.forecast_date)}
                          </td>
                          <td className="px-3 py-2 text-zinc-900 dark:text-zinc-50">
                            {max == null
                              ? "—"
                              : `${formatNumber(max, 1)}°${temperatureUnit.toUpperCase()}`}
                          </td>
                          <td className="px-3 py-2 text-zinc-900 dark:text-zinc-50">
                            {min == null
                              ? "—"
                              : `${formatNumber(min, 1)}°${temperatureUnit.toUpperCase()}`}
                          </td>
                          <td className="px-3 py-2 text-zinc-900 dark:text-zinc-50">
                            {d.precipitation_probability_max == null
                              ? "—"
                              : `${formatNumber(d.precipitation_probability_max)}%`}
                          </td>
                          <td className="px-3 py-2 text-zinc-900 dark:text-zinc-50">
                            {wind == null
                              ? "—"
                              : `${formatNumber(wind, 1)} ${
                                  windSpeedUnit === "kmh" ? "km/h" : "mph"
                                }`}
                          </td>
                          <td className="px-3 py-2 text-zinc-900 dark:text-zinc-50">
                            {d.weather_code == null ? "—" : d.weather_code}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
