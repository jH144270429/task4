"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useAuth } from "@/components/auth-provider";

export default function SignUpPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-up");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [loading, user, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);

    const supabase = getSupabaseBrowserClient();

    if (mode === "sign-up") {
      const result = await supabase.auth.signUp({
        email,
        password,
      });
      if (result.error) {
        setError(result.error.message);
        setSubmitting(false);
        return;
      }
      setMessage("Account created. Check your email to confirm, then sign in.");
      setMode("sign-in");
      setSubmitting(false);
      return;
    }

    const result = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (result.error) {
      setError(result.error.message);
      setSubmitting(false);
      return;
    }

    router.replace("/dashboard");
    router.refresh();
    setSubmitting(false);
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-10">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
        {mode === "sign-in" ? "Sign in" : "Create account"}
      </h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Use Supabase Auth with email and password.
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-6 rounded-2xl border border-white/60 bg-white/70 p-6 shadow-sm ring-1 ring-black/5 backdrop-blur-xl dark:border-zinc-800/70 dark:bg-black/40 dark:ring-white/10"
      >
        <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-50">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-2 w-full rounded-xl border border-zinc-200/80 bg-white/70 px-3 py-2 text-sm text-zinc-900 shadow-sm ring-1 ring-black/5 backdrop-blur dark:border-zinc-800/80 dark:bg-black/30 dark:text-zinc-50 dark:ring-white/10"
          />
        </label>

        <label className="mt-4 block text-sm font-medium text-zinc-900 dark:text-zinc-50">
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="mt-2 w-full rounded-xl border border-zinc-200/80 bg-white/70 px-3 py-2 text-sm text-zinc-900 shadow-sm ring-1 ring-black/5 backdrop-blur dark:border-zinc-800/80 dark:bg-black/30 dark:text-zinc-50 dark:ring-white/10"
          />
        </label>

        <button
          type="submit"
          disabled={submitting}
          className="mt-6 w-full rounded-xl bg-zinc-900 px-3 py-2 text-sm font-medium text-white shadow-sm ring-1 ring-black/10 hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:ring-white/20 dark:hover:bg-zinc-100"
        >
          {submitting
            ? "Submitting…"
            : mode === "sign-in"
              ? "Sign in"
              : "Sign up"}
        </button>

        <div className="mt-4 flex items-center justify-between text-sm">
          <button
            type="button"
            onClick={() => {
              setError(null);
              setMessage(null);
              setMode(mode === "sign-in" ? "sign-up" : "sign-in");
            }}
            className="rounded-full px-2 py-1 font-medium text-zinc-600 hover:bg-black/[0.04] hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/[0.06] dark:hover:text-zinc-50"
          >
            {mode === "sign-in"
              ? "Need an account? Sign up"
              : "Already have an account? Sign in"}
          </button>
        </div>

        {error ? (
          <p className="mt-4 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
            {message}
          </p>
        ) : null}
      </form>
    </main>
  );
}

