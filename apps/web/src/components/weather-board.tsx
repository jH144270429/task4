"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { CurrentWeatherRow, LocationRow } from "@/lib/types/db";
import { describeWeatherCode, formatUpdatedAt } from "@/lib/weather";
import { useAuth } from "@/components/auth-provider";

type Props = {
  favoriteLocationIds: string[];
};

export function WeatherBoard({ favoriteLocationIds }: Props) {
  const { user, loading: authLoading } = useAuth();
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [weatherByLocationId, setWeatherByLocationId] = useState<
    Record<string, CurrentWeatherRow | undefined>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const locationIds = useMemo(
    () =>
      user
        ? favoriteLocationIds
        : locations.map((l) => l.id),
    [user, favoriteLocationIds, locations]
  );

  useEffect(() => {
    if (authLoading) return;

    const supabase = getSupabaseBrowserClient();
    let active = true;

    async function loadLocations() {
      setLoading(true);
      setError(null);

      if (user) {
        if (favoriteLocationIds.length === 0) {
          setLocations([]);
          setWeatherByLocationId({});
          setLoading(false);
          return;
        }

        const result = await supabase
          .from("locations")
          .select(
            "id,name,country,latitude,longitude,timezone,created_at"
          )
          .in("id", favoriteLocationIds);

        if (!active) return;

        if (result.error) {
          setError(result.error.message);
          setLoading(false);
          return;
        }

        const rows = (result.data ?? []) as LocationRow[];
        rows.sort((a, b) => a.name.localeCompare(b.name));
        setLocations(rows);
        setLoading(false);
        return;
      }

      const result = await supabase
        .from("locations")
        .select(
          "id,name,country,latitude,longitude,timezone,created_at"
        )
        .order("name", { ascending: true })
        .limit(6);

      if (!active) return;

      if (result.error) {
        setError(result.error.message);
        setLoading(false);
        return;
      }

      setLocations((result.data ?? []) as LocationRow[]);
      setLoading(false);
    }

    void loadLocations();

    return () => {
      active = false;
    };
  }, [authLoading, user, favoriteLocationIds]);

  useEffect(() => {
    if (authLoading) return;
    if (locationIds.length === 0) return;

    const supabase = getSupabaseBrowserClient();
    let active = true;

    async function initialFetch() {
      setError(null);
      const result = await supabase
        .from("current_weather")
        .select(
          "location_id,temperature_c,apparent_temperature_c,relative_humidity,wind_speed_kmh,precipitation,weather_code,is_day,observed_at,updated_at"
        )
        .in("location_id", locationIds);

      if (!active) return;

      if (result.error) {
        setError(result.error.message);
        return;
      }

      const next: Record<string, CurrentWeatherRow> = {};
      for (const row of (result.data ?? []) as CurrentWeatherRow[]) {
        next[row.location_id] = row;
      }
      setWeatherByLocationId(next);
    }

    void initialFetch();

    const channel = supabase
      .channel(`current-weather:${locationIds.join(",")}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "current_weather" },
        (payload) => {
          const locationId =
            (payload.new as { location_id?: string } | null)?.location_id ??
            (payload.old as { location_id?: string } | null)?.location_id;
          if (!locationId) return;
          if (!locationIds.includes(locationId)) return;

          if (payload.eventType === "DELETE") {
            setWeatherByLocationId((prev) => {
              const { [locationId]: _omit, ...rest } = prev;
              return rest;
            });
            return;
          }

          setWeatherByLocationId((prev) => ({
            ...prev,
            [locationId]: payload.new as CurrentWeatherRow,
          }));
        }
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [authLoading, locationIds.join(",")]);

  if (authLoading || loading) {
    return (
      <div className="rounded-2xl border border-white/60 bg-white/70 p-6 shadow-sm ring-1 ring-black/5 backdrop-blur-xl dark:border-zinc-800/70 dark:bg-black/40 dark:ring-white/10">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading…</p>
      </div>
    );
  }

  if (user && favoriteLocationIds.length === 0) {
    return (
      <div className="rounded-2xl border border-white/60 bg-white/70 p-6 shadow-sm ring-1 ring-black/5 backdrop-blur-xl dark:border-zinc-800/70 dark:bg-black/40 dark:ring-white/10">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          No saved cities yet. Add some from the right panel.
        </p>
      </div>
    );
  }

  return (
    <section>
      {error ? (
        <div className="mb-4 rounded-2xl border border-red-200/70 bg-red-50/80 p-4 text-sm text-red-700 shadow-sm ring-1 ring-black/5 backdrop-blur dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300 dark:ring-white/10">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {locations.map((loc) => {
          const w = weatherByLocationId[loc.id];
          return (
            <article
              key={loc.id}
              className="rounded-2xl border border-white/60 bg-white/70 p-4 shadow-sm ring-1 ring-black/5 backdrop-blur-xl dark:border-zinc-800/70 dark:bg-black/40 dark:ring-white/10"
            >
              <header className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                    {loc.name}
                  </h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {loc.country ?? "—"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[28px] font-semibold leading-8 tracking-[-0.02em] text-zinc-900 dark:text-zinc-50">
                    {w?.temperature_c == null ? "—" : `${w.temperature_c}°C`}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {describeWeatherCode(w?.weather_code)}
                  </p>
                </div>
              </header>

              <dl className="mt-4 grid grid-cols-2 gap-3">
                <div>
                  <dt className="text-xs text-zinc-500">Feels like</dt>
                  <dd className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {w?.apparent_temperature_c == null
                      ? "—"
                      : `${w.apparent_temperature_c}°C`}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-zinc-500">Humidity</dt>
                  <dd className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {w?.relative_humidity == null
                      ? "—"
                      : `${w.relative_humidity}%`}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-zinc-500">Wind</dt>
                  <dd className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {w?.wind_speed_kmh == null
                      ? "—"
                      : `${w.wind_speed_kmh} km/h`}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-zinc-500">Precip</dt>
                  <dd className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {w?.precipitation == null
                      ? "—"
                      : `${w.precipitation} mm`}
                  </dd>
                </div>
              </dl>

              <p className="mt-4 text-xs text-zinc-500">
                Updated: {formatUpdatedAt(w?.updated_at)}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
