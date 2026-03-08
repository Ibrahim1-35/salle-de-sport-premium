"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    router.push("/system");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10 text-white">
      <div className="w-full max-w-md rounded-[32px] border border-white/10 bg-white/[0.04] p-8 shadow-[0_10px_60px_rgba(0,0,0,0.35)]">
        <p className="text-sm text-zinc-400">Connexion</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em]">
          Bon retour
        </h1>
        <p className="mt-3 text-zinc-400">
          Connecte-toi pour accéder à ton système.
        </p>

        {error ? (
          <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        ) : null}

        <form onSubmit={handleLogin} className="mt-6 space-y-4">
          <div className="space-y-2">
            <label className="text-sm text-zinc-300">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 text-white outline-none"
              placeholder="ton@email.com"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-zinc-300">Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 text-white outline-none"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm hover:bg-white/15 disabled:opacity-50"
          >
            {loading ? "Connexion..." : "Se connecter"}
          </button>
        </form>

        <div className="mt-6 flex items-center justify-between text-sm">
          <Link href="/signup" className="text-zinc-400 hover:text-white">
            Créer un compte
          </Link>
          <Link href="/" className="text-zinc-400 hover:text-white">
            Retour accueil
          </Link>
        </div>
      </div>
    </main>
  );
}