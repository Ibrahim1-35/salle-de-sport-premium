"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Dumbbell, Activity, Users, LogOut, ArrowRight } from "lucide-react";

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();

  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      setUser(user);

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      setProfile(profileData);
      setLoading(false);
    }

    loadData();
  }, [router, supabase]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (loading) {
    return (
      <main className="premium-shell min-h-screen px-6 py-10 text-white">
        <div className="premium-container mx-auto max-w-7xl">
          <p className="text-zinc-400">Chargement...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="premium-shell min-h-screen px-6 py-10 text-white">
      <div className="premium-container mx-auto max-w-7xl space-y-8">
        <div className="premium-card rounded-[28px] p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="mb-3 inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">
                Gym Premium
              </p>

              <h1 className="premium-title text-4xl font-semibold md:text-5xl">
                Salut {profile?.username || "athlète"}
              </h1>

              <p className="premium-subtitle mt-3 max-w-2xl text-base md:text-lg">
                Suis tes entraînements, construis tes routines et développe ton espace fitness premium.
              </p>

              <p className="mt-4 text-sm text-zinc-500">{user?.email}</p>
            </div>

            <button
              onClick={handleLogout}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 text-sm text-white transition hover:bg-white/10"
            >
              <LogOut className="h-4 w-4" />
              Déconnexion
            </button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Link href="/routines" className="premium-card group rounded-[28px] p-6 transition hover:-translate-y-1">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
              <Dumbbell className="h-5 w-5" />
            </div>

            <h2 className="text-xl font-medium">Mes routines</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Crée, organise et prépare tes entraînements.
            </p>

            <div className="mt-6 flex items-center gap-2 text-sm text-white/80">
              Ouvrir
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </div>
          </Link>

          <div className="premium-card rounded-[28px] p-6">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
              <Activity className="h-5 w-5" />
            </div>

            <h2 className="text-xl font-medium">Mes séances</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Historique et suivi de progression.
            </p>

            <p className="mt-6 text-4xl font-semibold tracking-tight">0</p>
          </div>

          <div className="premium-card rounded-[28px] p-6">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
              <Users className="h-5 w-5" />
            </div>

            <h2 className="text-xl font-medium">Mes amis</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Ajoute des amis plus tard et partage ton activité.
            </p>

            <p className="mt-6 text-4xl font-semibold tracking-tight">0</p>
          </div>
        </div>
      </div>
    </main>
  );
}