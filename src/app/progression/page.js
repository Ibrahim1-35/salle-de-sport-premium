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
  }).format(new Date(dateString));
}

function MiniChart({ data }) {
  const width = 420;
  const height = 140;
  const padding = 16;

  if (!data.length) {
    return (
      <div className="flex h-[140px] items-center justify-center rounded-2xl border border-dashed border-white/10 text-sm text-zinc-500">
        Pas assez de données
      </div>
    );
  }

  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;

  const points = data.map((item, index) => {
    const x =
      data.length === 1
        ? width / 2
        : padding + (index / (data.length - 1)) * innerWidth;
    const y = padding + innerHeight - (item.value / maxValue) * innerHeight;

    return { ...item, x, y };
  });

  const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[140px] w-full min-w-[420px]">
        <polyline
          fill="none"
          stroke="rgba(255,255,255,0.95)"
          strokeWidth="3"
          points={polyline}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {points.map((point, index) => (
          <circle key={index} cx={point.x} cy={point.y} r="3.5" fill="white" />
        ))}
      </svg>
    </div>
  );
}

export default function ProgressionPage() {
  const router = useRouter();
  const supabase = createClient();

  const [sessions, setSessions] = useState([]);
  const [sessionExercises, setSessionExercises] = useState([]);
  const [workoutSets, setWorkoutSets] = useState([]);
  const [selectedExerciseId, setSelectedExerciseId] = useState(null);
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

      const { data: sessionsData, error: sessionsError } = await supabase
        .from("workout_sessions")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .order("completed_at", { ascending: false });

      if (sessionsError) {
        setError(sessionsError.message);
        setLoading(false);
        return;
      }

      const sessionIds = (sessionsData || []).map((item) => item.id);

      let sessionExercisesData = [];
      let workoutSetsData = [];

      if (sessionIds.length > 0) {
        const { data, error: exercisesError } = await supabase
          .from("workout_session_exercises")
          .select(`
            *,
            exercise_templates(
              *,
              muscles(*)
            )
          `)
          .in("workout_session_id", sessionIds);

        if (exercisesError) {
          setError(exercisesError.message);
          setLoading(false);
          return;
        }

        sessionExercisesData = data || [];

        const exerciseIds = sessionExercisesData.map((item) => item.id);

        if (exerciseIds.length > 0) {
          const { data: setsData, error: setsError } = await supabase
            .from("workout_sets")
            .select("*")
            .in("workout_session_exercise_id", exerciseIds);

          if (setsError) {
            setError(setsError.message);
            setLoading(false);
            return;
          }

          workoutSetsData = setsData || [];
        }
      }

      setSessions(sessionsData || []);
      setSessionExercises(sessionExercisesData);
      setWorkoutSets(workoutSetsData);
      setLoading(false);
    }

    loadData();
  }, [router, supabase]);

  const sessionsMap = useMemo(() => {
    const map = new Map();
    for (const session of sessions) {
      map.set(session.id, session);
    }
    return map;
  }, [sessions]);

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

  const exerciseStats = useMemo(() => {
    const grouped = new Map();

    for (const exercise of sessionExercises) {
      const template = exercise.exercise_templates;
      if (!template) continue;

      if (!grouped.has(template.id)) {
        grouped.set(template.id, {
          templateId: template.id,
          name: template.name,
          muscle: template.muscles?.name || "-",
          sessions: 0,
          totalVolume: 0,
          bestSetVolume: 0,
          lastPerformance: null,
          points: [],
        });
      }

      const entry = grouped.get(template.id);
      const sets = setsBySessionExerciseId.get(exercise.id) || [];
      const session = sessionsMap.get(exercise.workout_session_id);
      const date = session?.completed_at || session?.started_at || null;

      let sessionVolume = 0;
      let bestSet = 0;
      let lastCompletedSet = null;

      for (const set of sets) {
        if (!set.is_completed) continue;

        const volume = (Number(set.weight) || 0) * (Number(set.reps) || 0);
        sessionVolume += volume;

        if (volume > bestSet) bestSet = volume;
        if (volume > entry.bestSetVolume) entry.bestSetVolume = volume;

        if (!lastCompletedSet || set.set_number > lastCompletedSet.set_number) {
          lastCompletedSet = set;
        }
      }

      if (sessionVolume > 0) {
        entry.sessions += 1;
        entry.totalVolume += sessionVolume;

        if (
          !entry.lastPerformance ||
          (date && new Date(date).getTime() > new Date(entry.lastPerformance.date).getTime())
        ) {
          entry.lastPerformance = {
            date,
            reps: lastCompletedSet?.reps ?? null,
            weight: lastCompletedSet?.weight ?? null,
            rir: lastCompletedSet?.rir ?? null,
            volume: sessionVolume,
          };
        }

        entry.points.push({
          date,
          value: sessionVolume,
        });
      }
    }

    const result = [...grouped.values()]
      .map((item) => ({
        ...item,
        points: item.points
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
          .slice(-12),
      }))
      .sort((a, b) => b.totalVolume - a.totalVolume);

    return result;
  }, [sessionExercises, setsBySessionExerciseId, sessionsMap]);

  const selectedExercise = useMemo(() => {
    return exerciseStats.find((item) => item.templateId === selectedExerciseId) || null;
  }, [exerciseStats, selectedExerciseId]);

  useEffect(() => {
    if (!selectedExerciseId && exerciseStats.length > 0) {
      setSelectedExerciseId(exerciseStats[0].templateId);
    }
  }, [exerciseStats, selectedExerciseId]);

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
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-zinc-400">Progression</p>
            <h1 className="text-5xl font-semibold tracking-[-0.04em]">
              Mes exercices
            </h1>
            <p className="mt-3 text-zinc-400">
              Volume, meilleures perfs et évolution par exercice.
            </p>
          </div>

          <div className="flex gap-3">
            <Link
              href="/system"
              className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm hover:bg-white/15"
            >
              Retour système
            </Link>
          </div>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
          <section className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-medium">Exercices</h2>
              <span className="text-sm text-zinc-500">{exerciseStats.length}</span>
            </div>

            <div className="space-y-3">
              {exerciseStats.map((exercise) => {
                const active = selectedExerciseId === exercise.templateId;

                return (
                  <button
                    key={exercise.templateId}
                    onClick={() => setSelectedExerciseId(exercise.templateId)}
                    className={`w-full rounded-[20px] border p-4 text-left transition ${
                      active
                        ? "border-white/20 bg-white/10"
                        : "border-white/10 bg-black/20 hover:bg-white/[0.04]"
                    }`}
                  >
                    <p className="text-lg font-medium">{exercise.name}</p>
                    <p className="mt-1 text-sm text-zinc-400">{exercise.muscle}</p>
                    <div className="mt-3 flex items-center justify-between text-sm">
                      <span className="text-zinc-500">{exercise.sessions} séances</span>
                      <span className="text-zinc-300">
                        {formatNumber(exercise.totalVolume)}
                      </span>
                    </div>
                  </button>
                );
              })}

              {exerciseStats.length === 0 ? (
                <div className="rounded-[20px] border border-dashed border-white/10 p-4 text-sm text-zinc-500">
                  Aucune donnée de progression.
                </div>
              ) : null}
            </div>
          </section>

          <section className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
            {!selectedExercise ? (
              <div className="flex min-h-[300px] items-center justify-center text-zinc-500">
                Sélectionne un exercice.
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <h2 className="text-3xl font-medium">{selectedExercise.name}</h2>
                  <p className="mt-1 text-sm text-zinc-400">{selectedExercise.muscle}</p>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-[20px] border border-white/10 bg-black/20 p-4">
                    <p className="text-sm text-zinc-400">Volume total</p>
                    <p className="mt-2 text-3xl font-semibold tracking-[-0.04em]">
                      {formatNumber(selectedExercise.totalVolume)}
                    </p>
                  </div>

                  <div className="rounded-[20px] border border-white/10 bg-black/20 p-4">
                    <p className="text-sm text-zinc-400">Meilleure série</p>
                    <p className="mt-2 text-3xl font-semibold tracking-[-0.04em]">
                      {formatNumber(selectedExercise.bestSetVolume)}
                    </p>
                  </div>

                  <div className="rounded-[20px] border border-white/10 bg-black/20 p-4">
                    <p className="text-sm text-zinc-400">Nombre de séances</p>
                    <p className="mt-2 text-3xl font-semibold tracking-[-0.04em]">
                      {selectedExercise.sessions}
                    </p>
                  </div>
                </div>

                <div className="rounded-[22px] border border-white/10 bg-black/20 p-5">
                  <h3 className="text-xl font-medium">Dernière perf</h3>
                  <p className="mt-3 text-sm text-zinc-300">
                    {selectedExercise.lastPerformance
                      ? `${selectedExercise.lastPerformance.weight ?? "-"} kg • ${selectedExercise.lastPerformance.reps ?? "-"} reps • RIR ${selectedExercise.lastPerformance.rir ?? "-"} • ${formatDate(selectedExercise.lastPerformance.date)}`
                      : "Aucune"}
                  </p>
                </div>

                <div className="rounded-[22px] border border-white/10 bg-black/20 p-5">
                  <div className="mb-4">
                    <h3 className="text-xl font-medium">Évolution volume</h3>
                    <p className="mt-1 text-sm text-zinc-400">
                      Dernières séances sur cet exercice.
                    </p>
                  </div>

                  <MiniChart data={selectedExercise.points} />
                </div>

                <div className="rounded-[22px] border border-white/10 bg-black/20 p-5">
                  <h3 className="text-xl font-medium">Historique récent</h3>
                  <div className="mt-4 space-y-2">
                    {selectedExercise.points
                      .slice()
                      .reverse()
                      .map((point, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between rounded-2xl border border-white/10 bg-zinc-900/40 px-4 py-3"
                        >
                          <span className="text-sm text-zinc-300">
                            {formatDate(point.date)}
                          </span>
                          <span className="text-sm font-medium text-white">
                            {formatNumber(point.value)}
                          </span>
                        </div>
                      ))}

                    {selectedExercise.points.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-zinc-500">
                        Aucun historique.
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}