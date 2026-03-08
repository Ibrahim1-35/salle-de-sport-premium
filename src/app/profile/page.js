"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function formatNumber(value) {
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatDate(dateString) {
  if (!dateString) return "-";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(dateString));
}

export default function ProfilePage() {
  const router = useRouter();
  const supabase = createClient();

  const [profile, setProfile] = useState(null);
  const [muscles, setMuscles] = useState([]);
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

      let safeProfile = existingProfile;

      if (!safeProfile) {
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

        safeProfile = createdProfile;
      }

      const [musclesRes, sessionsRes] = await Promise.all([
        supabase
          .from("user_muscle_settings")
          .select(`
            *,
            muscles(*)
          `)
          .eq("user_id", user.id),
        supabase
          .from("workout_sessions")
          .select(`
            *,
            training_days(*)
          `)
          .eq("user_id", user.id)
          .eq("status", "completed")
          .order("completed_at", { ascending: false }),
      ]);

      if (musclesRes.error) {
        setError(musclesRes.error.message);
        setLoading(false);
        return;
      }

      if (sessionsRes.error) {
        setError(sessionsRes.error.message);
        setLoading(false);
        return;
      }

      const sessionsData = sessionsRes.data || [];
      const sessionIds = sessionsData.map((item) => item.id);

      let sessionExercisesData = [];
      let workoutSetsData = [];

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

        const sessionExerciseIds = sessionExercisesData.map((item) => item.id);

        if (sessionExerciseIds.length > 0) {
          const workoutSetsRes = await supabase
            .from("workout_sets")
            .select("*")
            .in("workout_session_exercise_id", sessionExerciseIds);

          if (workoutSetsRes.error) {
            setError(workoutSetsRes.error.message);
            setLoading(false);
            return;
          }

          workoutSetsData = workoutSetsRes.data || [];
        }
      }

      setProfile(safeProfile);
      setMuscles(musclesRes.data || []);
      setSessions(sessionsData);
      setSessionExercises(sessionExercisesData);
      setWorkoutSets(workoutSetsData);
      setLoading(false);
    }

    loadData();
  }, [router, supabase]);

  const setsBySessionExerciseId = useMemo(() => {
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

  const stats = useMemo(() => {
    let totalVolume = 0;
    let totalCompletedSets = 0;
    let bestSetVolume = 0;
    let bestSessionVolume = 0;

    const enrichedSessions = sessions.map((session) => {
      const exercises = exercisesBySessionId.get(session.id) || [];
      let sessionVolume = 0;
      let sessionSets = 0;

      for (const exercise of exercises) {
        const sets = setsBySessionExerciseId.get(exercise.id) || [];

        for (const set of sets) {
          if (!set.is_completed) continue;

          const volume = (Number(set.weight) || 0) * (Number(set.reps) || 0);

          sessionVolume += volume;
          sessionSets += 1;
          totalVolume += volume;
          totalCompletedSets += 1;

          if (volume > bestSetVolume) {
            bestSetVolume = volume;
          }
        }
      }

      if (sessionVolume > bestSessionVolume) {
        bestSessionVolume = sessionVolume;
      }

      return {
        ...session,
        sessionVolume,
        sessionSets,
      };
    });

    return {
      totalVolume,
      totalCompletedSets,
      bestSetVolume,
      bestSessionVolume,
      totalSessions: sessions.length,
      lastSession: enrichedSessions[0] || null,
    };
  }, [sessions, exercisesBySessionId, setsBySessionExerciseId]);

  const priorityMuscles = useMemo(() => {
    return muscles
      .filter((item) => item.priority === "priority")
      .map((item) => ({
        id: item.id,
        name: item.muscles?.name || "-",
        targetSets: item.target_sets,
      }));
  }, [muscles]);

  const moderateMuscles = useMemo(() => {
    return muscles
      .filter((item) => item.priority === "moderate")
      .map((item) => ({
        id: item.id,
        name: item.muscles?.name || "-",
        targetSets: item.target_sets,
      }));
  }, [muscles]);

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-950 px-6 py-10 text-white">
        <div className="mx-auto max-w-7xl">
          <p className="text-zinc-400">Chargement...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_25%),linear-gradient(180deg,#09090b_0%,#0b0b10_100%)] px-6 py-10 text-white">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6 md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-5">
              <div className="flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-white/10 text-2xl font-semibold">
                {(profile?.username || "U").slice(0, 1).toUpperCase()}
              </div>

              <div>
                <p className="text-sm text-zinc-400">Profil</p>
                <h1 className="text-4xl font-semibold tracking-[-0.04em]">
                  {profile?.username || "Utilisateur"}
                </h1>
                <p className="mt-2 text-zinc-400">{profile?.full_name || profile?.bio || "Profil premium"}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href="/system" className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm hover:bg-white/15">Système</Link>
              <Link href="/history" className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm hover:bg-white/15">Historique</Link>
              <Link href="/progression" className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm hover:bg-white/15">Progression</Link>
            </div>
          </div>
        </header>

        {error ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-5">
            <p className="text-sm text-zinc-400">Séances terminées</p>
            <p className="mt-2 text-4xl font-semibold tracking-[-0.04em]">{stats.totalSessions}</p>
          </div>

          <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-5">
            <p className="text-sm text-zinc-400">Volume total</p>
            <p className="mt-2 text-4xl font-semibold tracking-[-0.04em]">{formatNumber(stats.totalVolume)}</p>
          </div>

          <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-5">
            <p className="text-sm text-zinc-400">Record séance</p>
            <p className="mt-2 text-4xl font-semibold tracking-[-0.04em]">{formatNumber(stats.bestSessionVolume)}</p>
          </div>

          <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-5">
            <p className="text-sm text-zinc-400">Record meilleure série</p>
            <p className="mt-2 text-4xl font-semibold tracking-[-0.04em]">{formatNumber(stats.bestSetVolume)}</p>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
            <h2 className="text-2xl font-medium">Focus musculaire</h2>
            <p className="mt-1 text-sm text-zinc-400">Tes priorités actuelles dans le système.</p>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-[20px] border border-rose-500/20 bg-rose-500/5 p-4">
                <p className="text-sm text-rose-300">Prioritaires</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {priorityMuscles.map((muscle) => (
                    <span
                      key={muscle.id}
                      className="rounded-full border border-rose-400/20 bg-rose-400/10 px-3 py-1 text-sm text-rose-200"
                    >
                      {muscle.name} · {muscle.targetSets}
                    </span>
                  ))}
                  {priorityMuscles.length === 0 ? <span className="text-sm text-zinc-500">Aucun muscle prioritaire</span> : null}
                </div>
              </div>

              <div className="rounded-[20px] border border-amber-500/20 bg-amber-500/5 p-4">
                <p className="text-sm text-amber-300">Modérés</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {moderateMuscles.map((muscle) => (
                    <span
                      key={muscle.id}
                      className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-sm text-amber-200"
                    >
                      {muscle.name} · {muscle.targetSets}
                    </span>
                  ))}
                  {moderateMuscles.length === 0 ? <span className="text-sm text-zinc-500">Aucun muscle modéré</span> : null}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
            <h2 className="text-2xl font-medium">Dernière activité</h2>
            <p className="mt-1 text-sm text-zinc-400">Dernière séance terminée.</p>

            <div className="mt-5 rounded-[20px] border border-white/10 bg-black/20 p-5">
              {stats.lastSession ? (
                <>
                  <p className="text-xl font-medium">{stats.lastSession.training_days?.name || "Séance"}</p>
                  <p className="mt-2 text-sm text-zinc-400">
                    {formatDate(stats.lastSession.completed_at || stats.lastSession.started_at)}
                  </p>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-zinc-900/40 p-4">
                      <p className="text-sm text-zinc-400">Volume séance</p>
                      <p className="mt-2 text-2xl font-semibold">{formatNumber(stats.lastSession.sessionVolume)}</p>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-zinc-900/40 p-4">
                      <p className="text-sm text-zinc-400">Séries validées</p>
                      <p className="mt-2 text-2xl font-semibold">{stats.lastSession.sessionSets}</p>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-zinc-500">Aucune séance terminée.</p>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}