"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useAuth } from "@/components/auth-provider";
import type { LocationRow } from "@/lib/types/db";
import { IconBell } from "@/components/ui/icons";

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

export default function AlertsPage() {
  const { user, loading: authLoading } = useAuth();
  const [rules, setRules] = useState<AlertRuleRow[]>([]);
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [locationId, setLocationId] = useState<string>("");
  const [ruleType, setRuleType] = useState<RuleType>("precipitation");
  const [comparator, setComparator] = useState<Comparator>("gt");
  const [threshold, setThreshold] = useState<string>("10");
  const [horizonDays, setHorizonDays] = useState<string>("3");

  const locationById = useMemo(() => {
    const map = new Map<string, LocationRow>();
    for (const l of locations) map.set(l.id, l);
    return map;
  }, [locations]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      setRules([]);
      setLocations([]);
      return;
    }

    const supabase = getSupabaseBrowserClient();
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);

      const [rulesResult, locationsResult] = await Promise.all([
        supabase
          .from("alert_rules")
          .select(
            "id,user_id,location_id,rule_type,comparator,threshold,horizon_days,enabled,created_at,updated_at"
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("favorite_locations")
          .select(
            "location_id, locations (id,name,country,latitude,longitude,timezone,created_at)"
          )
          .eq("user_id", user.id),
      ]);

      if (!active) return;

      if (rulesResult.error) {
        setError(rulesResult.error.message);
        setLoading(false);
        return;
      }

      if (locationsResult.error) {
        setError(locationsResult.error.message);
        setLoading(false);
        return;
      }

      const locs = (locationsResult.data ?? [])
        .map((r) => r.locations)
        .filter(Boolean) as unknown as LocationRow[];
      locs.sort((a, b) => a.name.localeCompare(b.name));

      setRules((rulesResult.data ?? []) as AlertRuleRow[]);
      setLocations(locs);
      setLoading(false);
    }

    void load();

    return () => {
      active = false;
    };
  }, [authLoading, user?.id]);

  async function addRule(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setError(null);

    const thresholdNumber = Number(threshold);
    const horizonNumber = Number(horizonDays);
    if (!Number.isFinite(thresholdNumber)) {
      setError("Threshold must be a number");
      setSaving(false);
      return;
    }
    if (!Number.isFinite(horizonNumber) || horizonNumber < 1 || horizonNumber > 15) {
      setError("Horizon days must be between 1 and 15");
      setSaving(false);
      return;
    }

    const supabase = getSupabaseBrowserClient();
    const result = await supabase
      .from("alert_rules")
      .insert({
        user_id: user.id,
        location_id: locationId || null,
        rule_type: ruleType,
        comparator,
        threshold: thresholdNumber,
        horizon_days: horizonNumber,
        enabled: true,
      })
      .select(
        "id,user_id,location_id,rule_type,comparator,threshold,horizon_days,enabled,created_at,updated_at"
      )
      .maybeSingle();

    if (result.error) {
      setError(result.error.message);
      setSaving(false);
      return;
    }

    if (result.data) setRules((prev) => [result.data as AlertRuleRow, ...prev]);
    setSaving(false);
  }

  async function toggleEnabled(id: string, enabled: boolean) {
    if (!user) return;
    const supabase = getSupabaseBrowserClient();
    setSaving(true);
    setError(null);

    const result = await supabase
      .from("alert_rules")
      .update({ enabled })
      .eq("id", id)
      .eq("user_id", user.id);

    if (result.error) {
      setError(result.error.message);
      setSaving(false);
      return;
    }

    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, enabled } : r)));
    setSaving(false);
  }

  async function removeRule(id: string) {
    if (!user) return;
    const supabase = getSupabaseBrowserClient();
    setSaving(true);
    setError(null);

    const result = await supabase
      .from("alert_rules")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (result.error) {
      setError(result.error.message);
      setSaving(false);
      return;
    }

    setRules((prev) => prev.filter((r) => r.id !== id));
    setSaving(false);
  }

  if (authLoading) {
    return (
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <GlassCard icon={<IconBell className="h-5 w-5" />} title="Alerts" subtitle="Loading…">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading…</p>
        </GlassCard>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <GlassCard
          icon={<IconBell className="h-5 w-5" />}
          title="Alerts"
          subtitle="Rules for rain/heat/wind"
        >
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Sign in to create alert rules.
          </p>
        </GlassCard>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[420px_1fr]">
        <GlassCard
          icon={<IconBell className="h-5 w-5" />}
          title="New Rule"
          subtitle="Create a rule like “rain > 10mm in 3 days”"
        >
          <form onSubmit={addRule} className="space-y-4">
            <label className="block text-xs font-medium text-zinc-500">
              City (optional)
              <select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                className="mt-2 w-full rounded-xl border border-zinc-200/80 bg-white/70 px-3 py-2 text-sm text-zinc-900 shadow-sm ring-1 ring-black/5 backdrop-blur dark:border-zinc-800/80 dark:bg-black/30 dark:text-zinc-50 dark:ring-white/10"
              >
                <option value="">Any favorite city</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                    {l.country ? `, ${l.country}` : ""}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs font-medium text-zinc-500">
                Type
                <select
                  value={ruleType}
                  onChange={(e) => setRuleType(e.target.value as RuleType)}
                  className="mt-2 w-full rounded-xl border border-zinc-200/80 bg-white/70 px-3 py-2 text-sm text-zinc-900 shadow-sm ring-1 ring-black/5 backdrop-blur dark:border-zinc-800/80 dark:bg-black/30 dark:text-zinc-50 dark:ring-white/10"
                >
                  <option value="precipitation">Precipitation</option>
                  <option value="temperature_max">Max Temperature</option>
                  <option value="wind_speed">Wind Speed</option>
                </select>
              </label>

              <label className="block text-xs font-medium text-zinc-500">
                Comparator
                <select
                  value={comparator}
                  onChange={(e) => setComparator(e.target.value as Comparator)}
                  className="mt-2 w-full rounded-xl border border-zinc-200/80 bg-white/70 px-3 py-2 text-sm text-zinc-900 shadow-sm ring-1 ring-black/5 backdrop-blur dark:border-zinc-800/80 dark:bg-black/30 dark:text-zinc-50 dark:ring-white/10"
                >
                  <option value="gt">{">"}</option>
                  <option value="gte">{"≥"}</option>
                  <option value="lt">{"<"}</option>
                  <option value="lte">{"≤"}</option>
                </select>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs font-medium text-zinc-500">
                Threshold
                <input
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-zinc-200/80 bg-white/70 px-3 py-2 text-sm text-zinc-900 shadow-sm ring-1 ring-black/5 backdrop-blur dark:border-zinc-800/80 dark:bg-black/30 dark:text-zinc-50 dark:ring-white/10"
                />
              </label>
              <label className="block text-xs font-medium text-zinc-500">
                Horizon (days)
                <input
                  value={horizonDays}
                  onChange={(e) => setHorizonDays(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-zinc-200/80 bg-white/70 px-3 py-2 text-sm text-zinc-900 shadow-sm ring-1 ring-black/5 backdrop-blur dark:border-zinc-800/80 dark:bg-black/30 dark:text-zinc-50 dark:ring-white/10"
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl bg-zinc-900 px-3 py-2 text-sm font-medium text-white shadow-sm ring-1 ring-black/10 hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:ring-white/20 dark:hover:bg-zinc-100"
            >
              {saving ? "Saving…" : "Create rule"}
            </button>

            {error ? (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            ) : null}
          </form>
        </GlassCard>

        <GlassCard
          icon={<IconBell className="h-5 w-5" />}
          title="My Rules"
          subtitle="Enable/disable rules and manage your list"
        >
          {loading ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading…</p>
          ) : rules.length === 0 ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              No rules yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {rules.map((r) => {
                const loc = r.location_id ? locationById.get(r.location_id) : null;
                return (
                  <li
                    key={r.id}
                    className="rounded-xl border border-zinc-200/80 bg-white/60 p-3 shadow-sm ring-1 ring-black/5 backdrop-blur dark:border-zinc-800/80 dark:bg-black/30 dark:ring-white/10"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                          {ruleTypeLabel(r.rule_type)} {comparatorLabel(r.comparator)}{" "}
                          {r.threshold}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">
                          {loc
                            ? `${loc.name}${loc.country ? `, ${loc.country}` : ""}`
                            : "Any favorite city"}{" "}
                          · next {r.horizon_days} days
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleEnabled(r.id, !r.enabled)}
                          disabled={saving}
                          className={[
                            "rounded-full px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50",
                            r.enabled
                              ? "bg-black/[0.06] text-zinc-900 dark:bg-white/[0.10] dark:text-zinc-50"
                              : "text-zinc-600 hover:bg-black/[0.04] dark:text-zinc-400 dark:hover:bg-white/[0.06]",
                          ].join(" ")}
                        >
                          {r.enabled ? "Enabled" : "Disabled"}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeRule(r.id)}
                          disabled={saving}
                          className="rounded-full px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-black/[0.04] disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-white/[0.06]"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </GlassCard>
      </div>
    </main>
  );
}
