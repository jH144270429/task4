"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useAuth } from "@/components/auth-provider";
import type { LocationRow } from "@/lib/types/db";
import { cToF, formatDateISO, formatNumber } from "@/components/pro/format";
import { IconCompare } from "@/components/ui/icons";

type TemperatureUnit = "c" | "f";

type DailyForecastRow = {
  location_id: string;
  forecast_date: string;
  temp_max_c: number | null;
  temp_min_c: number | null;
  precipitation_probability_max: number | null;
  wind_speed_max_kmh: number | null;
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
          <div className="mt-4 overflow-x-auto">
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
        )}
      </GlassCard>
    </main>
  );
}
