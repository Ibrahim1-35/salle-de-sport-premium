"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function formatDurationFromMs(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatNumber(value) {
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export default function WorkoutPage({ params }) {
  const { dayId } = use(params);
  const router = useRouter();
  const supabase = createClient();

  const [user, setUser] = useState(null);
  const [trainingDay, setTrainingDay] = useState(null);
  const [session, setSession] = useState(null);
  const [sessionExercises, setSessionExercises] = useState([]);
  const [setsByExercise, setSetsByExercise] = useState({});
  const [bestSetVolumeByTemplate, setBestSetVolumeByTemplate] = useState({});
  const [lastPerformanceByTemplate, setLastPerformanceByTemplate] = useState({});
  const [loading, setLoading] = useState(true);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState("");
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    if (!session?.started_at) return;

    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, [session]);

  useEffect(() => {
    async function initWorkout() {
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

      const { data: dayData, error: dayError } = await supabase
        .from("training_days")
        .select("*")
        .eq("id", dayId)
        .single();

      if (dayError || !dayData) {
        setError("Séance introuvable.");
        setLoading(false);
        return;
      }

      setTrainingDay(dayData);

      const { data: existingSession } = await supabase
        .from("workout_sessions")
        .select("*")
        .eq("user_id", user.id)
        .eq("training_day_id", dayId)
        .eq("status", "active")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let activeSession = existingSession;

      if (!activeSession) {
        const { data: createdSession, error: createSessionError } = await supabase
          .from("workout_sessions")
          .insert({
            user_id: user.id,
            training_day_id: dayId,
            status: "active",
          })
          .select("*")
          .single();

        if (createSessionError) {
          setError(createSessionError.message);
          setLoading(false);
          return;
        }

        activeSession = createdSession;

        const { data: dayExercises, error: dayExercisesError } = await supabase
          .from("program_exercises")
          .select(`
            *,
            exercise_templates(
              *,
              muscles(*)
            )
          `)
          .eq("user_id", user.id)
          .eq("training_day_id", dayId)
          .order("order_index", { ascending: true });

        if (dayExercisesError) {
          setError(dayExercisesError.message);
          setLoading(false);
          return;
        }

        const sessionExercisePayload = (dayExercises || []).map((item) => ({
          workout_session_id: activeSession.id,
          exercise_template_id: item.exercise_template_id,
          order_index: item.order_index,
          planned_sets: item.set_count || 3,
        }));

        let createdSessionExercises = [];

        if (sessionExercisePayload.length > 0) {
          const { data, error: createSessionExercisesError } = await supabase
            .from("workout_session_exercises")
            .insert(sessionExercisePayload)
            .select(`
              *,
              exercise_templates(
                *,
                muscles(*)
              )
            `);

          if (createSessionExercisesError) {
            setError(createSessionExercisesError.message);
            setLoading(false);
            return;
          }

          createdSessionExercises = data || [];

          const setsPayload = [];

          for (const ex of createdSessionExercises) {
            for (let i = 1; i <= ex.planned_sets; i += 1) {
              setsPayload.push({
                workout_session_exercise_id: ex.id,
                set_number: i,
                reps: null,
                weight: null,
                rir: null,
                is_completed: false,
              });
            }
          }

          if (setsPayload.length > 0) {
            const { error: createSetsError } = await supabase
              .from("workout_sets")
              .insert(setsPayload);

            if (createSetsError) {
              setError(createSetsError.message);
              setLoading(false);
              return;
            }
          }
        }
      }

      setSession(activeSession);

      const { data: loadedSessionExercises, error: loadSessionExercisesError } = await supabase
        .from("workout_session_exercises")
        .select(`
          *,
          exercise_templates(
            *,
            muscles(*)
          )
        `)
        .eq("workout_session_id", activeSession.id)
        .order("order_index", { ascending: true });

      if (loadSessionExercisesError) {
        setError(loadSessionExercisesError.message);
        setLoading(false);
        return;
      }

      setSessionExercises(loadedSessionExercises || []);

      const exerciseIds = (loadedSessionExercises || []).map((item) => item.id);

      if (exerciseIds.length > 0) {
        const { data: loadedSets, error: loadSetsError } = await supabase
          .from("workout_sets")
          .select("*")
          .in("workout_session_exercise_id", exerciseIds)
          .order("set_number", { ascending: true });

        if (loadSetsError) {
          setError(loadSetsError.message);
          setLoading(false);
          return;
        }

        const grouped = {};
        for (const set of loadedSets || []) {
          if (!grouped[set.workout_session_exercise_id]) {
            grouped[set.workout_session_exercise_id] = [];
          }
          grouped[set.workout_session_exercise_id].push(set);
        }

        setSetsByExercise(grouped);
      } else {
        setSetsByExercise({});
      }

      const templateIds = [...new Set((loadedSessionExercises || []).map((item) => item.exercise_template_id))];

      if (templateIds.length > 0) {
        const { data: historicalExercises } = await supabase
          .from("workout_session_exercises")
          .select(`
            *,
            workout_sessions!inner(
              id,
              user_id,
              status,
              completed_at,
              started_at
            )
          `)
          .in("exercise_template_id", templateIds)
          .eq("workout_sessions.user_id", user.id)
          .eq("workout_sessions.status", "completed");

        const historicalExerciseIds = (historicalExercises || []).map((item) => item.id);

        let historicalSets = [];
        if (historicalExerciseIds.length > 0) {
          const { data } = await supabase
            .from("workout_sets")
            .select("*")
            .in("workout_session_exercise_id", historicalExerciseIds);

          historicalSets = data || [];
        }

        const setsByHistoricalExercise = {};
        for (const set of historicalSets) {
          if (!setsByHistoricalExercise[set.workout_session_exercise_id]) {
            setsByHistoricalExercise[set.workout_session_exercise_id] = [];
          }
          setsByHistoricalExercise[set.workout_session_exercise_id].push(set);
        }

        const bestVolumeMap = {};
        const lastPerfMap = {};

        for (const ex of historicalExercises || []) {
          const sets = setsByHistoricalExercise[ex.id] || [];
          const templateId = ex.exercise_template_id;
          const sessionDate = ex.workout_sessions?.completed_at || ex.workout_sessions?.started_at;

          for (const set of sets) {
            if (!set.is_completed) continue;

            const volume = (Number(set.weight) || 0) * (Number(set.reps) || 0);

            if (!bestVolumeMap[templateId] || volume > bestVolumeMap[templateId]) {
              bestVolumeMap[templateId] = volume;
            }

            const currentLast = lastPerfMap[templateId];
            if (!currentLast || new Date(sessionDate).getTime() > new Date(currentLast.date).getTime()) {
              lastPerfMap[templateId] = {
                date: sessionDate,
                reps: set.reps,
                weight: set.weight,
                rir: set.rir,
                volume,
              };
            }
          }
        }

        setBestSetVolumeByTemplate(bestVolumeMap);
        setLastPerformanceByTemplate(lastPerfMap);
      } else {
        setBestSetVolumeByTemplate({});
        setLastPerformanceByTemplate({});
      }

      setLoading(false);
    }

    initWorkout();
  }, [dayId, router, supabase]);

  const sessionStats = useMemo(() => {
    const allSets = Object.values(setsByExercise).flat();
    const completed = allSets.filter((set) => set.is_completed).length;
    const volume = allSets.reduce((sum, set) => {
      if (!set.is_completed) return sum;
      return sum + (Number(set.weight) || 0) * (Number(set.reps) || 0);
    }, 0);

    return {
      total: allSets.length,
      completed,
      volume,
    };
  }, [setsByExercise]);

  const elapsed = useMemo(() => {
    if (!session?.started_at) return "00:00";
    return formatDurationFromMs(nowMs - new Date(session.started_at).getTime());
  }, [session, nowMs]);

  async function updateSetField(setId, field, value) {
    setError("");

    let formattedValue = value;

    if (field === "reps" || field === "rir") {
      formattedValue = value === "" ? null : Number(value);
      if (formattedValue !== null && !Number.isFinite(formattedValue)) return;
    }

    if (field === "weight") {
      formattedValue = value === "" ? null : Number(value);
      if (formattedValue !== null && !Number.isFinite(formattedValue)) return;
    }

    const { error } = await supabase
      .from("workout_sets")
      .update({ [field]: formattedValue })
      .eq("id", setId);

    if (error) {
      setError(error.message);
      return;
    }

    setSetsByExercise((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        next[key] = next[key].map((set) =>
          set.id === setId ? { ...set, [field]: formattedValue } : set
        );
      }
      return next;
    });
  }

  async function toggleSetCompleted(setId, nextValue) {
    setError("");

    const { error } = await supabase
      .from("workout_sets")
      .update({ is_completed: nextValue })
      .eq("id", setId);

    if (error) {
      setError(error.message);
      return;
    }

    setSetsByExercise((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        next[key] = next[key].map((set) =>
          set.id === setId ? { ...set, is_completed: nextValue } : set
        );
      }
      return next;
    });
  }

  async function finishWorkout() {
    if (!session) return;

    setFinishing(true);
    setError("");

    const { error } = await supabase
      .from("workout_sessions")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", session.id);

    setFinishing(false);

    if (error) {
      setError(error.message);
      return;
    }

    router.push("/history");
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
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_25%),linear-gradient(180deg,#09090b_0%,#0b0b10_100%)] px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-zinc-400">Séance live</p>
            <h1 className="text-4xl font-semibold tracking-[-0.04em]">
              {trainingDay?.name || "Séance"}
            </h1>
            <p className="mt-2 text-zinc-400">
              {sessionStats.completed}/{sessionStats.total} séries validées
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/system"
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
            >
              Retour système
            </Link>

            <button
              onClick={finishWorkout}
              disabled={finishing}
              className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm hover:bg-white/15 disabled:opacity-50"
            >
              {finishing ? "Fin..." : "Terminer la séance"}
            </button>
          </div>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-5">
            <p className="text-sm text-zinc-400">Chronomètre</p>
            <p className="mt-2 text-4xl font-semibold tracking-[-0.04em]">{elapsed}</p>
          </div>

          <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-5">
            <p className="text-sm text-zinc-400">Séries validées</p>
            <p className="mt-2 text-4xl font-semibold tracking-[-0.04em]">
              {sessionStats.completed}/{sessionStats.total}
            </p>
          </div>

          <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-5">
            <p className="text-sm text-zinc-400">Volume séance</p>
            <p className="mt-2 text-4xl font-semibold tracking-[-0.04em]">
              {formatNumber(sessionStats.volume)}
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {sessionExercises.map((exercise) => {
            const sets = setsByExercise[exercise.id] || [];
            const completedCount = sets.filter((set) => set.is_completed).length;
            const templateId = exercise.exercise_template_id;
            const bestSetVolume = bestSetVolumeByTemplate[templateId] || 0;
            const lastPerf = lastPerformanceByTemplate[templateId] || null;

            return (
              <section
                key={exercise.id}
                className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5"
              >
                <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-medium">
                      {exercise.exercise_templates?.name}
                    </h2>
                    <p className="mt-1 text-sm text-zinc-400">
                      {exercise.exercise_templates?.muscles?.name} • {completedCount}/{sets.length} séries validées
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                      <p className="text-xs text-zinc-500">Record meilleure série</p>
                      <p className="mt-1 text-lg font-medium">
                        {formatNumber(bestSetVolume)}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                      <p className="text-xs text-zinc-500">Dernière perf</p>
                      <p className="mt-1 text-sm text-zinc-300">
                        {lastPerf
                          ? `${lastPerf.weight ?? "-"} kg • ${lastPerf.reps ?? "-"} reps • RIR ${lastPerf.rir ?? "-"}`
                          : "Aucune"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  {sets.map((set) => (
                    <div
                      key={set.id}
                      className={`grid grid-cols-[80px_1fr_1fr_1fr_120px] items-center gap-3 rounded-2xl border p-3 ${
                        set.is_completed
                          ? "border-emerald-500/20 bg-emerald-500/5"
                          : "border-white/10 bg-black/20"
                      }`}
                    >
                      <div className="text-sm font-medium text-zinc-300">
                        Série {set.set_number}
                      </div>

                      <input
                        type="number"
                        min="0"
                        value={set.weight ?? ""}
                        onChange={(e) => updateSetField(set.id, "weight", e.target.value)}
                        placeholder="Poids"
                        className="h-10 rounded-xl border border-white/10 bg-zinc-900 px-3 text-sm text-white outline-none"
                      />

                      <input
                        type="number"
                        min="0"
                        value={set.reps ?? ""}
                        onChange={(e) => updateSetField(set.id, "reps", e.target.value)}
                        placeholder="Reps"
                        className="h-10 rounded-xl border border-white/10 bg-zinc-900 px-3 text-sm text-white outline-none"
                      />

                      <input
                        type="number"
                        min="0"
                        value={set.rir ?? ""}
                        onChange={(e) => updateSetField(set.id, "rir", e.target.value)}
                        placeholder="RIR"
                        className="h-10 rounded-xl border border-white/10 bg-zinc-900 px-3 text-sm text-white outline-none"
                      />

                      <button
                        onClick={() => toggleSetCompleted(set.id, !set.is_completed)}
                        className={`rounded-xl border px-3 py-2 text-sm ${
                          set.is_completed
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                            : "border-white/10 bg-white/10 text-white"
                        }`}
                      >
                        {set.is_completed ? "Validée" : "Valider"}
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}

          {sessionExercises.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-white/10 p-6 text-zinc-500">
              Aucun exercice dans cette séance.
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}