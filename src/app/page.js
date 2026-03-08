"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function HomePage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    async function loadData() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setUser(user || null);

      if (user) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();

        setProfile(profileData || null);
      }

      setLoading(false);
    }

    loadData();
  }, [supabase]);

  const title = loading
    ? "Chargement..."
    : user
    ? `Système ${profile?.username || "Utilisateur"}`
    : "Système Premium";

  const subtitle = user
    ? "Accède à ton système, tes séances, ta progression et ton profil."
    : "Priorisation musculaire, séries, séances, progression et social.";

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10 text-white">
      <div className="w-full max-w-3xl rounded-[34px] border border-white/10 bg-white/[0.04] p-8 text-center shadow-[0_10px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl md:p-12">
        <p className="text-sm text-zinc-500">Gym Premium</p>

        <h1 className="mt-4 text-5xl font-semibold tracking-[-0.05em] md:text-6xl">
          {title}
        </h1>

        <p className="mx-auto mt-4 max-w-2xl text-base text-zinc-400 md:text-lg">
          {subtitle}
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {user ? (
            <>
              <Link
                href="/system"
                className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm hover:bg-white/15"
              >
                Ouvrir le système
              </Link>

              <Link
                href="/settings"
                className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm text-zinc-300 hover:bg-white/10"
              >
                Paramètres
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm hover:bg-white/15"
              >
                Connexion
              </Link>

              <Link
                href="/signup"
                className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm text-zinc-300 hover:bg-white/10"
              >
                Inscription
              </Link>
            </>
          )}
        </div>
      </div>
    </main>
  );
}