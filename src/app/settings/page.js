"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [user, setUser] = useState(null);
  const [form, setForm] = useState({
    username: "",
    full_name: "",
    bio: "",
    avatar_url: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      setUser(user || null);

      if (!user) {
        setLoading(false);
        return;
      }

      const { data: existingProfile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        setError(profileError.message);
        setLoading(false);
        return;
      }

      let profile = existingProfile;

      if (!profile) {
        const emailPrefix = user.email?.split("@")[0] || "utilisateur";

        const { data: createdProfile, error: createError } = await supabase
          .from("profiles")
          .insert({
            id: user.id,
            username: `${emailPrefix}_${user.id.slice(0, 6)}`,
            full_name: null,
            avatar_url: null,
            bio: null,
          })
          .select("*")
          .single();

        if (createError) {
          setError(createError.message);
          setLoading(false);
          return;
        }

        profile = createdProfile;
      }

      setForm({
        username: profile?.username || "",
        full_name: profile?.full_name || "",
        bio: profile?.bio || "",
        avatar_url: profile?.avatar_url || "",
      });

      setLoading(false);
    }

    loadData();
  }, [supabase]);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    if (!user) {
      setError("Tu dois être connecté.");
      setSaving(false);
      return;
    }

    if (!form.username.trim()) {
      setError("Le pseudo est obligatoire.");
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        username: form.username.trim(),
        full_name: form.full_name.trim() || null,
        bio: form.bio.trim() || null,
        avatar_url: form.avatar_url.trim() || null,
      })
      .eq("id", user.id);

    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    setSuccess("Profil mis à jour.");
  }

  async function handleLogout() {
    setLoggingOut(true);
    setError("");
    setSuccess("");

    const { error } = await supabase.auth.signOut();

    setLoggingOut(false);

    if (error) {
      setError(error.message);
      return;
    }

    router.push("/login");
    router.refresh();
  }

  if (loading) {
    return (
      <main className="min-h-screen px-6 py-10 text-white">
        <div className="mx-auto max-w-4xl">
          <p className="text-zinc-400">Chargement...</p>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen px-6 py-10 text-white">
        <div className="mx-auto max-w-4xl space-y-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm text-zinc-400">Paramètres</p>
              <h1 className="text-5xl font-semibold tracking-[-0.04em]">
                Mon profil
              </h1>
            </div>

            <div className="flex gap-3">
              <Link
                href="/"
                className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm hover:bg-white/15"
              >
                Accueil
              </Link>
              <Link
                href="/login"
                className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm hover:bg-white/15"
              >
                Connexion
              </Link>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-8">
            <h2 className="text-2xl font-medium">Connexion requise</h2>
            <p className="mt-3 text-zinc-400">
              Tu dois être connecté pour modifier ton profil.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/login"
                className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm hover:bg-white/15"
              >
                Se connecter
              </Link>

              <Link
                href="/signup"
                className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm text-zinc-300 hover:bg-white/10"
              >
                Créer un compte
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-6 py-10 text-white">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-zinc-400">Paramètres</p>
            <h1 className="text-5xl font-semibold tracking-[-0.04em]">
              Mon profil
            </h1>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/profile"
              className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm hover:bg-white/15"
            >
              Profil
            </Link>
            <Link
              href="/system"
              className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm hover:bg-white/15"
            >
              Système
            </Link>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm text-red-300 hover:bg-red-500/15 disabled:opacity-50"
            >
              {loggingOut ? "Déconnexion..." : "Se déconnecter"}
            </button>
          </div>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">
            {success}
          </div>
        ) : null}

        <form
          onSubmit={handleSave}
          className="space-y-5 rounded-[28px] border border-white/10 bg-white/[0.03] p-6"
        >
          <div className="space-y-2">
            <label className="text-sm text-zinc-300">Pseudo</label>
            <input
              value={form.username}
              onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
              className="h-11 w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 text-white outline-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-zinc-300">Nom complet</label>
            <input
              value={form.full_name}
              onChange={(e) => setForm((prev) => ({ ...prev, full_name: e.target.value }))}
              className="h-11 w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 text-white outline-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-zinc-300">Bio</label>
            <textarea
              value={form.bio}
              onChange={(e) => setForm((prev) => ({ ...prev, bio: e.target.value }))}
              rows={4}
              className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-white outline-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-zinc-300">URL avatar</label>
            <input
              value={form.avatar_url}
              onChange={(e) => setForm((prev) => ({ ...prev, avatar_url: e.target.value }))}
              className="h-11 w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 text-white outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm hover:bg-white/15 disabled:opacity-50"
          >
            {saving ? "Sauvegarde..." : "Sauvegarder"}
          </button>
        </form>
      </div>
    </main>
  );
}