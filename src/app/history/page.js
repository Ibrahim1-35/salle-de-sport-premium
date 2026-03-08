"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function formatDate(dateString) {
  if (!dateString) return "Date inconnue";

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(dateString));
}

export default function HistoryPage() {
  const router = useRouter();
  const supabase = createClient();

  const [user, setUser] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [selectedSessionDetails, setSelectedSessionDetails] = useState(null);
  const [selectedSessionSets, setSelectedSessionSets] = useState({});
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadHistory() {
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

      const { data, error } = await supabase
        .from("workout_sessions")
        .select(`
          *,
          training_days(*)
        `)
        .eq("user_id", user.id)
        .eq("status", "completed")
        .order("completed_at", { ascending: false });

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      setSessions(data || []);
      setLoading(false);
    }

    loadHistory();
  }, [router, supabase]);

  async function openSessionDetails(sessionId) {
    setSelectedSessionId(sessionId);
    setDetailsLoading(true);
    setError("");

    const { data: exercises, error: exercisesError } = await supabase
      .from("workout_session_exercises")
      .select(`
        *,
        exercise_templates(
          *,
          muscles(*)
        )
      `)
      .eq("workout_session_id", sessionId)
      .order("order_index", { ascending: true });

    if (exercisesError) {
      setError(exercisesError.message);
      setDetailsLoading(false);
      return;
    }

    const exerciseIds = (exercises || []).map((item) => item.id);

    let groupedSets = {};

    if (exerciseIds.length > 0) {
      const { data: sets, error: setsError } = await supabase
        .from("workout_sets")
        .select("*")
        .in("workout_session_exercise_id", exerciseIds)
        .order("set_number", { ascending: true });

      if (setsError) {
        setError(setsError.message);
        setDetailsLoading(false);
        return;
      }

      groupedSets = {};
      for (const set of sets || []) {
        if (!groupedSets[set.workout_session_exercise_id]) {
          groupedSets[set.workout_session_exercise_id] = [];
        }
        groupedSets[set.workout_session_exercise_id].push(set);
      }
    }

    setSelectedSessionDetails(exercises || []);
    setSelectedSessionSets(groupedSets);
    setDetailsLoading(false);
  }

  const sessionsWithStats = useMemo(() => {
    return sessions.map((session) => ({
      ...session,
      displayName: session.training_days?.name || "Séance",
    }));
  }, [sessions]);

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
            <p className="text-sm text-zinc-400">Historique</p>
            <h1 className="text-5xl font-semibold tracking-[-0.04em]">
              Mes séances
            </h1>
            <p className="mt-3 text-zinc-400">
              Retrouve toutes tes séances terminées.
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

        <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
          <section className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-medium">Séances terminées</h2>
              <span className="text-sm text-zinc-500">{sessionsWithStats.length}</span>
            </div>

            <div className="space-y-3">
              {sessionsWithStats.map((session) => {
                const isActive = selectedSessionId === session.id;

                return (
                  <button
                    key={session.id}
                    onClick={() => openSessionDetails(session.id)}
                    className={`w-full rounded-[20px] border p-4 text-left transition ${
                      isActive
                        ? "border-white/20 bg-white/10"
                        : "border-white/10 bg-black/20 hover:bg-white/[0.04]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-medium">{session.displayName}</p>
                        <p className="mt-1 text-sm text-zinc-400">
                          {formatDate(session.completed_at || session.started_at)}
                        </p>
                      </div>

                      <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-xs text-emerald-300">
                        Terminée
                      </span>
                    </div>
                  </button>
                );
              })}

              {sessionsWithStats.length === 0 ? (
                <div className="rounded-[20px] border border-dashed border-white/10 p-4 text-sm text-zinc-500">
                  Aucune séance terminée pour le moment.
                </div>
              ) : null}
            </div>
          </section>

          <section className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
            {!selectedSessionId ? (
              <div className="flex min-h-[300px] items-center justify-center text-zinc-500">
                Sélectionne une séance pour voir le détail.
              </div>
            ) : detailsLoading ? (
              <div className="flex min-h-[300px] items-center justify-center text-zinc-400">
                Chargement du détail...
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-medium">Détail de la séance</h2>
                  <p className="mt-1 text-sm text-zinc-400">
                    Exercices, séries, poids, reps et RIR.
                  </p>
                </div>

                <div className="space-y-5">
                  {(selectedSessionDetails || []).map((exercise) => {
                    const sets = selectedSessionSets[exercise.id] || [];
                    const completedCount = sets.filter((set) => set.is_completed).length;

                    return (
                      <div
                        key={exercise.id}
                        className="rounded-[22px] border border-white/10 bg-black/20 p-4"
                      >
                        <div className="mb-4 flex items-start justify-between gap-3">
                          <div>
                            <h3 className="text-xl font-medium">
                              {exercise.exercise_templates?.name}
                            </h3>
                            <p className="mt-1 text-sm text-zinc-400">
                              {exercise.exercise_templates?.muscles?.name} • {completedCount}/{sets.length} séries validées
                            </p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          {sets.map((set) => (
                            <div
                              key={set.id}
                              className={`grid grid-cols-[80px_1fr_1fr_1fr_110px] gap-3 rounded-2xl border p-3 ${
                                set.is_completed
                                  ? "border-emerald-500/20 bg-emerald-500/5"
                                  : "border-white/10 bg-zinc-900/40"
                              }`}
                            >
                              <div className="text-sm font-medium text-zinc-300">
                                Série {set.set_number}
                              </div>

                              <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white">
                                {set.weight ?? "-"} kg
                              </div>

                              <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white">
                                {set.reps ?? "-"} reps
                              </div>

                              <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white">
                                RIR {set.rir ?? "-"}
                              </div>

                              <div
                                className={`rounded-xl border px-3 py-2 text-center text-sm ${
                                  set.is_completed
                                    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                                    : "border-white/10 bg-white/5 text-zinc-400"
                                }`}
                              >
                                {set.is_completed ? "Validée" : "Non validée"}
                              </div>
                            </div>
                          ))}

                          {sets.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-zinc-500">
                              Aucune série enregistrée.
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}

                  {(selectedSessionDetails || []).length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-zinc-500">
                      Aucun exercice trouvé pour cette séance.
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}