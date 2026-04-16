"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useAuth } from "@/components/auth-provider";
import type { LocationRow } from "@/lib/types/db";
import { IconSettings } from "@/components/ui/icons";

type UserPreferencesRow = {
  user_id: string;
  temperature_unit: "c" | "f";
  wind_speed_unit: "kmh" | "mph";
  default_location_id: string | null;
  timezone_display: "location" | "utc";
  time_format: "12h" | "24h";
  alerts_enabled: boolean;
  created_at: string;
  updated_at: string;
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

export default function SettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const [preferences, setPreferences] = useState<UserPreferencesRow | null>(null);
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defaultLocationOptions = useMemo(() => {
    const opts = [...locations];
    opts.sort((a, b) => a.name.localeCompare(b.name));
    return opts;
  }, [locations]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      setPreferences(null);
      setLocations([]);
      return;
    }

    const supabase = getSupabaseBrowserClient();
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);

      const [prefResult, locResult] = await Promise.all([
        supabase
          .from("user_preferences")
          .select(
            "user_id,temperature_unit,wind_speed_unit,default_location_id,timezone_display,time_format,alerts_enabled,created_at,updated_at"
          )
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("favorite_locations")
          .select(
            "location_id, locations (id,name,country,latitude,longitude,timezone,created_at)"
          )
          .eq("user_id", user.id),
      ]);

      if (!active) return;

      if (prefResult.error) {
        setError(prefResult.error.message);
      }

      const locs = locResult.error
        ? []
        : ((locResult.data ?? [])
            .map((r) => r.locations)
            .filter(Boolean) as unknown as LocationRow[]);

      setLocations(locs);

      if (prefResult.data) {
        setPreferences(prefResult.data as UserPreferencesRow);
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

      setLoading(false);
    }

    void load();

    return () => {
      active = false;
    };
  }, [authLoading, user?.id]);

  async function save() {
    if (!user || !preferences) return;
    const supabase = getSupabaseBrowserClient();
    setSaving(true);
    setError(null);

    const result = await supabase
      .from("user_preferences")
      .upsert(
        {
          user_id: user.id,
          temperature_unit: preferences.temperature_unit,
          wind_speed_unit: preferences.wind_speed_unit,
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
      .maybeSingle();

    if (result.error) {
      setError(result.error.message);
      setSaving(false);
      return;
    }

    if (result.data) setPreferences(result.data as UserPreferencesRow);
    setSaving(false);
  }

  if (authLoading) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <GlassCard
          icon={<IconSettings className="h-5 w-5" />}
          title="Settings"
          subtitle="Loading…"
        >
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading…</p>
        </GlassCard>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <GlassCard
          icon={<IconSettings className="h-5 w-5" />}
          title="Settings"
          subtitle="Preferences for your dashboard"
        >
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Sign in to edit preferences.
          </p>
        </GlassCard>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
      <GlassCard
        icon={<IconSettings className="h-5 w-5" />}
        title="Settings"
        subtitle="Units, defaults, and alert toggle"
      >
        {loading || !preferences ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading…</p>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block text-xs font-medium text-zinc-500">
                Temperature unit
                <select
                  value={preferences.temperature_unit}
                  onChange={(e) =>
                    setPreferences((p) =>
                      p ? { ...p, temperature_unit: e.target.value as "c" | "f" } : p
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-zinc-200/80 bg-white/70 px-3 py-2 text-sm text-zinc-900 shadow-sm ring-1 ring-black/5 backdrop-blur dark:border-zinc-800/80 dark:bg-black/30 dark:text-zinc-50 dark:ring-white/10"
                >
                  <option value="c">℃</option>
                  <option value="f">℉</option>
                </select>
              </label>

              <label className="block text-xs font-medium text-zinc-500">
                Wind speed unit
                <select
                  value={preferences.wind_speed_unit}
                  onChange={(e) =>
                    setPreferences((p) =>
                      p
                        ? { ...p, wind_speed_unit: e.target.value as "kmh" | "mph" }
                        : p
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-zinc-200/80 bg-white/70 px-3 py-2 text-sm text-zinc-900 shadow-sm ring-1 ring-black/5 backdrop-blur dark:border-zinc-800/80 dark:bg-black/30 dark:text-zinc-50 dark:ring-white/10"
                >
                  <option value="kmh">km/h</option>
                  <option value="mph">mph</option>
                </select>
              </label>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block text-xs font-medium text-zinc-500">
                Time format
                <select
                  value={preferences.time_format}
                  onChange={(e) =>
                    setPreferences((p) =>
                      p ? { ...p, time_format: e.target.value as "12h" | "24h" } : p
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-zinc-200/80 bg-white/70 px-3 py-2 text-sm text-zinc-900 shadow-sm ring-1 ring-black/5 backdrop-blur dark:border-zinc-800/80 dark:bg-black/30 dark:text-zinc-50 dark:ring-white/10"
                >
                  <option value="24h">24h</option>
                  <option value="12h">12h</option>
                </select>
              </label>

              <label className="block text-xs font-medium text-zinc-500">
                Timezone display
                <select
                  value={preferences.timezone_display}
                  onChange={(e) =>
                    setPreferences((p) =>
                      p
                        ? {
                            ...p,
                            timezone_display: e.target.value as "location" | "utc",
                          }
                        : p
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-zinc-200/80 bg-white/70 px-3 py-2 text-sm text-zinc-900 shadow-sm ring-1 ring-black/5 backdrop-blur dark:border-zinc-800/80 dark:bg-black/30 dark:text-zinc-50 dark:ring-white/10"
                >
                  <option value="location">Location timezone</option>
                  <option value="utc">UTC</option>
                </select>
              </label>
            </div>

            <label className="block text-xs font-medium text-zinc-500">
              Default city (from favorites)
              <select
                value={preferences.default_location_id ?? ""}
                onChange={(e) =>
                  setPreferences((p) =>
                    p
                      ? {
                          ...p,
                          default_location_id: e.target.value ? e.target.value : null,
                        }
                      : p
                  )
                }
                className="mt-2 w-full rounded-xl border border-zinc-200/80 bg-white/70 px-3 py-2 text-sm text-zinc-900 shadow-sm ring-1 ring-black/5 backdrop-blur dark:border-zinc-800/80 dark:bg-black/30 dark:text-zinc-50 dark:ring-white/10"
              >
                <option value="">Not set</option>
                {defaultLocationOptions.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                    {l.country ? `, ${l.country}` : ""}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center justify-between rounded-xl border border-zinc-200/80 bg-white/60 px-3 py-2 text-sm shadow-sm ring-1 ring-black/5 backdrop-blur dark:border-zinc-800/80 dark:bg-black/30 dark:ring-white/10">
              <span className="font-medium text-zinc-900 dark:text-zinc-50">
                Alerts enabled
              </span>
              <input
                type="checkbox"
                checked={preferences.alerts_enabled}
                onChange={(e) =>
                  setPreferences((p) =>
                    p ? { ...p, alerts_enabled: e.target.checked } : p
                  )
                }
                className="h-4 w-4"
              />
            </label>

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl bg-zinc-900 px-3 py-2 text-sm font-medium text-white shadow-sm ring-1 ring-black/10 hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:ring-white/20 dark:hover:bg-zinc-100"
            >
              {saving ? "Saving…" : "Save settings"}
            </button>

            {error ? (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            ) : null}
          </form>
        )}
      </GlassCard>
    </main>
  );
}
