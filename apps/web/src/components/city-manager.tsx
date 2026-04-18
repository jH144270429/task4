"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { LocationRow } from "@/lib/types/db";
import { useAuth } from "@/components/auth-provider";
import { IconMapPin, IconPlus, IconSearch, IconStar, IconTrash } from "@/components/ui/icons";

type Props = {
  onFavoriteLocationIdsChange?: (locationIds: string[]) => void;
};

type SearchResult = {
  name: string;
  country: string | null;
  admin1: string | null;
  latitude: number;
  longitude: number;
  timezone: string;
};

export function CityManager({ onFavoriteLocationIdsChange }: Props) {
  const { user, loading: authLoading } = useAuth();
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [favoriteLocationIds, setFavoriteLocationIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const onFavoriteLocationIdsChangeRef = useRef(onFavoriteLocationIdsChange);

  useEffect(() => {
    onFavoriteLocationIdsChangeRef.current = onFavoriteLocationIdsChange;
  }, [onFavoriteLocationIdsChange]);

  const favoriteSet = useMemo(
    () => new Set(favoriteLocationIds),
    [favoriteLocationIds]
  );

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setLocations([]);
      setFavoriteLocationIds([]);
      setSelectedLocationId("");
      setSearchQuery("");
      setSearchResults([]);
      setLoading(false);
      setError(null);
      onFavoriteLocationIdsChangeRef.current?.([]);
      return;
    }

    const supabase = getSupabaseBrowserClient();
    let active = true;
    const userId = user.id;

    async function load() {
      setLoading(true);
      setError(null);

      const [locationsResult, favoritesResult] = await Promise.all([
        supabase
          .from("locations")
          .select(
            "id,name,country,latitude,longitude,timezone,created_at"
          )
          .order("name", { ascending: true }),
        supabase
          .from("favorite_locations")
          .select("location_id")
          .eq("user_id", userId),
      ]);

      if (!active) return;

      if (locationsResult.error) {
        setError(locationsResult.error.message);
        setLoading(false);
        return;
      }

      if (favoritesResult.error) {
        setError(favoritesResult.error.message);
        setLoading(false);
        return;
      }

      const favorites = favoritesResult.data.map((r) => r.location_id);
      setLocations((locationsResult.data ?? []) as LocationRow[]);
      setFavoriteLocationIds(favorites);
      setSelectedLocationId("");
      setLoading(false);
      onFavoriteLocationIdsChangeRef.current?.(favorites);
    }

    void load();

    return () => {
      active = false;
    };
  }, [authLoading, user?.id]);

  useEffect(() => {
    if (!user) return;
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }

    const controller = new AbortController();
    setSearching(true);

    const t = setTimeout(() => {
      fetch(`/api/locations/search?q=${encodeURIComponent(q)}`, {
        signal: controller.signal,
      })
        .then(async (r) => {
          if (!r.ok) {
            const json = (await r.json().catch(() => null)) as
              | { error?: string }
              | null;
            throw new Error(json?.error ?? `Search failed (${r.status})`);
          }
          return (await r.json()) as { results: SearchResult[] };
        })
        .then((json) => {
          setSearchResults(json.results ?? []);
        })
        .catch((e) => {
          if (controller.signal.aborted) return;
          setError(e?.message ?? "Search failed");
        })
        .finally(() => {
          if (controller.signal.aborted) return;
          setSearching(false);
        });
    }, 250);

    return () => {
      controller.abort();
      clearTimeout(t);
      setSearching(false);
    };
  }, [user, searchQuery]);

  const availableLocations = useMemo(
    () => locations.filter((l) => !favoriteSet.has(l.id)),
    [locations, favoriteSet]
  );

  const favoriteLocations = useMemo(
    () => locations.filter((l) => favoriteSet.has(l.id)),
    [locations, favoriteSet]
  );

  async function addFavorite() {
    if (!user || !selectedLocationId) return;
    const supabase = getSupabaseBrowserClient();
    setSaving(true);
    setError(null);

    const result = await supabase.from("favorite_locations").insert({
      user_id: user.id,
      location_id: selectedLocationId,
    });

    if (result.error) {
      setError(result.error.message);
      setSaving(false);
      return;
    }

    const next = Array.from(new Set([...favoriteLocationIds, selectedLocationId]));
    setFavoriteLocationIds(next);
    setSelectedLocationId("");
    setSaving(false);
    onFavoriteLocationIdsChangeRef.current?.(next);
  }

  async function addNewCity(result: SearchResult) {
    if (!user) return;
    setSaving(true);
    setError(null);

    const response = await fetch("/api/locations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: result.name,
        country: result.country,
        latitude: result.latitude,
        longitude: result.longitude,
        timezone: result.timezone,
      }),
    });

    const rawText = await response.text();
    const json = (() => {
      try {
        return JSON.parse(rawText) as { error?: string; location?: LocationRow };
      } catch {
        return null;
      }
    })();

    if (!response.ok || !json?.location) {
      const serverMessage =
        json?.error ??
        (rawText && rawText.length <= 200 ? rawText : null) ??
        `Add city failed (${response.status})`;
      setError(serverMessage);
      setSaving(false);
      return;
    }

    setLocations((prev) => {
      if (prev.some((l) => l.id === json.location?.id)) return prev;
      return [...prev, json.location as LocationRow].sort((a, b) =>
        a.name.localeCompare(b.name)
      );
    });
    setSelectedLocationId(json.location.id);
    setSaving(false);
  }

  async function removeFavorite(locationId: string) {
    if (!user) return;
    const supabase = getSupabaseBrowserClient();
    setSaving(true);
    setError(null);

    const result = await supabase
      .from("favorite_locations")
      .delete()
      .eq("user_id", user.id)
      .eq("location_id", locationId);

    if (result.error) {
      setError(result.error.message);
      setSaving(false);
      return;
    }

    const next = favoriteLocationIds.filter((id) => id !== locationId);
    setFavoriteLocationIds(next);
    setSaving(false);
    onFavoriteLocationIdsChangeRef.current?.(next);
  }

  return (
    <section className="rounded-2xl border border-white/60 bg-white/70 p-4 shadow-sm ring-1 ring-black/5 backdrop-blur-xl dark:border-zinc-800/70 dark:bg-black/40 dark:ring-white/10">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          <span className="text-zinc-500 dark:text-zinc-400">
            <IconStar className="h-4 w-4" />
          </span>
          My Cities
        </h2>
        {saving ? (
          <span className="text-xs text-zinc-500">Saving…</span>
        ) : null}
      </div>

      {authLoading || loading ? (
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
          Loading…
        </p>
      ) : !user ? (
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
          Sign in to save favorite cities.
        </p>
      ) : (
        <>
          <div className="mt-3">
            <label className="block text-xs font-medium text-zinc-500">
              <span className="flex items-center gap-2">
                <IconSearch className="h-4 w-4" />
                Search city
              </span>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="e.g. Paris"
                className="mt-2 w-full rounded-xl border border-zinc-200/80 bg-white/70 px-3 py-2 text-sm text-zinc-900 shadow-sm ring-1 ring-black/5 backdrop-blur dark:border-zinc-800/80 dark:bg-black/30 dark:text-zinc-50 dark:ring-white/10"
              />
            </label>

            {searching ? (
              <p className="mt-2 text-xs text-zinc-500">Searching…</p>
            ) : null}

            {searchResults.length > 0 ? (
              <ul className="mt-2 space-y-2">
                {searchResults.slice(0, 5).map((r) => (
                  <li
                    key={`${r.name}-${r.latitude}-${r.longitude}`}
                    className="flex items-center justify-between rounded-xl border border-zinc-200/80 bg-white/60 px-3 py-2 shadow-sm ring-1 ring-black/5 backdrop-blur dark:border-zinc-800/80 dark:bg-black/30 dark:ring-white/10"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                        {r.name}
                      </p>
                      <p className="truncate text-xs text-zinc-500">
                        {[
                          r.admin1,
                          r.country,
                          `${r.latitude.toFixed(4)}, ${r.longitude.toFixed(4)}`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => addNewCity(r)}
                      className="ml-3 inline-flex shrink-0 items-center gap-2 rounded-full bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white shadow-sm ring-1 ring-black/10 hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:ring-white/20 dark:hover:bg-zinc-100"
                    >
                      <IconPlus className="h-4 w-4" />
                      Add
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="mt-3 flex gap-2">
            <select
              value={selectedLocationId}
              onChange={(e) => setSelectedLocationId(e.target.value)}
              className="flex-1 rounded-xl border border-zinc-200/80 bg-white/70 px-3 py-2 text-sm text-zinc-900 shadow-sm ring-1 ring-black/5 backdrop-blur dark:border-zinc-800/80 dark:bg-black/30 dark:text-zinc-50 dark:ring-white/10"
            >
              <option value="">Add a city…</option>
              {availableLocations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                  {l.country ? `, ${l.country}` : ""}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={addFavorite}
              disabled={!selectedLocationId || saving}
              className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-3 py-2 text-sm font-medium text-white shadow-sm ring-1 ring-black/10 disabled:opacity-50 hover:bg-zinc-800 dark:bg-white dark:text-black dark:ring-white/20 dark:hover:bg-zinc-100"
            >
              <IconStar className="h-4 w-4" />
              Add
            </button>
          </div>

          <div className="mt-4">
            {favoriteLocations.length === 0 ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                No saved cities yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {favoriteLocations.map((l) => (
                  <li
                    key={l.id}
                    className="flex items-center justify-between rounded-xl border border-zinc-200/80 bg-white/60 px-3 py-2 shadow-sm ring-1 ring-black/5 backdrop-blur dark:border-zinc-800/80 dark:bg-black/30 dark:ring-white/10"
                  >
                    <span className="flex min-w-0 items-center gap-2 text-sm text-zinc-900 dark:text-zinc-50">
                      <span className="text-zinc-500 dark:text-zinc-400">
                        <IconMapPin className="h-4 w-4" />
                      </span>
                      <span className="truncate">
                        {l.name}
                        {l.country ? `, ${l.country}` : ""}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFavorite(l.id)}
                      disabled={saving}
                      className="inline-flex items-center gap-2 rounded-full px-2 py-1 text-sm font-medium text-zinc-600 hover:bg-black/[0.04] hover:text-zinc-900 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-white/[0.06] dark:hover:text-zinc-50"
                    >
                      <IconTrash className="h-4 w-4" />
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {error ? (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : null}
    </section>
  );
}
