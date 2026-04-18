"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useAuth } from "@/components/auth-provider";
import type { LocationRow } from "@/lib/types/db";
import { cToF, formatDateISO, formatNumber } from "@/components/pro/format";
import { IconCompare } from "@/components/ui/icons";

type TemperatureUnit = "c" | "f";
type Metric = "temperature" | "rain" | "wind";

type DailyForecastRow = {
  location_id: string;
  forecast_date: string;
  temp_max_c: number | null;
  temp_min_c: number | null;
  precipitation_probability_max: number | null;
  wind_speed_max_kmh: number | null;
};

function MultiCityMetricChart({
  dates,
  locations,
  byCityAndDate,
  temperatureUnit,
  metric,
}: {
  dates: string[];
  locations: LocationRow[];
  byCityAndDate: Map<string, DailyForecastRow>;
  temperatureUnit: TemperatureUnit;
  metric: Metric;
}) {
  const palette = ["#0f172a", "#2563eb", "#16a34a", "#a855f7"];
  const series = locations.map((l) => {
    const values = dates.map((d) => {
      const row = byCityAndDate.get(`${l.id}:${d}`);
      if (!row) return null;
      const raw =
        metric === "temperature"
          ? row.temp_max_c
          : metric === "rain"
            ? row.precipitation_probability_max
            : row.wind_speed_max_kmh;
      if (raw == null || !Number.isFinite(raw)) return null;
      if (metric === "temperature") return temperatureUnit === "c" ? raw : cToF(raw);
      return raw;
    });
    return { location: l, values };
  });

  const allValues = series.flatMap((s) => s.values).filter((v): v is number => v != null);
  if (allValues.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200/80 bg-white/60 p-3 text-sm text-zinc-600 shadow-sm ring-1 ring-black/5 backdrop-blur dark:border-zinc-800/80 dark:bg-black/30 dark:text-zinc-400 dark:ring-white/10">
        Not enough data for chart.
      </div>
    );
  }

  const min = metric === "rain" ? 0 : Math.min(...allValues);
  const max = metric === "rain" ? 100 : Math.max(...allValues);
  const pad = metric === "rain" ? 0 : Math.max(1, (max - min) * 0.12);
  const yMin = min - pad;
  const yMax = max + pad;
  const range = yMax - yMin || 1;

  const left = 34;
  const right = 10;
  const top = 10;
  const bottom = 28;
  const width = 520;
  const height = 200;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;

  const yTicks = [
    { v: yMax, label: formatNumber(yMax, 0) },
    { v: yMin + range / 2, label: formatNumber(yMin + range / 2, 0) },
    { v: yMin, label: formatNumber(yMin, 0) },
  ];

  const xTicks = dates.map((d, idx) => {
    const label = idx === 0 || idx === dates.length - 1 || idx === Math.floor(dates.length / 2)
      ? formatDateISO(d).split(" ").slice(-2).join(" ")
      : "";
    return { idx, label };
  });

  return (
    <div className="rounded-xl border border-zinc-200/80 bg-white/60 p-3 shadow-sm ring-1 ring-black/5 backdrop-blur dark:border-zinc-800/80 dark:bg-black/30 dark:ring-white/10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-zinc-500">
            {metric === "temperature"
              ? "Max temperature (next 7 days)"
              : metric === "rain"
                ? "Rain probability (next 7 days)"
                : "Wind speed (next 7 days)"}
          </p>
          <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-50">
            {metric === "temperature"
              ? `${formatNumber(min, 1)}–${formatNumber(max, 1)}°${temperatureUnit.toUpperCase()}`
              : metric === "rain"
                ? `${formatNumber(min, 0)}–${formatNumber(max, 0)}%`
                : `${formatNumber(min, 0)}–${formatNumber(max, 0)} km/h`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {series.map((s, idx) => (
            <span
              key={s.location.id}
              className="inline-flex items-center gap-2 rounded-full bg-black/[0.06] px-3 py-1 text-xs font-medium text-zinc-800 dark:bg-white/[0.10] dark:text-zinc-100"
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: palette[idx % palette.length] }}
              />
              {s.location.name}
            </span>
          ))}
        </div>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="mt-3 h-44 w-full">
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
          {yTicks.map((t, i) => {
            const y = top + (1 - (t.v - yMin) / range) * plotHeight;
            return (
              <text key={i} x={left - 6} y={y + 3} fontSize="9" textAnchor="end">
                {t.label}
              </text>
            );
          })}
        </g>

        <g className="text-zinc-500" fill="currentColor">
          {xTicks.map((t) => {
            const x = left + (t.idx / Math.max(1, dates.length - 1)) * plotWidth;
            return (
              <g key={t.idx}>
                <line
                  x1={x}
                  y1={top + plotHeight}
                  x2={x}
                  y2={top + plotHeight + 3}
                  stroke="currentColor"
                  strokeWidth="1"
                  opacity="0.35"
                />
                {t.label ? (
                  <text x={x} y={height - 8} fontSize="9" textAnchor="middle">
                    {t.label}
                  </text>
                ) : null}
              </g>
            );
          })}
        </g>

        {series.map((s, idx) => {
          const points = s.values
            .map((v, i) => {
              if (v == null) return null;
              const x = left + (i / Math.max(1, dates.length - 1)) * plotWidth;
              const y = top + (1 - (v - yMin) / range) * plotHeight;
              return `${x.toFixed(2)},${y.toFixed(2)}`;
            })
            .filter(Boolean)
            .join(" ");
          const color = palette[idx % palette.length];
          return (
            <polyline
              key={s.location.id}
              points={points}
              fill="none"
              stroke={color}
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity={0.9}
            />
          );
        })}
      </svg>
    </div>
  );
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
      <header>
        <div className="flex items-start gap-2">
          {icon ? (
            <span className="mt-0.5 text-zinc-500 dark:text-zinc-400">{icon}</span>
          ) : null}
          <h1 className="text-lg font-semibold tracking-[-0.02em] text-zinc-900 dark:text-zinc-50">
            {title}
          </h1>
        </div>
        {subtitle ? (
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {subtitle}
          </p>
        ) : null}
      </header>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function ComparePage() {
  const { user, loading: authLoading } = useAuth();
  const [temperatureUnit, setTemperatureUnit] = useState<TemperatureUnit>("c");
  const [metric, setMetric] = useState<Metric>("temperature");
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [forecasts, setForecasts] = useState<DailyForecastRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      setLocations([]);
      setSelectedIds([]);
      return;
    }

    const supabase = getSupabaseBrowserClient();
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);

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
      rows.sort((a, b) => a.name.localeCompare(b.name));
      setLocations(rows);
      setLoading(false);

      setSelectedIds((prev) => {
        const valid = prev.filter((id) => rows.some((l) => l.id === id));
        if (valid.length > 0) return valid;
        return rows.slice(0, 2).map((l) => l.id);
      });
    }

    void load();

    return () => {
      active = false;
    };
  }, [authLoading, user?.id]);

  useEffect(() => {
    if (!user) return;
    if (selectedIds.length < 2) return;

    const supabase = getSupabaseBrowserClient();
    let active = true;

    async function loadForecasts() {
      setError(null);
      const result = await supabase
        .from("daily_forecasts")
        .select(
          "location_id,forecast_date,temp_max_c,temp_min_c,precipitation_probability_max,wind_speed_max_kmh"
        )
        .in("location_id", selectedIds)
        .order("forecast_date", { ascending: true })
        .limit(15 * 4);

      if (!active) return;
      if (result.error) {
        setError(result.error.message);
        setForecasts([]);
        return;
      }

      setForecasts((result.data ?? []) as DailyForecastRow[]);
    }

    void loadForecasts();

    return () => {
      active = false;
    };
  }, [user?.id, selectedIds.join(",")]);

  const dates = useMemo(() => {
    const set = new Set<string>();
    for (const r of forecasts) set.add(r.forecast_date);
    return Array.from(set).sort();
  }, [forecasts]);

  const byCityAndDate = useMemo(() => {
    const map = new Map<string, DailyForecastRow>();
    for (const r of forecasts) {
      map.set(`${r.location_id}:${r.forecast_date}`, r);
    }
    return map;
  }, [forecasts]);

  const selectedLocations = useMemo(
    () => locations.filter((l) => selectedIds.includes(l.id)),
    [locations, selectedIds]
  );

  function toggleCity(id: string) {
    setSelectedIds((prev) => {
      const has = prev.includes(id);
      if (has) return prev.filter((x) => x !== id);
      if (prev.length >= 4) return prev;
      return [...prev, id];
    });
  }

  if (authLoading) {
    return (
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <GlassCard
          icon={<IconCompare className="h-5 w-5" />}
          title="Compare"
          subtitle="Loading…"
        >
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading…</p>
        </GlassCard>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <GlassCard
          icon={<IconCompare className="h-5 w-5" />}
          title="Compare"
          subtitle="Compare 2–4 cities over 15 days"
        >
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Sign in to compare your favorite cities.
          </p>
        </GlassCard>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
      <GlassCard
        icon={<IconCompare className="h-5 w-5" />}
        title="Compare"
        subtitle="Select 2–4 cities from your favorites"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {locations.map((l) => {
              const active = selectedIds.includes(l.id);
              const disabled = !active && selectedIds.length >= 4;
              return (
                <button
                  key={l.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => toggleCity(l.id)}
                  className={[
                    "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                    active
                      ? "bg-black/[0.06] text-zinc-900 dark:bg-white/[0.10] dark:text-zinc-50"
                      : "text-zinc-600 hover:bg-black/[0.04] disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-white/[0.06]",
                  ].join(" ")}
                >
                  {l.name}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-full border border-zinc-200/80 bg-white/60 p-1 shadow-sm ring-1 ring-black/5 dark:border-zinc-800/80 dark:bg-black/40 dark:ring-white/10">
              <button
                type="button"
                onClick={() => setMetric("temperature")}
                className={[
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  metric === "temperature"
                    ? "bg-black/[0.06] text-zinc-900 dark:bg-white/[0.10] dark:text-zinc-50"
                    : "text-zinc-600 hover:bg-black/[0.04] dark:text-zinc-400 dark:hover:bg-white/[0.06]",
                ].join(" ")}
              >
                Temp
              </button>
              <button
                type="button"
                onClick={() => setMetric("rain")}
                className={[
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  metric === "rain"
                    ? "bg-black/[0.06] text-zinc-900 dark:bg-white/[0.10] dark:text-zinc-50"
                    : "text-zinc-600 hover:bg-black/[0.04] dark:text-zinc-400 dark:hover:bg-white/[0.06]",
                ].join(" ")}
              >
                Rain
              </button>
              <button
                type="button"
                onClick={() => setMetric("wind")}
                className={[
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  metric === "wind"
                    ? "bg-black/[0.06] text-zinc-900 dark:bg-white/[0.10] dark:text-zinc-50"
                    : "text-zinc-600 hover:bg-black/[0.04] dark:text-zinc-400 dark:hover:bg-white/[0.06]",
                ].join(" ")}
              >
                Wind
              </button>
            </div>

            <div className="flex items-center gap-2 rounded-full border border-zinc-200/80 bg-white/60 p-1 shadow-sm ring-1 ring-black/5 dark:border-zinc-800/80 dark:bg-black/40 dark:ring-white/10">
            <button
              type="button"
              onClick={() => setTemperatureUnit("c")}
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
              onClick={() => setTemperatureUnit("f")}
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
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-red-200/70 bg-red-50/80 p-3 text-sm text-red-700 shadow-sm ring-1 ring-black/5 backdrop-blur dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300 dark:ring-white/10">
            {error}
          </div>
        ) : null}

        {loading ? (
          <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
            Loading…
          </p>
        ) : selectedIds.length < 2 ? (
          <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
            Pick at least 2 cities to compare.
          </p>
        ) : dates.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
            No daily forecasts yet. Run updated SQL and restart worker.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            <MultiCityMetricChart
              dates={dates.slice(0, 7)}
              locations={selectedLocations}
              byCityAndDate={byCityAndDate}
              temperatureUnit={temperatureUnit}
              metric={metric}
            />

            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-separate border-spacing-y-2 text-sm">
                <thead>
                  <tr className="text-left text-xs text-zinc-500">
                    <th className="px-3">Day</th>
                    {selectedLocations.map((l) => (
                      <th key={l.id} className="px-3">
                        {l.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dates.slice(0, 15).map((date) => (
                    <tr
                      key={date}
                      className="rounded-xl border border-zinc-200/80 bg-white/60 shadow-sm ring-1 ring-black/5 backdrop-blur dark:border-zinc-800/80 dark:bg-black/30 dark:ring-white/10"
                    >
                      <td className="px-3 py-2 font-medium text-zinc-900 dark:text-zinc-50">
                        {formatDateISO(date)}
                      </td>
                      {selectedLocations.map((l) => {
                        const r = byCityAndDate.get(`${l.id}:${date}`);
                        const max =
                          r?.temp_max_c == null
                            ? null
                            : temperatureUnit === "c"
                              ? r.temp_max_c
                              : cToF(r.temp_max_c);
                        const min =
                          r?.temp_min_c == null
                            ? null
                            : temperatureUnit === "c"
                              ? r.temp_min_c
                              : cToF(r.temp_min_c);
                        return (
                          <td key={l.id} className="px-3 py-2">
                            <div className="text-zinc-900 dark:text-zinc-50">
                              {max == null
                                ? "—"
                                : `${formatNumber(max, 1)}°${temperatureUnit.toUpperCase()}`}{" "}
                              /{" "}
                              {min == null
                                ? "—"
                                : `${formatNumber(min, 1)}°${temperatureUnit.toUpperCase()}`}
                            </div>
                            <div className="mt-0.5 text-xs text-zinc-500">
                              {r?.precipitation_probability_max == null
                                ? "—"
                                : `${formatNumber(r.precipitation_probability_max)}%`}{" "}
                              rain ·{" "}
                              {r?.wind_speed_max_kmh == null
                                ? "—"
                                : `${formatNumber(r.wind_speed_max_kmh, 1)} km/h`}{" "}
                              wind
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </GlassCard>
    </main>
  );
}
