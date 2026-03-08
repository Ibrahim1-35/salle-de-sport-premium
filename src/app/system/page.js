"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const MUSCLE_ORDER = [
  "biceps",
  "triceps",
  "pectoraux",
  "quadriceps",
  "dorsaux",
  "fessiers",
  "abdominaux",
  "ischios",
  "mollets",
  "epaules",
  "adducteurs",
];

const PRIORITY_CONFIG = {
  maintenance: {
    label: "Maintenance",
    range: "3-5 séries",
    defaultSets: 4,
    columnClass: "border-emerald-900/60 bg-emerald-950/35",
    badgeClass: "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
    cardClass: "border-emerald-800/30 bg-emerald-950/20",
  },
  moderate: {
    label: "Modérée",
    range: "6-12 séries",
    defaultSets: 8,
    columnClass: "border-amber-900/60 bg-amber-950/35",
    badgeClass: "border-amber-400/20 bg-amber-400/10 text-amber-200",
    cardClass: "border-amber-800/30 bg-amber-950/20",
  },
  priority: {
    label: "Prioritaire",
    range: "12+ séries",
    defaultSets: 12,
    columnClass: "border-rose-900/60 bg-rose-950/35",
    badgeClass: "border-rose-400/20 bg-rose-400/10 text-rose-200",
    cardClass: "border-rose-800/30 bg-rose-950/20",
  },
};

const MUSCLE_COLUMN_COLORS = {
  dorsaux: "border-fuchsia-900/50 bg-fuchsia-950/30",
  epaules: "border-zinc-700/50 bg-zinc-800/45",
  fessiers: "border-amber-900/50 bg-amber-950/30",
  pectoraux: "border-orange-900/50 bg-orange-950/30",
  quadriceps: "border-sky-900/50 bg-sky-950/30",
  adducteurs: "border-rose-900/50 bg-rose-950/30",
  triceps: "border-emerald-900/50 bg-emerald-950/30",
  ischios: "border-zinc-600/50 bg-zinc-800/35",
  mollets: "border-orange-900/50 bg-orange-950/25",
  abdominaux: "border-slate-700/50 bg-slate-900/30",
  biceps: "border-violet-900/50 bg-violet-950/30",
};

const DAY_COLUMN_COLORS = [
  "border-zinc-700/50 bg-zinc-800/40",
  "border-violet-900/50 bg-violet-950/30",
  "border-zinc-600/50 bg-zinc-800/35",
  "border-amber-900/50 bg-amber-950/30",
  "border-emerald-900/50 bg-emerald-950/30",
  "border-sky-900/50 bg-sky-950/30",
  "border-rose-900/50 bg-rose-950/30",
];

function sortByMuscleOrder(a, b) {
  const indexA = MUSCLE_ORDER.indexOf(a.slug);
  const indexB = MUSCLE_ORDER.indexOf(b.slug);

  const safeA = indexA === -1 ? 999 : indexA;
  const safeB = indexB === -1 ? 999 : indexB;

  if (safeA !== safeB) return safeA - safeB;
  return a.name.localeCompare(b.name);
}

function getPriorityFromSets(sets) {
  if (sets <= 5) return "maintenance";
  if (sets <= 12) return "moderate";
  return "priority";
}

function getUniqueMuscleNames(items) {
  return [
    ...new Set(
      items
        .map((item) => item.exercise_templates?.muscles?.name)
        .filter(Boolean)
    ),
  ];
}

