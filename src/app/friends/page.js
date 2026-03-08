"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function FriendsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [user, setUser] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [friendships, setFriendships] = useState([]);
  const [search, setSearch] = useState("");
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
        supabase.from("profiles").select("*").neq("id", user.id).order("username", { ascending: true }),
        supabase
          .from("friendships")
          .select("*")
          .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`),
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

  const friendshipMap = useMemo(() => {
    const map = new Map();

    for (const item of friendships) {
      const otherId =
        item.requester_id === user?.id ? item.addressee_id : item.requester_id;
      map.set(otherId, item);
    }

    return map;
  }, [friendships, user]);

  const filteredProfiles = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return profiles;

    return profiles.filter((profile) => {
      return (
        profile.username?.toLowerCase().includes(q) ||
        profile.full_name?.toLowerCase().includes(q)
      );
    });
  }, [profiles, search]);

  async function sendRequest(targetUserId) {
    setError("");

    const { error } = await supabase.from("friendships").insert({
      requester_id: user.id,
      addressee_id: targetUserId,
      status: "pending",
    });

    if (error) {
      setError(error.message);
      return;
    }

    setFriendships((prev) => [
      ...prev,
      {
        requester_id: user.id,
        addressee_id: targetUserId,
        status: "pending",
      },
    ]);
  }

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

    setFriendships((prev) =>
      prev.map((item) =>
        item.id === friendshipId
          ? { ...item, status, responded_at: new Date().toISOString() }
          : item
      )
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-950 px-6 py-10 text-white">
        <div className="mx-auto max-w-6xl">
          <p className="text-zinc-400">Chargement...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-zinc-400">Social</p>
            <h1 className="text-5xl font-semibold tracking-[-0.04em]">
              Amis
            </h1>
          </div>

          <div className="flex gap-3">
            <Link
              href="/system"
              className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm hover:bg-white/15"
            >
              Système
            </Link>
            <Link
              href="/profile"
              className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm hover:bg-white/15"
            >
              Profil
            </Link>
          </div>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        ) : null}

        <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un utilisateur"
            className="h-11 w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 text-white outline-none"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {filteredProfiles.map((profile) => {
            const friendship = friendshipMap.get(profile.id);

            return (
              <div
                key={profile.id}
                className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-medium">{profile.username}</h2>
                    <p className="mt-1 text-sm text-zinc-400">
                      {profile.full_name || "Pas de nom"}
                    </p>
                    <p className="mt-3 text-sm text-zinc-500">
                      {profile.bio || "Aucune bio"}
                    </p>
                  </div>

                  {!friendship ? (
                    <button
                      onClick={() => sendRequest(profile.id)}
                      className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm hover:bg-white/15"
                    >
                      Ajouter
                    </button>
                  ) : friendship.status === "accepted" ? (
                    <span className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
                      Ami
                    </span>
                  ) : friendship.status === "pending" && friendship.addressee_id === user.id ? (
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
                  ) : friendship.status === "pending" ? (
                    <span className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
                      En attente
                    </span>
                  ) : (
                    <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-400">
                      Refusé
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {filteredProfiles.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-white/10 p-5 text-sm text-zinc-500">
              Aucun utilisateur trouvé.
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}