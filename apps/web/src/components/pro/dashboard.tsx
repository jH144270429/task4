"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import Link from "next/link";
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
  IconBell,
  IconDatabase,
  IconMapPin,
  IconSparkles,
  IconThermometer,
  IconTrend,
} from "@/components/ui/icons";
import { WeatherIcon } from "@/components/ui/weather-icons";

type TemperatureUnit = "c" | "f";
type WindSpeedUnit = "kmh" | "mph";

type UserPreferencesRow = {
  user_id: string;
  temperature_unit: TemperatureUnit;
  wind_speed_unit: WindSpeedUnit;
  default_location_id: string | null;
  timezone_display: "location" | "utc";
  time_format: "12h" | "24h";
  alerts_enabled: boolean;
  created_at: string;
  updated_at: string;
};

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

type RuleType = "precipitation" | "temperature_max" | "wind_speed";
type Comparator = "gt" | "gte" | "lt" | "lte";

type AlertRuleRow = {
  id: string;
  user_id: string;
  location_id: string | null;
  rule_type: RuleType;
  comparator: Comparator;
  threshold: number;
  horizon_days: number;
  enabled: boolean;
  created_at: string;
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

function minutesSince(iso: string | null | undefined) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.round((Date.now() - t) / 60000));
}

function freshnessLabel(minutes: number | null) {
  if (minutes == null) return { label: "Unknown", tone: "neutral" as const };
  if (minutes <= 15) return { label: "Fresh", tone: "good" as const };
  if (minutes <= 60) return { label: "OK", tone: "neutral" as const };
  return { label: "Stale", tone: "bad" as const };
}

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: "good" | "neutral" | "bad";
}) {
  const className =
    tone === "good"
      ? "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
      : tone === "bad"
        ? "bg-red-500/10 text-red-700 dark:bg-red-500/15 dark:text-red-300"
        : "bg-zinc-500/10 text-zinc-700 dark:bg-white/[0.08] dark:text-zinc-200";

  return (
    <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${className}`}>
      {label}
    </span>
  );
}

function scoreLabel(score: number) {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 55) return "Fair";
  return "Poor";
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function normalizeWeatherKind(code: number | null | undefined) {
  if (code == null) return "unknown";
  if (code === 0) return "clear";
  if (code >= 1 && code <= 3) return "cloud";
  if (code === 45 || code === 48) return "fog";
  if (code >= 51 && code <= 57) return "rain";
  if (code >= 61 && code <= 67) return "rain";
  if (code >= 71 && code <= 77) return "snow";
  if (code >= 80 && code <= 82) return "rain";
  if (code === 85 || code === 86) return "snow";
  if (code >= 95 && code <= 99) return "thunder";
  return "other";
}

function ruleTypeLabel(t: RuleType) {
  if (t === "precipitation") return "Precipitation";
  if (t === "temperature_max") return "Max Temperature";
  return "Wind Speed";
}

function comparatorLabel(c: Comparator) {
  if (c === "gt") return ">";
  if (c === "gte") return "≥";
  if (c === "lt") return "<";
  return "≤";
}

function compareValue(c: Comparator, a: number, b: number) {
  if (c === "gt") return a > b;
  if (c === "gte") return a >= b;
  if (c === "lt") return a < b;
  return a <= b;
}

function computeOutdoorScore(days: DailyForecastRow[]) {
  const slice = days.slice(0, 3);
  if (slice.length === 0) return null;

  let scoreTotal = 0;
  const reasons = new Set<string>();

  for (const d of slice) {
    let s = 100;
    const avgTemp =
      d.temp_max_c == null || d.temp_min_c == null
        ? null
        : (d.temp_max_c + d.temp_min_c) / 2;
    if (avgTemp != null) {
      const delta = Math.abs(avgTemp - 22);
      s -= clamp(delta * 2.2, 0, 30);
      if (avgTemp > 30) reasons.add("Hot");
      if (avgTemp < 10) reasons.add("Cold");
    }

    const rainProb = d.precipitation_probability_max ?? null;
    if (rainProb != null) {
      s -= clamp(rainProb * 0.45, 0, 45);
      if (rainProb >= 50) reasons.add("Rain risk");
    }

    const rainSum = d.precipitation_sum_mm ?? null;
    if (rainSum != null) {
      s -= clamp(rainSum * 1.2, 0, 25);
      if (rainSum >= 5) reasons.add("Wet");
    }

    const wind = d.wind_speed_max_kmh ?? null;
    if (wind != null) {
      s -= clamp(Math.max(0, wind - 22) * 1.3, 0, 30);
      if (wind >= 35) reasons.add("Windy");
    }

    const kind = normalizeWeatherKind(d.weather_code);
    if (kind === "thunder") {
      s -= 25;
      reasons.add("Thunder");
    }
    if (kind === "fog") {
      s -= 15;
      reasons.add("Fog");
    }

    scoreTotal += clamp(s, 0, 100);
  }

  const score = Math.round(scoreTotal / slice.length);
  return { score, label: scoreLabel(score), reasons: Array.from(reasons).slice(0, 4) };
}

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
  defaultLocationId,
  onSelectedLocationIdChange,
  onSetDefaultLocation,
}: {
  user: User | null;
  selectedLocationId: string;
  defaultLocationId: string | null;
  onSelectedLocationIdChange: (locationId: string) => void;
  onSetDefaultLocation: (locationId: string) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const selectedLocation = useMemo(
    () => locations.find((l) => l.id === selectedLocationId) ?? null,
    [locations, selectedLocationId]
  );
  const locationsKey = useMemo(
    () => locations.map((l) => l.id).join("|"),
    [locations]
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
    const preferred =
      defaultLocationId && locations.some((l) => l.id === defaultLocationId)
        ? defaultLocationId
        : null;
    onSelectedLocationIdChange(preferred ?? locations[0].id);
  }, [locationsKey, selectedLocationId, onSelectedLocationIdChange, defaultLocationId]);

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

      {user && selectedLocationId ? (
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-500">
            {defaultLocationId === selectedLocationId ? "Default city" : " "}
          </span>
          <button
            type="button"
            disabled={defaultLocationId === selectedLocationId}
            onClick={() => onSetDefaultLocation(selectedLocationId)}
            className="rounded-full px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-black/[0.04] disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-white/[0.06]"
          >
            Set default
          </button>
        </div>
      ) : null}

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

function GeoMap({
  locations,
  selectedLocationId,
}: {
  locations: LocationRow[];
  selectedLocationId: string;
}) {
  const width = 520;
  const height = 260;
  const pad = 10;
  const plotWidth = width - pad * 2;
  const plotHeight = height - pad * 2;

  const points = useMemo(() => {
    return locations
      .filter((l) => Number.isFinite(l.latitude) && Number.isFinite(l.longitude))
      .map((l) => {
        const x = pad + ((l.longitude + 180) / 360) * plotWidth;
        const y = pad + ((90 - l.latitude) / 180) * plotHeight;
        return { id: l.id, name: l.name, country: l.country, x, y };
      });
  }, [locations, plotWidth, plotHeight]);

  const selected = useMemo(
    () => locations.find((l) => l.id === selectedLocationId) ?? null,
    [locations, selectedLocationId]
  );

  const meridians = [-120, -60, 0, 60, 120];
  const parallels = [-60, -30, 0, 30, 60];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-zinc-500">Cities</p>
          <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-50">
            {locations.length}
            {selected ? (
              <span className="text-zinc-500">
                {" "}
                · selected {selected.name}
                {selected.country ? `, ${selected.country}` : ""}
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full bg-black/[0.06] px-3 py-1 text-xs font-medium text-zinc-800 dark:bg-white/[0.10] dark:text-zinc-100">
            <span className="h-2 w-2 rounded-full bg-zinc-900 dark:bg-white" />
            City
          </span>
          <span className="inline-flex items-center gap-2 rounded-full bg-black/[0.06] px-3 py-1 text-xs font-medium text-zinc-800 dark:bg-white/[0.10] dark:text-zinc-100">
            <span className="h-2 w-2 rounded-full bg-blue-600" />
            Selected
          </span>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-200/80 bg-white/60 shadow-sm ring-1 ring-black/5 backdrop-blur dark:border-zinc-800/80 dark:bg-black/30 dark:ring-white/10">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-56 w-full">
          <rect x="0" y="0" width={width} height={height} fill="transparent" />

          <g className="text-zinc-900/10 dark:text-white/10" stroke="currentColor">
            {meridians.map((lon) => {
              const x = pad + ((lon + 180) / 360) * plotWidth;
              return (
                <line
                  key={lon}
                  x1={x}
                  y1={pad}
                  x2={x}
                  y2={height - pad}
                  strokeWidth="1"
                />
              );
            })}
            {parallels.map((lat) => {
              const y = pad + ((90 - lat) / 180) * plotHeight;
              return (
                <line
                  key={lat}
                  x1={pad}
                  y1={y}
                  x2={width - pad}
                  y2={y}
                  strokeWidth="1"
                />
              );
            })}
          </g>

          <g className="text-zinc-500" fill="currentColor">
            <text x={pad} y={height - 8} fontSize="9">
              -180°
            </text>
            <text x={width - pad} y={height - 8} fontSize="9" textAnchor="end">
              180°
            </text>
            <text x={width - pad} y={pad + 10} fontSize="9" textAnchor="end">
              90°N
            </text>
            <text x={width - pad} y={height - pad - 2} fontSize="9" textAnchor="end">
              90°S
            </text>
          </g>

          <g>
            {points.map((p) => {
              const selected = p.id === selectedLocationId;
              return (
                <circle
                  key={p.id}
                  cx={p.x}
                  cy={p.y}
                  r={selected ? 5 : 3.5}
                  fill={selected ? "#2563eb" : "currentColor"}
                  className={selected ? "" : "text-zinc-900 dark:text-white"}
                  opacity={selected ? 0.95 : 0.65}
                />
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
  const [preferences, setPreferences] = useState<UserPreferencesRow | null>(null);
  const [prefsSaving, setPrefsSaving] = useState(false);

  const [alertRules, setAlertRules] = useState<AlertRuleRow[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertsError, setAlertsError] = useState<string | null>(null);

  const [mapLocations, setMapLocations] = useState<LocationRow[]>([]);
  const [mapLoading, setMapLoading] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  const [currentWeather, setCurrentWeather] = useState<CurrentWeatherRow | null>(
    null
  );
  const [dailyForecasts, setDailyForecasts] = useState<DailyForecastRow[]>([]);
  const [hourlyForecasts, setHourlyForecasts] = useState<HourlyForecastRow[]>([]);
  const [syncRuns, setSyncRuns] = useState<SyncRunRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const today = dailyForecasts[0] ?? null;
  const outdoor = useMemo(() => computeOutdoorScore(dailyForecasts), [dailyForecasts]);
  const defaultLocationId = preferences?.default_location_id ?? null;

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let active = true;

    async function load() {
      setMapLoading(true);
      setMapError(null);

      if (user) {
        const result = await supabase
          .from("favorite_locations")
          .select(
            "location_id, locations (id,name,country,latitude,longitude,timezone,created_at)"
          )
          .eq("user_id", user.id);

        if (!active) return;
        if (result.error) {
          setMapError(result.error.message);
          setMapLocations([]);
          setMapLoading(false);
          return;
        }

        const rows = (result.data ?? [])
          .map((r) => r.locations)
          .filter(Boolean) as unknown as LocationRow[];
        const favoriteIds = rows.map((r) => r.id);
        if (favoriteIds.length === 0) {
          setMapLocations([]);
          setMapLoading(false);
          return;
        }

        const availableResult = await supabase
          .from("current_weather")
          .select("location_id")
          .in("location_id", favoriteIds);

        if (!active) return;
        if (availableResult.error) {
          setMapError(availableResult.error.message);
          setMapLocations([]);
          setMapLoading(false);
          return;
        }

        const availableIds = new Set(
          (availableResult.data ?? []).map((r) => r.location_id)
        );
        const availableRows = rows
          .filter((r) => availableIds.has(r.id))
          .sort((a, b) => a.name.localeCompare(b.name));

        setMapLocations(availableRows);
        setMapLoading(false);
        return;
      }

      const result = await supabase
        .from("current_weather")
        .select(
          "location_id, locations (id,name,country,latitude,longitude,timezone,created_at)"
        )
        .order("updated_at", { ascending: false })
        .limit(24);

      if (!active) return;
      if (result.error) {
        setMapError(result.error.message);
        setMapLocations([]);
        setMapLoading(false);
        return;
      }

      const rows = (result.data ?? [])
        .map((r) => r.locations)
        .filter(Boolean) as unknown as LocationRow[];
      rows.sort((a, b) => a.name.localeCompare(b.name));
      setMapLocations(rows);
      setMapLoading(false);
    }

    void load();

    return () => {
      active = false;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user) {
      setAlertRules([]);
      setAlertsLoading(false);
      setAlertsError(null);
      return;
    }

    const supabase = getSupabaseBrowserClient();
    let active = true;

    async function loadRules() {
      setAlertsLoading(true);
      setAlertsError(null);

      const result = await supabase
        .from("alert_rules")
        .select(
          "id,user_id,location_id,rule_type,comparator,threshold,horizon_days,enabled,created_at,updated_at"
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (!active) return;
      if (result.error) {
        setAlertsError(result.error.message);
        setAlertsLoading(false);
        return;
      }

      setAlertRules((result.data ?? []) as AlertRuleRow[]);
      setAlertsLoading(false);
    }

    void loadRules();

    return () => {
      active = false;
    };
  }, [user?.id]);

  const alertSnapshot = useMemo(() => {
    if (!user) return null;
    if (!selectedLocationId) return { applicable: [], triggers: [] as Array<{ ruleId: string; date: string; value: number }> };

    const applicable = alertRules.filter(
      (r) =>
        r.enabled && (r.location_id == null || r.location_id === selectedLocationId)
    );

    const triggers: Array<{ ruleId: string; date: string; value: number }> = [];

    for (const r of applicable) {
      for (const d of dailyForecasts.slice(0, r.horizon_days)) {
        const v =
          r.rule_type === "precipitation"
            ? d.precipitation_sum_mm
            : r.rule_type === "temperature_max"
              ? d.temp_max_c
              : d.wind_speed_max_kmh;
        if (v == null || !Number.isFinite(v)) continue;
        if (compareValue(r.comparator, v, r.threshold)) {
          triggers.push({ ruleId: r.id, date: d.forecast_date, value: v });
          break;
        }
      }
    }

    return { applicable, triggers };
  }, [user, selectedLocationId, alertRules, dailyForecasts]);

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

  const currentAge = useMemo(
    () => minutesSince(currentWeather?.updated_at),
    [currentWeather?.updated_at]
  );
  const hourlyAge = useMemo(() => {
    if (hourlyForecasts.length === 0) return null;
    const iso = hourlyForecasts[0]?.updated_at;
    return minutesSince(iso);
  }, [hourlyForecasts]);
  const dailyAge = useMemo(() => {
    if (dailyForecasts.length === 0) return null;
    const iso = dailyForecasts[0]?.updated_at;
    return minutesSince(iso);
  }, [dailyForecasts]);

  useEffect(() => {
    if (!user) {
      setPreferences(null);
      setPrefsSaving(false);
      return;
    }

    const supabase = getSupabaseBrowserClient();
    let active = true;

    supabase
      .from("user_preferences")
      .select(
        "user_id,temperature_unit,wind_speed_unit,default_location_id,timezone_display,time_format,alerts_enabled,created_at,updated_at"
      )
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setError((prev) => prev ?? error.message);
          return;
        }
        if (data) {
          const prefs = data as UserPreferencesRow;
          setPreferences(prefs);
          setTemperatureUnit(prefs.temperature_unit);
          setWindSpeedUnit(prefs.wind_speed_unit);
        } else {
          setPreferences({
            user_id: user.id,
            temperature_unit: "c",
            wind_speed_unit: "kmh",
            default_location_id: null,
            timezone_display: "location",
            time_format: "24h",
            alerts_enabled: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      active = false;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    if (!preferences) return;

    if (
      preferences.temperature_unit === temperatureUnit &&
      preferences.wind_speed_unit === windSpeedUnit
    ) {
      return;
    }

    const supabase = getSupabaseBrowserClient();
    const controller = new AbortController();
    const t = setTimeout(() => {
      setPrefsSaving(true);
      supabase
        .from("user_preferences")
        .upsert(
          {
            user_id: user.id,
            temperature_unit: temperatureUnit,
            wind_speed_unit: windSpeedUnit,
            default_location_id: preferences.default_location_id,
            timezone_display: preferences.timezone_display,
            time_format: preferences.time_format,
            alerts_enabled: preferences.alerts_enabled,
          },
          { onConflict: "user_id" }
        )
        .select(
          "user_id,temperature_unit,wind_speed_unit,default_location_id,timezone_display,time_format,alerts_enabled,created_at,updated_at"
        )
        .maybeSingle()
        .then(({ data, error }) => {
          if (controller.signal.aborted) return;
          if (error) {
            setError((prev) => prev ?? error.message);
            return;
          }
          if (data) setPreferences(data as UserPreferencesRow);
        })
        .finally(() => {
          if (controller.signal.aborted) return;
          setPrefsSaving(false);
        });
    }, 800);

    return () => {
      controller.abort();
      clearTimeout(t);
    };
  }, [user?.id, preferences, temperatureUnit, windSpeedUnit]);

  async function setDefaultLocation(locationId: string) {
    if (!user) return;
    if (!preferences) return;
    const supabase = getSupabaseBrowserClient();
    setPrefsSaving(true);
    setError(null);

    const result = await supabase
      .from("user_preferences")
      .upsert(
        {
          user_id: user.id,
          temperature_unit: temperatureUnit,
          wind_speed_unit: windSpeedUnit,
          default_location_id: locationId,
          timezone_display: preferences.timezone_display,
          time_format: preferences.time_format,
          alerts_enabled: preferences.alerts_enabled,
        },
        { onConflict: "user_id" }
      )
      .select(
        "user_id,temperature_unit,wind_speed_unit,default_location_id,timezone_display,time_format,alerts_enabled,created_at,updated_at"
      )
      .maybeSingle();

    if (result.error) {
      setError(result.error.message);
      setPrefsSaving(false);
      return;
    }

    if (result.data) setPreferences(result.data as UserPreferencesRow);
    setPrefsSaving(false);
  }

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
        <div className="flex items-center gap-2">
          {user ? (
            <StatusPill
              label={prefsSaving ? "Saving…" : "Preferences"}
              tone={prefsSaving ? "neutral" : "good"}
            />
          ) : null}
          <UnitToggle
            temperatureUnit={temperatureUnit}
            windSpeedUnit={windSpeedUnit}
            onTemperatureUnitChange={setTemperatureUnit}
            onWindSpeedUnitChange={setWindSpeedUnit}
          />
        </div>
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
              defaultLocationId={defaultLocationId}
              onSelectedLocationIdChange={setSelectedLocationId}
              onSetDefaultLocation={setDefaultLocation}
            />
          </GlassCard>

          <GlassCard
            icon={<IconBell className="h-4 w-4" />}
            title="Alert Snapshot"
            subtitle="Triggers for the selected city"
          >
            {!user ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Sign in to enable alert rules.
              </p>
            ) : alertsLoading ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading…</p>
            ) : alertsError ? (
              <div className="rounded-xl border border-red-200/70 bg-red-50/80 p-3 text-xs text-red-700 shadow-sm ring-1 ring-black/5 backdrop-blur dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300 dark:ring-white/10">
                {alertsError}
              </div>
            ) : !selectedLocationId ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Pick a city to see triggers.
              </p>
            ) : alertSnapshot && alertSnapshot.applicable.length === 0 ? (
              <div className="space-y-2">
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  No enabled rules apply to this city.
                </p>
                <Link
                  href="/alerts"
                  className="inline-flex rounded-full px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-black/[0.04] dark:text-zinc-400 dark:hover:bg-white/[0.06]"
                >
                  Create rules →
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill
                    label={`Enabled: ${alertSnapshot?.applicable.length ?? 0}`}
                    tone="neutral"
                  />
                  <StatusPill
                    label={`Triggered: ${alertSnapshot?.triggers.length ?? 0}`}
                    tone={(alertSnapshot?.triggers.length ?? 0) > 0 ? "bad" : "good"}
                  />
                </div>

                <ul className="space-y-2">
                  {(alertSnapshot?.applicable ?? []).slice(0, 3).map((r) => {
                    const hit = (alertSnapshot?.triggers ?? []).find(
                      (t) => t.ruleId === r.id
                    );
                    return (
                      <li
                        key={r.id}
                        className="rounded-xl border border-zinc-200/80 bg-white/60 px-3 py-2 text-sm shadow-sm ring-1 ring-black/5 backdrop-blur dark:border-zinc-800/80 dark:bg-black/30 dark:ring-white/10"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                              {ruleTypeLabel(r.rule_type)} {comparatorLabel(r.comparator)}{" "}
                              {r.threshold}
                            </p>
                            <p className="mt-1 text-xs text-zinc-500">
                              next {r.horizon_days} days
                            </p>
                          </div>
                          {hit ? (
                            <span className="rounded-full bg-red-500/10 px-2 py-1 text-[11px] font-medium text-red-700 dark:bg-red-500/15 dark:text-red-300">
                              {hit.date}
                            </span>
                          ) : (
                            <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                              Clear
                            </span>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>

                <Link
                  href="/alerts"
                  className="inline-flex rounded-full px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-black/[0.04] dark:text-zinc-400 dark:hover:bg-white/[0.06]"
                >
                  Manage rules →
                </Link>
              </div>
            )}
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
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill
                    label={`Current: ${freshnessLabel(currentAge).label}${currentAge == null ? "" : ` · ${currentAge}m`}`}
                    tone={freshnessLabel(currentAge).tone}
                  />
                  <StatusPill
                    label={`Hourly: ${freshnessLabel(hourlyAge).label}${hourlyAge == null ? "" : ` · ${hourlyAge}m`}`}
                    tone={freshnessLabel(hourlyAge).tone}
                  />
                  <StatusPill
                    label={`Daily: ${freshnessLabel(dailyAge).label}${dailyAge == null ? "" : ` · ${dailyAge}m`}`}
                    tone={freshnessLabel(dailyAge).tone}
                  />
                </div>

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
                <div className="flex items-center gap-4">
                  <div className="rounded-2xl border border-zinc-200/80 bg-white/60 p-3 shadow-sm ring-1 ring-black/5 backdrop-blur dark:border-zinc-800/80 dark:bg-black/30 dark:ring-white/10">
                    <WeatherIcon
                      weatherCode={currentWeather?.weather_code}
                      isDay={currentWeather?.is_day}
                      className="h-10 w-10 text-zinc-900 dark:text-zinc-50"
                    />
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">Temperature</p>
                    <p className="mt-1 text-3xl font-semibold tracking-[-0.03em] text-zinc-900 dark:text-zinc-50">
                      {tempDisplay}
                    </p>
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                      {describeWeatherCode(currentWeather?.weather_code)}
                    </p>
                  </div>
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

            {!loading && today ? (
              <div className="mt-5 grid grid-cols-2 gap-4 rounded-xl border border-zinc-200/80 bg-white/60 p-4 shadow-sm ring-1 ring-black/5 backdrop-blur dark:border-zinc-800/80 dark:bg-black/30 dark:ring-white/10 sm:grid-cols-4">
                <div>
                  <p className="text-xs text-zinc-500">Sunrise</p>
                  <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {today.sunrise ? formatDateTimeISO(today.sunrise) : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Sunset</p>
                  <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {today.sunset ? formatDateTimeISO(today.sunset) : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">UV max</p>
                  <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {today.uv_index_max == null
                      ? "—"
                      : formatNumber(today.uv_index_max, 1)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Rain chance</p>
                  <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {today.precipitation_probability_max == null
                      ? "—"
                      : `${formatNumber(today.precipitation_probability_max)}%`}
                  </p>
                </div>
              </div>
            ) : null}
          </GlassCard>

          <GlassCard
            icon={<IconSparkles className="h-4 w-4" />}
            title="Outdoor Score"
            subtitle="Next 3 days"
          >
            {loading ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Loading…
              </p>
            ) : !outdoor ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Not enough forecast data yet.
              </p>
            ) : (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs text-zinc-500">Score</p>
                  <p className="mt-1 text-3xl font-semibold tracking-[-0.03em] text-zinc-900 dark:text-zinc-50">
                    {outdoor.score}
                  </p>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    {outdoor.label}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {outdoor.reasons.length === 0 ? (
                    <span className="rounded-full bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                      Comfortable
                    </span>
                  ) : (
                    outdoor.reasons.map((r) => (
                      <span
                        key={r}
                        className="rounded-full bg-black/[0.06] px-3 py-1.5 text-xs font-medium text-zinc-800 dark:bg-white/[0.10] dark:text-zinc-100"
                      >
                        {r}
                      </span>
                    ))
                  )}
                </div>
              </div>
            )}
          </GlassCard>

          <GlassCard
            icon={<IconMapPin className="h-4 w-4" />}
            title="Map"
            subtitle="Latitude/longitude overview"
          >
            {mapLoading ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading…</p>
            ) : mapError ? (
              <div className="rounded-xl border border-red-200/70 bg-red-50/80 p-3 text-xs text-red-700 shadow-sm ring-1 ring-black/5 backdrop-blur dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300 dark:ring-white/10">
                {mapError}
              </div>
            ) : mapLocations.length === 0 ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                No cities to plot yet.
              </p>
            ) : (
              <GeoMap
                locations={mapLocations}
                selectedLocationId={selectedLocationId}
              />
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
                      <th className="px-3"> </th>
                      <th className="px-3">Day</th>
                      <th className="px-3">Max</th>
                      <th className="px-3">Min</th>
                      <th className="px-3">Rain</th>
                      <th className="px-3">Wind</th>
                      <th className="px-3">Type</th>
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
                          <td className="px-3 py-2">
                            <WeatherIcon
                              weatherCode={d.weather_code}
                              className="h-5 w-5 text-zinc-900/80 dark:text-zinc-50/80"
                            />
                          </td>
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
                            {describeWeatherCode(d.weather_code)}
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