function formatDurationFromMs(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
      2,
      "0"
    )}:${String(seconds).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
    2,
    "0"
  )}`;
}

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
function getPeriodStart(range) {
  const now = new Date();
  const start = new Date(now);

  if (range === "month") {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  if (range === "3m") {
    start.setMonth(start.getMonth() - 3);
    return start;
  }

  if (range === "6m") {
    start.setMonth(start.getMonth() - 6);
    return start;
  }

  start.setMonth(0);
  start.setDate(1);
  start.setHours(0, 0, 0, 0);

  return start;
}

function buildChartData(sessions, range) {
  const start = getPeriodStart(range);

  const filtered = sessions.filter((session) => {
    const date = new Date(session.completed_at || session.started_at);
    return date >= start;
  });

  const buckets = new Map();

  for (const session of filtered) {
    const date = new Date(session.completed_at || session.started_at);

    let key = "";
    let label = "";
    let sortValue = 0;

    if (range === "year") {
      key = `${date.getFullYear()}-${date.getMonth()}`;
      label = date.toLocaleDateString("fr-FR", { month: "short" });
      sortValue = new Date(
        date.getFullYear(),
        date.getMonth(),
        1
      ).getTime();
    } else {
      key = date.toLocaleDateString("fr-FR");
      label = date.toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
      });
      sortValue = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate()
      ).getTime();
    }

    if (!buckets.has(key)) {
      buckets.set(key, {
        label,
        sortValue,
        value: 0,
      });
    }

    buckets.get(key).value += session.volume;
  }

  return [...buckets.values()].sort((a, b) => a.sortValue - b.sortValue);
}

function ProgressChart({ data }) {
  const width = 900;
  const height = 220;
  const padding = 24;

  if (!data.length) {
    return (
      <div className="flex h-[220px] items-center justify-center rounded-xl border border-dashed border-white/10 text-sm text-zinc-500">
        Pas encore assez de données.
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

    const y =
      padding + innerHeight - (item.value / maxValue) * innerHeight;

    return { ...item, x, y };
  });

  const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-[220px] w-full"
      >
        {[0, 0.25, 0.5, 0.75, 1].map((step) => {
          const y = padding + innerHeight - innerHeight * step;

          return (
            <line
              key={step}
              x1={padding}
              y1={y}
              x2={width - padding}
              y2={y}
              stroke="rgba(255,255,255,0.07)"
              strokeWidth="1"
            />
          );
        })}

        <polyline
          fill="none"
          stroke="rgba(255,255,255,0.95)"
          strokeWidth="3"
          points={polyline}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {points.map((point, index) => (
          <g key={index}>
            <circle cx={point.x} cy={point.y} r="4.5" fill="white" />

            <text
              x={point.x}
              y={height - 8}
              textAnchor="middle"
              fontSize="11"
              fill="rgba(255,255,255,0.5)"
            >
              {point.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function SectionCard({ children, className = "" }) {
  return (
    <section
      className={`rounded-2xl border border-white/10 bg-white/[0.03] shadow-[0_0_0_1px_rgba(255,255,255,0.02)_inset] p-4 sm:p-6 ${className}`}
    >
      {children}
    </section>
  );
}
export default function SystemPage() {
  const router = useRouter();
  const supabase = createClient();

  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  const [muscles, setMuscles] = useState([]);
  const [muscleSettings, setMuscleSettings] = useState([]);
  const [exerciseTemplates, setExerciseTemplates] = useState([]);
  const [trainingDays, setTrainingDays] = useState([]);
  const [programExercises, setProgramExercises] = useState([]);

  const [completedSessions, setCompletedSessions] = useState([]);
  const [completedSessionExercises, setCompletedSessionExercises] = useState([]);
  const [completedWorkoutSets, setCompletedWorkoutSets] = useState([]);

  const [activeSession, setActiveSession] = useState(null);

  const [chartRange, setChartRange] = useState("3m");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    if (!activeSession?.started_at) return;

    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, [activeSession]);

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

      const [
        profileRes,
        musclesRes,
        settingsRes,
        templatesRes,
        daysRes,
        programRes,
        activeSessionRes,
        completedSessionsRes,
      ] = await Promise.all([

        supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single(),

        supabase
          .from("muscles")
          .select("*"),

        supabase
          .from("user_muscle_settings")
          .select("*")
          .eq("user_id", user.id),

        supabase
          .from("exercise_templates")
          .select("*, muscles(*)")
          .or(`user_id.is.null,user_id.eq.${user.id}`)
          .order("name"),

        supabase
          .from("training_days")
          .select("*")
          .eq("user_id", user.id)
          .order("order_index"),

        supabase
          .from("program_exercises")
          .select(`
            *,
            training_days(*),
            exercise_templates(
              *,
              muscles(*)
            )
          `)
          .eq("user_id", user.id)
          .order("order_index"),

        supabase
          .from("workout_sessions")
          .select(`
            *,
            training_days(*)
          `)
          .eq("user_id", user.id)
          .eq("status", "active")
          .limit(1)
          .maybeSingle(),

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

      setProfile(profileRes.data || null);

      const musclesSafe = (musclesRes.data || []).sort(sortByMuscleOrder);

      setMuscles(musclesSafe);
      setMuscleSettings(settingsRes.data || []);
      setExerciseTemplates(templatesRes.data || []);
      setTrainingDays(daysRes.data || []);
      setProgramExercises(programRes.data || []);
      setActiveSession(activeSessionRes.data || null);
      setCompletedSessions(completedSessionsRes.data || []);

      setLoading(false);
    }

    loadData();

  }, [router, supabase]);
    const settingsMap = useMemo(() => {
    const map = new Map();

    for (const setting of muscleSettings) {
      map.set(setting.muscle_id, setting);
    }

    return map;
  }, [muscleSettings]);

  const completedExercisesBySessionId = useMemo(() => {

    const map = new Map();

    for (const exercise of completedSessionExercises) {

      if (!map.has(exercise.workout_session_id)) {
        map.set(exercise.workout_session_id, []);
      }

      map.get(exercise.workout_session_id).push(exercise);
    }

    return map;

  }, [completedSessionExercises]);

  const completedSetsByExerciseId = useMemo(() => {

    const map = new Map();

    for (const set of completedWorkoutSets) {

      if (!map.has(set.workout_session_exercise_id)) {
        map.set(set.workout_session_exercise_id, []);
      }

      map.get(set.workout_session_exercise_id).push(set);
    }

    return map;

  }, [completedWorkoutSets]);

  const completedSessionsEnriched = useMemo(() => {

    return completedSessions.map((session) => {

      const exercises = completedExercisesBySessionId.get(session.id) || [];

      let volume = 0;
      let completedSetCount = 0;
      let bestSetVolume = 0;

      for (const exercise of exercises) {

        const sets = completedSetsByExerciseId.get(exercise.id) || [];

        for (const set of sets) {

          if (!set.is_completed) continue;

          completedSetCount += 1;

          const setVolume =
            (Number(set.weight) || 0) *
            (Number(set.reps) || 0);

          volume += setVolume;

          if (setVolume > bestSetVolume)
            bestSetVolume = setVolume;

        }
      }

      const durationMs =
        session.completed_at && session.started_at
          ? new Date(session.completed_at).getTime() -
            new Date(session.started_at).getTime()
          : 0;

      return {
        ...session,
        exercises,
        volume,
        completedSetCount,
        bestSetVolume,
        durationMs,
      };

    });

  }, [
    completedSessions,
    completedExercisesBySessionId,
    completedSetsByExerciseId,
  ]);
    const chartData = useMemo(
    () => buildChartData(completedSessionsEnriched, chartRange),
    [completedSessionsEnriched, chartRange]
  );

  const performanceStats = useMemo(() => {

    const monthStart = getPeriodStart("month");
    const yearStart = getPeriodStart("year");

    let monthVolume = 0;
    let yearVolume = 0;
    let bestSessionVolume = 0;
    let bestSetVolume = 0;

    for (const session of completedSessionsEnriched) {

      const date = new Date(session.completed_at || session.started_at);

      if (date >= monthStart)
        monthVolume += session.volume;

      if (date >= yearStart)
        yearVolume += session.volume;

      if (session.volume > bestSessionVolume)
        bestSessionVolume = session.volume;

      if (session.bestSetVolume > bestSetVolume)
        bestSetVolume = session.bestSetVolume;
    }

    return {
      monthVolume,
      yearVolume,
      bestSessionVolume,
      bestSetVolume,
    };

  }, [completedSessionsEnriched]);


  const activeSessionElapsed = useMemo(() => {

    if (!activeSession?.started_at)
      return null;

    return formatDurationFromMs(
      nowMs - new Date(activeSession.started_at).getTime()
    );

  }, [activeSession, nowMs]);


  if (loading) {

    return (
      <main className="min-h-screen bg-zinc-950 px-4 py-6 text-white">
        <div className="mx-auto max-w-5xl">
          <p className="text-zinc-400">Chargement...</p>
        </div>
      </main>
    );

  }


  return (

    <main className="min-h-screen bg-zinc-950 px-4 sm:px-6 lg:px-8 py-6 sm:py-10 text-white">

      <div className="mx-auto w-full max-w-6xl space-y-8">

        {/* HEADER */}

        <header className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-6 md:p-8">

          <div className="flex flex-col gap-6 lg:flex-row lg:justify-between">

            <div className="space-y-4">

              <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">
                Workspace performance
              </div>

              <div>

                <h1 className="text-3xl sm:text-5xl md:text-6xl font-semibold tracking-tight">
                  Système {profile?.username || "Utilisateur"}
                </h1>

                <p className="mt-3 max-w-2xl text-sm sm:text-base text-zinc-400">
                  Organise ton physique : priorités musculaires,
                  volume hebdomadaire, séances et progression.
                </p>

              </div>

            </div>

            {/* STATS */}

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">

              <div className="rounded-xl border border-white/10 bg-black/20 p-4">

                <p className="text-xs text-zinc-500">
                  Séances
                </p>

                <p className="mt-2 text-2xl font-semibold">
                  {completedSessionsEnriched.length}
                </p>

              </div>


              <div className="rounded-xl border border-white/10 bg-black/20 p-4">

                <p className="text-xs text-zinc-500">
                  Volume mois
                </p>

                <p className="mt-2 text-2xl font-semibold">
                  {formatNumber(performanceStats.monthVolume)}
                </p>

              </div>


              <div className="rounded-xl border border-white/10 bg-black/20 p-4">

                <p className="text-xs text-zinc-500">
                  Record séance
                </p>

                <p className="mt-2 text-2xl font-semibold">
                  {formatNumber(performanceStats.bestSessionVolume)}
                </p>

              </div>

            </div>

          </div>

        </header>



        {/* SESSION ACTIVE */}

        {activeSession ? (

          <SectionCard className="border-emerald-500/20 bg-emerald-500/[0.05]">

            <div className="flex flex-col sm:flex-row sm:justify-between gap-4">

              <div>

                <p className="text-sm text-emerald-300">
                  Séance active
                </p>

                <h2 className="text-2xl font-semibold">
                  {activeSession.training_days?.name}
                </h2>

                <p className="text-sm text-zinc-400 mt-1">
                  Durée : {activeSessionElapsed}
                </p>

              </div>


              <Link
                href={`/workout/${activeSession.training_day_id}`}
                className="self-start rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300"
              >
                Reprendre
              </Link>

            </div>

          </SectionCard>

        ) : null}



        {/* GRAPH */}

        <SectionCard>

          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">

            <div>

              <h2 className="text-xl font-semibold">
                Progression volume
              </h2>

              <p className="text-sm text-zinc-400">
                Historique de tes performances
              </p>

            </div>


            <div className="flex gap-2">

              {["month","3m","6m","year"].map((range)=>(
                <button
                  key={range}
                  onClick={()=>setChartRange(range)}
                  className={`rounded-lg border px-3 py-1 text-sm ${
                    chartRange===range
                    ? "border-white/20 bg-white/10"
                    : "border-white/10 bg-white/5 text-zinc-400"
                  }`}
                >
                  {range}
                </button>
              ))}

            </div>

          </div>


          <ProgressChart data={chartData} />

        </SectionCard>


      </div>

    </main>

  );
}