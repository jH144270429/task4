"use client";

import { CityManager } from "@/components/city-manager";
import { useAuth } from "@/components/auth-provider";
import { IconMapPin, IconSearch, IconStar } from "@/components/ui/icons";

export default function MyCitiesPage() {
  const { user } = useAuth();

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
      <div className="rounded-2xl border border-white/60 bg-white/70 p-5 shadow-sm ring-1 ring-black/5 backdrop-blur-xl dark:border-zinc-800/70 dark:bg-black/40 dark:ring-white/10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-semibold tracking-[-0.02em] text-zinc-900 dark:text-zinc-50">
              <span className="text-zinc-500 dark:text-zinc-400">
                <IconMapPin className="h-5 w-5" />
              </span>
              My Cities
            </h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {user
                ? "Manage favorites and add new cities via search."
                : "Sign in to save favorites and unlock Pro features."}
            </p>
          </div>

          {user ? (
            <div className="hidden items-center gap-2 sm:flex">
              <span className="inline-flex items-center gap-2 rounded-full bg-black/[0.06] px-3 py-1.5 text-xs font-medium text-zinc-800 dark:bg-white/[0.10] dark:text-zinc-100">
                <IconSearch className="h-4 w-4" />
                Search
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-black/[0.06] px-3 py-1.5 text-xs font-medium text-zinc-800 dark:bg-white/[0.10] dark:text-zinc-100">
                <IconStar className="h-4 w-4" />
                Favorites
              </span>
            </div>
          ) : null}
        </div>

        <div className="mt-6 max-w-xl">
          <CityManager />
        </div>
      </div>
    </main>
  );
}
