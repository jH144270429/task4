"use client";

import { CityManager } from "@/components/city-manager";
import { useAuth } from "@/components/auth-provider";

export default function MyCitiesPage() {
  const { user } = useAuth();

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
      <div className="rounded-2xl border border-white/60 bg-white/70 p-5 shadow-sm ring-1 ring-black/5 backdrop-blur-xl dark:border-zinc-800/70 dark:bg-black/40 dark:ring-white/10">
        <h1 className="text-xl font-semibold tracking-[-0.02em] text-zinc-900 dark:text-zinc-50">
          My Cities
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {user
            ? "Manage favorites and add new cities via search."
            : "Sign in to save favorites and unlock Pro features."}
        </p>

        <div className="mt-6 max-w-xl">
          <CityManager />
        </div>
      </div>
    </main>
  );
}
