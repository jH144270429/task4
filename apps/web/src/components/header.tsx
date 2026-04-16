"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useAuth } from "@/components/auth-provider";
import {
  IconBell,
  IconCompare,
  IconDashboard,
  IconMapPin,
  IconSettings,
} from "@/components/ui/icons";

function NavLink({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: ReactNode;
}) {
  const pathname = usePathname();
  const active = pathname === href;

  return (
    <Link
      href={href}
      className={[
        "group flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-black/[0.06] text-zinc-900 dark:bg-white/[0.08] dark:text-zinc-50"
          : "text-zinc-600 hover:bg-black/[0.04] hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/[0.06] dark:hover:text-zinc-50",
      ].join(" ")}
    >
      <span className="text-zinc-500 group-hover:text-zinc-900 dark:text-zinc-400 dark:group-hover:text-zinc-50">
        {icon}
      </span>
      {label}
    </Link>
  );
}

export function Header() {
  const router = useRouter();
  const { user, loading } = useAuth();

  async function handleSignOut() {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-50 border-b border-white/60 bg-white/70 backdrop-blur-xl dark:border-zinc-800/70 dark:bg-black/40">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <Link
            href="/dashboard"
            className="text-[15px] font-semibold tracking-[-0.01em] text-zinc-900 dark:text-zinc-50"
          >
            Weather Pulse
          </Link>
          <nav className="hidden items-center gap-4 sm:flex">
            <NavLink
              href="/dashboard"
              label="Dashboard"
              icon={<IconDashboard className="h-4 w-4" />}
            />
            <NavLink
              href="/my-cities"
              label="My Cities"
              icon={<IconMapPin className="h-4 w-4" />}
            />
            <NavLink
              href="/compare"
              label="Compare"
              icon={<IconCompare className="h-4 w-4" />}
            />
            <NavLink
              href="/alerts"
              label="Alerts"
              icon={<IconBell className="h-4 w-4" />}
            />
            <NavLink
              href="/settings"
              label="Settings"
              icon={<IconSettings className="h-4 w-4" />}
            />
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {loading ? (
            <span className="text-sm text-zinc-500">Loading…</span>
          ) : user ? (
            <>
              <span className="hidden text-sm text-zinc-600 dark:text-zinc-400 sm:block">
                {user.email}
              </span>
              <button
                type="button"
                onClick={handleSignOut}
                className="rounded-full border border-zinc-200/80 bg-white/60 px-3 py-1.5 text-sm font-medium text-zinc-900 shadow-sm ring-1 ring-black/5 hover:bg-white/90 dark:border-zinc-800/80 dark:bg-black/40 dark:text-zinc-50 dark:ring-white/10 dark:hover:bg-black/60"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/sign-in"
                className="rounded-full border border-zinc-200/80 bg-white/60 px-3 py-1.5 text-sm font-medium text-zinc-900 shadow-sm ring-1 ring-black/5 hover:bg-white/90 dark:border-zinc-800/80 dark:bg-black/40 dark:text-zinc-50 dark:ring-white/10 dark:hover:bg-black/60"
              >
                Sign in
              </Link>
              <Link
                href="/sign-up"
                className="rounded-full bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white shadow-sm ring-1 ring-black/10 hover:bg-zinc-800 dark:bg-white dark:text-black dark:ring-white/20 dark:hover:bg-zinc-100"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
