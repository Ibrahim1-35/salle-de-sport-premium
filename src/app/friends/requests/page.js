"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function FriendRequestsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [user, setUser] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [friendships, setFriendships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      setUser(user);

      const [profilesRes, friendshipsRes] = await Promise.all([
        supabase.from("profiles").select("*"),
        supabase
          .from("friendships")
          .select("*")
          .eq("addressee_id", user.id)
          .eq("status", "pending")
          .order("created_at", { ascending: false }),
      ]);

      if (profilesRes.error) {
        setError(profilesRes.error.message);
        setLoading(false);
        return;
      }

      if (friendshipsRes.error) {
        setError(friendshipsRes.error.message);
        setLoading(false);
        return;
      }

      setProfiles(profilesRes.data || []);
      setFriendships(friendshipsRes.data || []);
      setLoading(false);
    }

    loadData();
  }, [router, supabase]);

  const profilesMap = useMemo(() => {
    const map = new Map();
    for (const profile of profiles) {
      map.set(profile.id, profile);
    }
    return map;
  }, [profiles]);

  async function respondRequest(friendshipId, status) {
    setError("");

    const { error } = await supabase
      .from("friendships")
      .update({
        status,
        responded_at: new Date().toISOString(),
      })
      .eq("id", friendshipId);

    if (error) {
      setError(error.message);
      return;
    }

    setFriendships((prev) => prev.filter((item) => item.id !== friendshipId));
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-950 px-6 py-10 text-white">
        <div className="mx-auto max-w-5xl">
          <p className="text-zinc-400">Chargement...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-zinc-400">Social</p>
            <h1 className="text-5xl font-semibold tracking-[-0.04em]">
              Demandes d’amis
            </h1>
          </div>

          <div className="flex gap-3">
            <Link
              href="/friends"
              className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm hover:bg-white/15"
            >
              Amis
            </Link>
            <Link
              href="/social"
              className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm hover:bg-white/15"
            >
              Social
            </Link>
          </div>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        ) : null}

        <div className="space-y-4">
          {friendships.map((friendship) => {
            const profile = profilesMap.get(friendship.requester_id);

            return (
              <div
                key={friendship.id}
                className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-medium">
                      {profile?.username || "Utilisateur"}
                    </h2>
                    <p className="mt-1 text-sm text-zinc-400">
                      {profile?.full_name || "Pas de nom"}
                    </p>
                    <p className="mt-2 text-sm text-zinc-500">
                      {profile?.bio || "Aucune bio"}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => respondRequest(friendship.id, "accepted")}
                      className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300"
                    >
                      Accepter
                    </button>
                    <button
                      onClick={() => respondRequest(friendship.id, "declined")}
                      className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300"
                    >
                      Refuser
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {friendships.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-white/10 p-5 text-sm text-zinc-500">
              Aucune demande en attente.
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}