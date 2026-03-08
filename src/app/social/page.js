"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function formatDate(dateString) {
  if (!dateString) return "-";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(dateString));
}

function formatNumber(value) {
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export default function SocialPage() {
  const router = useRouter();
  const supabase = createClient();

  const [user, setUser] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [friendships, setFriendships] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [sessionExercises, setSessionExercises] = useState([]);
  const [workoutSets, setWorkoutSets] = useState([]);
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
          .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
          .eq("status", "accepted"),
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

      const friendIds = (friendshipsRes.data || []).map((item) =>
        item.requester_id === user.id ? item.addressee_id : item.requester_id
      );

      let sessionsData = [];
      let sessionExercisesData = [];
      let workoutSetsData = [];

      if (friendIds.length > 0) {
        const sessionsRes = await supabase
          .from("workout_sessions")
          .select(`
            *,
            training_days(*)
          `)
          .in("user_id", friendIds)
          .eq("status", "completed")
          .order("completed_at", { ascending: false })
          .limit(30);

        if (sessionsRes.error) {
          setError(sessionsRes.error.message);
          setLoading(false);
          return;
        }

        sessionsData = sessionsRes.data || [];
        const sessionIds = sessionsData.map((item) => item.id);

        if (sessionIds.length > 0) {
          const sessionExercisesRes = await supabase
            .from("workout_session_exercises")
            .select(`
              *,
              exercise_templates(
                *,
                muscles(*)
              )
            `)
            .in("workout_session_id", sessionIds);

          if (sessionExercisesRes.error) {
            setError(sessionExercisesRes.error.message);
            setLoading(false);
            return;
          }

          sessionExercisesData = sessionExercisesRes.data || [];

          const exerciseIds = sessionExercisesData.map((item) => item.id);

          if (exerciseIds.length > 0) {
            const setsRes = await supabase
              .from("workout_sets")
              .select("*")
              .in("workout_session_exercise_id", exerciseIds);

            if (setsRes.error) {
              setError(setsRes.error.message);
              setLoading(false);
              return;
            }

            workoutSetsData = setsRes.data || [];
          }
        }
      }

      setProfiles(profilesRes.data || []);
      setFriendships(friendshipsRes.data || []);
      setSessions(sessionsData);
      setSessionExercises(sessionExercisesData);
      setWorkoutSets(workoutSetsData);
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

  const setsByExerciseId = useMemo(() => {
    const map = new Map();
    for (const set of workoutSets) {
      if (!map.has(set.workout_session_exercise_id)) {
        map.set(set.workout_session_exercise_id, []);
      }
      map.get(set.workout_session_exercise_id).push(set);
    }
    return map;
  }, [workoutSets]);

  const exercisesBySessionId = useMemo(() => {
    const map = new Map();
    for (const exercise of sessionExercises) {
      if (!map.has(exercise.workout_session_id)) {
        map.set(exercise.workout_session_id, []);
      }
      map.get(exercise.workout_session_id).push(exercise);
    }
    return map;
  }, [sessionExercises]);

  const feed = useMemo(() => {
    return sessions.map((session) => {
      const exercises = exercisesBySessionId.get(session.id) || [];
      let volume = 0;
      let completedSets = 0;

      for (const exercise of exercises) {
        const sets = setsByExerciseId.get(exercise.id) || [];
        for (const set of sets) {
          if (!set.is_completed) continue;
          completedSets += 1;
          volume += (Number(set.weight) || 0) * (Number(set.reps) || 0);
        }
      }

      return {
        ...session,
        friend: profilesMap.get(session.user_id),
        completedSets,
        volume,
        exerciseCount: exercises.length,
      };
    });
  }, [sessions, exercisesBySessionId, setsByExerciseId, profilesMap]);

  const acceptedCount = useMemo(() => friendships.length, [friendships]);

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
              Activité des amis
            </h1>
            <p className="mt-3 text-zinc-400">
              Séances récentes de tes amis.
            </p>
          </div>

          <div className="flex gap-3">
            <Link
              href="/friends"
              className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm hover:bg-white/15"
            >
              Amis
            </Link>
            <Link
              href="/friends/requests"
              className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm hover:bg-white/15"
            >
              Demandes
            </Link>
            <Link
              href="/system"
              className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm hover:bg-white/15"
            >
              Système
            </Link>
          </div>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-5">
            <p className="text-sm text-zinc-400">Amis</p>
            <p className="mt-2 text-4xl font-semibold tracking-[-0.04em]">
              {acceptedCount}
            </p>
          </div>

          <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-5">
            <p className="text-sm text-zinc-400">Séances visibles</p>
            <p className="mt-2 text-4xl font-semibold tracking-[-0.04em]">
              {feed.length}
            </p>
          </div>

          <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-5">
            <p className="text-sm text-zinc-400">Utilisateurs actifs</p>
            <p className="mt-2 text-4xl font-semibold tracking-[-0.04em]">
              {new Set(feed.map((item) => item.user_id)).size}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {feed.map((item) => (
            <div
              key={item.id}
              className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-zinc-400">
                    {item.friend?.username || "Ami"}
                  </p>
                  <h2 className="mt-1 text-2xl font-medium">
                    {item.training_days?.name || "Séance"}
                  </h2>
                  <p className="mt-2 text-sm text-zinc-500">
                    {formatDate(item.completed_at || item.started_at)}
                  </p>
                </div>

                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                    <p className="text-xs text-zinc-500">Volume</p>
                    <p className="mt-1 font-medium">{formatNumber(item.volume)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                    <p className="text-xs text-zinc-500">Séries</p>
                    <p className="mt-1 font-medium">{item.completedSets}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                    <p className="text-xs text-zinc-500">Exercices</p>
                    <p className="mt-1 font-medium">{item.exerciseCount}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {feed.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-white/10 p-5 text-sm text-zinc-500">
              Aucune activité d’amis pour le moment.
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}