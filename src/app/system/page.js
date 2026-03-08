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
  return [...new Set(items.map((item) => item.exercise_templates?.muscles?.name).filter(Boolean))];
}

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
      sortValue = new Date(date.getFullYear(), date.getMonth(), 1).getTime();
    } else {
      key = date.toLocaleDateString("fr-FR");
      label = date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
      sortValue = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
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
  const height = 240;
  const padding = 28;

  if (!data.length) {
    return (
      <div className="flex h-[240px] items-center justify-center rounded-[22px] border border-dashed border-white/10 text-sm text-zinc-500">
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
    const y = padding + innerHeight - (item.value / maxValue) * innerHeight;
    return { ...item, x, y };
  });

  const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[240px] w-full min-w-[760px]">
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
      className={`rounded-[30px] border border-white/10 bg-white/[0.03] shadow-[0_0_0_1px_rgba(255,255,255,0.02)_inset] ${className}`}
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

  const [topView, setTopView] = useState("board");
  const [bottomView, setBottomView] = useState("muscles");
  const [chartRange, setChartRange] = useState("3m");

  const [newDayName, setNewDayName] = useState("");
  const [customMuscleId, setCustomMuscleId] = useState("");
  const [customExerciseName, setCustomExerciseName] = useState("");

  const [addMuscleId, setAddMuscleId] = useState("");
  const [addTemplateId, setAddTemplateId] = useState("");
  const [addDayId, setAddDayId] = useState("");

  const [editingDayId, setEditingDayId] = useState(null);
  const [editingDayName, setEditingDayName] = useState("");

  const [editingTemplateId, setEditingTemplateId] = useState(null);
  const [editingTemplateName, setEditingTemplateName] = useState("");

  const [draggedMuscleId, setDraggedMuscleId] = useState(null);
  const [dragOverPriority, setDragOverPriority] = useState(null);

  const [draggedExerciseId, setDraggedExerciseId] = useState(null);
  const [dragOverDayId, setDragOverDayId] = useState(null);
  const [dragOverExerciseId, setDragOverExerciseId] = useState(null);

  const [nowMs, setNowMs] = useState(Date.now());

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase.from("muscles").select("*"),
        supabase.from("user_muscle_settings").select("*").eq("user_id", user.id),
        supabase
          .from("exercise_templates")
          .select("*, muscles(*)")
          .or(`user_id.is.null,user_id.eq.${user.id}`)
          .order("name", { ascending: true }),
        supabase
          .from("training_days")
          .select("*")
          .eq("user_id", user.id)
          .order("order_index", { ascending: true }),
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
          .order("order_index", { ascending: true }),
        supabase
          .from("workout_sessions")
          .select(`
            *,
            training_days(*)
          `)
          .eq("user_id", user.id)
          .eq("status", "active")
          .order("started_at", { ascending: false })
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
      const settingsSafe = settingsRes.data || [];

      setMuscles(musclesSafe);
      setMuscleSettings(settingsSafe);
      setExerciseTemplates(templatesRes.data || []);
      setTrainingDays(daysRes.data || []);
      setProgramExercises(programRes.data || []);
      setActiveSession(activeSessionRes.data || null);
      setCompletedSessions(completedSessionsRes.data || []);

      if (musclesSafe.length > 0 && settingsSafe.length === 0) {
        const defaultRows = musclesSafe.map((muscle) => ({
          user_id: user.id,
          muscle_id: muscle.id,
          priority: "moderate",
          target_sets: 8,
        }));

        const { data: insertedSettings, error: insertError } = await supabase
          .from("user_muscle_settings")
          .insert(defaultRows)
          .select("*");

        if (insertError) {
          setError(insertError.message);
        } else {
          setMuscleSettings(insertedSettings || []);
        }
      }

      const completedIds = (completedSessionsRes.data || []).map((item) => item.id);

      if (completedIds.length > 0) {
        const exercisesRes = await supabase
          .from("workout_session_exercises")
          .select(`
            *,
            exercise_templates(
              *,
              muscles(*)
            )
          `)
          .in("workout_session_id", completedIds);

        setCompletedSessionExercises(exercisesRes.data || []);

        const exerciseIds = (exercisesRes.data || []).map((item) => item.id);

        if (exerciseIds.length > 0) {
          const setsRes = await supabase
            .from("workout_sets")
            .select("*")
            .in("workout_session_exercise_id", exerciseIds);

          setCompletedWorkoutSets(setsRes.data || []);
        } else {
          setCompletedWorkoutSets([]);
        }
      } else {
        setCompletedSessionExercises([]);
        setCompletedWorkoutSets([]);
      }

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
          const setVolume = (Number(set.weight) || 0) * (Number(set.reps) || 0);
          volume += setVolume;
          if (setVolume > bestSetVolume) bestSetVolume = setVolume;
        }
      }

      const durationMs =
        session.completed_at && session.started_at
          ? new Date(session.completed_at).getTime() - new Date(session.started_at).getTime()
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
  }, [completedSessions, completedExercisesBySessionId, completedSetsByExerciseId]);

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
      if (date >= monthStart) monthVolume += session.volume;
      if (date >= yearStart) yearVolume += session.volume;
      if (session.volume > bestSessionVolume) bestSessionVolume = session.volume;
      if (session.bestSetVolume > bestSetVolume) bestSetVolume = session.bestSetVolume;
    }

    return { monthVolume, yearVolume, bestSessionVolume, bestSetVolume };
  }, [completedSessionsEnriched]);

  const musclesWithSettings = useMemo(() => {
    return muscles
      .map((muscle) => {
        const setting = settingsMap.get(muscle.id);
        const priority = setting?.priority || "moderate";
        const targetSets = setting?.target_sets ?? PRIORITY_CONFIG[priority].defaultSets;

        return {
          ...muscle,
          settingId: setting?.id || null,
          priority,
          targetSets,
          range: PRIORITY_CONFIG[priority].range,
        };
      })
      .sort(sortByMuscleOrder);
  }, [muscles, settingsMap]);

  const groupedMuscles = useMemo(
    () => ({
      maintenance: musclesWithSettings.filter((muscle) => muscle.priority === "maintenance"),
      moderate: musclesWithSettings.filter((muscle) => muscle.priority === "moderate"),
      priority: musclesWithSettings.filter((muscle) => muscle.priority === "priority"),
    }),
    [musclesWithSettings]
  );

  const selectedAddTemplates = useMemo(() => {
    if (!addMuscleId) return [];
    return exerciseTemplates.filter((item) => item.muscle_id === addMuscleId);
  }, [exerciseTemplates, addMuscleId]);

  const customTemplates = useMemo(
    () => exerciseTemplates.filter((item) => item.is_custom),
    [exerciseTemplates]
  );

  const muscleBoards = useMemo(() => {
    return musclesWithSettings
      .map((muscle) => {
        const items = programExercises
          .filter((item) => item.exercise_templates?.muscle_id === muscle.id)
          .sort((a, b) => {
            const orderDayA = a.training_days?.order_index ?? 999;
            const orderDayB = b.training_days?.order_index ?? 999;
            if (orderDayA !== orderDayB) return orderDayA - orderDayB;
            return (a.order_index ?? 0) - (b.order_index ?? 0);
          });

        const currentSets = items.reduce((sum, item) => sum + (item.set_count || 0), 0);

        return {
          ...muscle,
          items,
          currentSets,
          diff: currentSets - muscle.targetSets,
          colorClass:
            MUSCLE_COLUMN_COLORS[muscle.slug] || "border-zinc-700/50 bg-zinc-800/35",
        };
      })
      .filter((muscle) => muscle.items.length > 0 || muscle.targetSets > 0);
  }, [musclesWithSettings, programExercises]);

  const dayBoards = useMemo(() => {
    return trainingDays.map((day, index) => {
      const items = programExercises
        .filter((item) => item.training_day_id === day.id)
        .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));

      const totalSets = items.reduce((sum, item) => sum + (item.set_count || 0), 0);

      return {
        ...day,
        items,
        totalSets,
        muscles: getUniqueMuscleNames(items),
        colorClass: DAY_COLUMN_COLORS[index % DAY_COLUMN_COLORS.length],
      };
    });
  }, [trainingDays, programExercises]);

  const weekSummary = useMemo(() => {
    const totalSets = programExercises.reduce((sum, item) => sum + (item.set_count || 0), 0);
    const totalExercises = programExercises.length;
    const trainedMuscles = getUniqueMuscleNames(programExercises).length;
    return { totalSets, totalExercises, trainedMuscles };
  }, [programExercises]);

  const activeSessionElapsed = useMemo(() => {
    if (!activeSession?.started_at) return null;
    return formatDurationFromMs(nowMs - new Date(activeSession.started_at).getTime());
  }, [activeSession, nowMs]);

  async function refreshProgramData(currentUserId) {
    const uid = currentUserId || user?.id;
    if (!uid) return;

    const [templatesRes, daysRes, programRes, activeSessionRes] = await Promise.all([
      supabase
        .from("exercise_templates")
        .select("*, muscles(*)")
        .or(`user_id.is.null,user_id.eq.${uid}`)
        .order("name", { ascending: true }),
      supabase
        .from("training_days")
        .select("*")
        .eq("user_id", uid)
        .order("order_index", { ascending: true }),
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
        .eq("user_id", uid)
        .order("order_index", { ascending: true }),
      supabase
        .from("workout_sessions")
        .select(`
          *,
          training_days(*)
        `)
        .eq("user_id", uid)
        .eq("status", "active")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    setExerciseTemplates(templatesRes.data || []);
    setTrainingDays(daysRes.data || []);
    setProgramExercises(programRes.data || []);
    setActiveSession(activeSessionRes.data || null);
  }

  async function updateMusclePriority(muscleId, newPriority) {
    setError("");
    const existing = settingsMap.get(muscleId);
    if (!existing) return;

    const { data, error } = await supabase
      .from("user_muscle_settings")
      .update({
        priority: newPriority,
        target_sets: PRIORITY_CONFIG[newPriority].defaultSets,
      })
      .eq("id", existing.id)
      .select("*")
      .single();

    if (error) {
      setError(error.message);
      return;
    }

    setMuscleSettings((prev) => prev.map((item) => (item.id === data.id ? data : item)));
  }

  async function updateTargetSets(muscleId, value) {
    setError("");
    const existing = settingsMap.get(muscleId);
    if (!existing) return;

    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return;

    const { data, error } = await supabase
      .from("user_muscle_settings")
      .update({ target_sets: parsed })
      .eq("id", existing.id)
      .select("*")
      .single();

    if (error) {
      setError(error.message);
      return;
    }

    setMuscleSettings((prev) => prev.map((item) => (item.id === data.id ? data : item)));
  }

  async function handlePriorityDrop(targetPriority) {
    if (!draggedMuscleId) return;
    const muscle = musclesWithSettings.find((item) => item.id === draggedMuscleId);

    setDragOverPriority(null);
    setDraggedMuscleId(null);

    if (!muscle || muscle.priority === targetPriority) return;
    await updateMusclePriority(draggedMuscleId, targetPriority);
  }

  async function handleCreateDay(e) {
    e.preventDefault();
    setError("");

    if (!user) return;
    if (!newDayName.trim()) {
      setError("Entre un nom de séance.");
      return;
    }

    const nextOrder = trainingDays.length + 1;

    const { error } = await supabase.from("training_days").insert({
      user_id: user.id,
      name: newDayName.trim(),
      order_index: nextOrder,
    });

    if (error) {
      setError(error.message);
      return;
    }

    setNewDayName("");
    await refreshProgramData(user.id);
  }

  async function deleteTrainingDay(id) {
    setError("");
    const { error } = await supabase.from("training_days").delete().eq("id", id);

    if (error) {
      setError(error.message);
      return;
    }

    await refreshProgramData(user.id);
  }

  async function saveTrainingDayName(dayId) {
    setError("");
    if (!editingDayName.trim()) {
      setError("Le nom de la séance est obligatoire.");
      return;
    }

    const { error } = await supabase
      .from("training_days")
      .update({ name: editingDayName.trim() })
      .eq("id", dayId);

    if (error) {
      setError(error.message);
      return;
    }

    setEditingDayId(null);
    setEditingDayName("");
    await refreshProgramData(user.id);
  }

  async function handleCreateCustomExercise(e) {
    e.preventDefault();
    setError("");

    if (!user) return;
    if (!customMuscleId) {
      setError("Choisis un muscle.");
      return;
    }
    if (!customExerciseName.trim()) {
      setError("Entre un nom d'exercice.");
      return;
    }

    const { error } = await supabase.from("exercise_templates").insert({
      user_id: user.id,
      muscle_id: customMuscleId,
      name: customExerciseName.trim(),
      is_custom: true,
    });

    if (error) {
      setError(error.message);
      return;
    }

    setCustomExerciseName("");
    await refreshProgramData(user.id);
  }

  async function saveCustomTemplateName(templateId) {
    setError("");
    if (!editingTemplateName.trim()) {
      setError("Le nom de l'exercice est obligatoire.");
      return;
    }

    const { error } = await supabase
      .from("exercise_templates")
      .update({ name: editingTemplateName.trim() })
      .eq("id", templateId);

    if (error) {
      setError(error.message);
      return;
    }

    setEditingTemplateId(null);
    setEditingTemplateName("");
    await refreshProgramData(user.id);
  }

  async function deleteCustomTemplate(templateId) {
    setError("");

    const linked = programExercises.some((item) => item.exercise_template_id === templateId);
    if (linked) {
      setError("Supprime d’abord cet exercice du programme.");
      return;
    }

    const { error } = await supabase.from("exercise_templates").delete().eq("id", templateId);

    if (error) {
      setError(error.message);
      return;
    }

    await refreshProgramData(user.id);
  }

  async function handleAddProgramExercise(e) {
    e.preventDefault();
    setError("");

    if (!user) return;
    if (!addTemplateId || !addDayId) {
      setError("Choisis un exercice et une séance.");
      return;
    }

    const currentForDay = programExercises.filter((item) => item.training_day_id === addDayId);
    const nextOrder = currentForDay.length + 1;

    const { error } = await supabase.from("program_exercises").insert({
      user_id: user.id,
      training_day_id: addDayId,
      exercise_template_id: addTemplateId,
      order_index: nextOrder,
      set_count: 3,
    });

    if (error) {
      setError(error.message);
      return;
    }

    setAddTemplateId("");
    await refreshProgramData(user.id);
  }

  async function updateProgramExerciseSets(id, value) {
    setError("");
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return;

    const { error } = await supabase
      .from("program_exercises")
      .update({ set_count: parsed })
      .eq("id", id);

    if (error) {
      setError(error.message);
      return;
    }

    await refreshProgramData(user.id);
  }

  async function deleteProgramExercise(id) {
    setError("");
    const { error } = await supabase.from("program_exercises").delete().eq("id", id);

    if (error) {
      setError(error.message);
      return;
    }

    await refreshProgramData(user.id);
  }

  async function moveExerciseToDayOrPosition(targetDayId, targetExerciseId = null) {
    if (!draggedExerciseId || !user) return;

    const dragged = programExercises.find((item) => item.id === draggedExerciseId);
    if (!dragged) {
      setDraggedExerciseId(null);
      setDragOverDayId(null);
      setDragOverExerciseId(null);
      return;
    }

    const sourceDayId = dragged.training_day_id;

    let targetItems = programExercises
      .filter((item) => item.training_day_id === targetDayId && item.id !== dragged.id)
      .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));

    let insertIndex = targetItems.length;

    if (targetExerciseId) {
      const foundIndex = targetItems.findIndex((item) => item.id === targetExerciseId);
      if (foundIndex !== -1) insertIndex = foundIndex;
    }

    targetItems.splice(insertIndex, 0, {
      ...dragged,
      training_day_id: targetDayId,
    });

    const updates = [];

    for (let i = 0; i < targetItems.length; i += 1) {
      updates.push({
        id: targetItems[i].id,
        training_day_id: targetDayId,
        order_index: i + 1,
      });
    }

    if (sourceDayId !== targetDayId) {
      const sourceItems = programExercises
        .filter((item) => item.training_day_id === sourceDayId && item.id !== dragged.id)
        .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));

      for (let i = 0; i < sourceItems.length; i += 1) {
        updates.push({
          id: sourceItems[i].id,
          training_day_id: sourceDayId,
          order_index: i + 1,
        });
      }
    }

    const { error } = await supabase.from("program_exercises").upsert(updates);

    setDraggedExerciseId(null);
    setDragOverDayId(null);
    setDragOverExerciseId(null);

    if (error) {
      setError(error.message);
      return;
    }

    await refreshProgramData(user.id);
  }

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
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.10),transparent_20%),linear-gradient(180deg,#07070a_0%,#0a0a10_100%)] px-6 py-10 text-white">
      <div className="mx-auto max-w-[1650px] space-y-10">
        <header className="rounded-[34px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_10px_60px_rgba(0,0,0,0.35)] md:p-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="space-y-4">
              <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">
                Workspace performance
              </div>

              <div>
                <h1 className="text-5xl font-semibold tracking-[-0.06em] md:text-7xl">
                  Système {profile?.username || "Utilisateur"}
                </h1>
                <p className="mt-4 max-w-4xl text-base text-zinc-400 md:text-lg">
                  Organise ton physique comme un budget : priorités musculaires, volume hebdo,
                  séances, records et progression.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link href="/profile" className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm hover:bg-white/15">Profil</Link>
                <Link href="/settings" className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm hover:bg-white/15">Paramètres</Link>
                <Link href="/friends" className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm hover:bg-white/15">Amis</Link>
                <Link href="/friends/requests" className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm hover:bg-white/15">Demandes</Link>
                <Link href="/social" className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm hover:bg-white/15">Social</Link>
                <Link href="/history" className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm hover:bg-white/15">Historique</Link>
                <Link href="/progression" className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm hover:bg-white/15">Progression</Link>
                {activeSession ? (
                  <Link
                    href={`/workout/${activeSession.training_day_id}`}
                    className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300 hover:bg-emerald-500/15"
                  >
                    Reprendre la séance
                  </Link>
                ) : null}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[560px]">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs text-zinc-500">Séances terminées</p>
                <p className="mt-2 text-3xl font-semibold tracking-[-0.04em]">
                  {completedSessionsEnriched.length}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs text-zinc-500">Volume ce mois</p>
                <p className="mt-2 text-3xl font-semibold tracking-[-0.04em]">
                  {formatNumber(performanceStats.monthVolume)}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs text-zinc-500">Record séance</p>
                <p className="mt-2 text-3xl font-semibold tracking-[-0.04em]">
                  {formatNumber(performanceStats.bestSessionVolume)}
                </p>
              </div>
            </div>
          </div>
        </header>

        {error ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        ) : null}

        {activeSession ? (
          <SectionCard className="border-emerald-500/20 bg-emerald-500/[0.06] p-5 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-5">
              <div>
                <p className="text-sm text-emerald-300">Séance active</p>
                <h2 className="mt-1 text-3xl font-semibold tracking-[-0.03em]">
                  {activeSession.training_days?.name || "Séance en cours"}
                </h2>
                <p className="mt-2 text-sm text-zinc-400">
                  Démarrée le {formatDate(activeSession.started_at)}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <p className="text-xs text-zinc-500">Chronomètre</p>
                  <p className="mt-1 text-3xl font-semibold tracking-[-0.04em]">
                    {activeSessionElapsed || "00:00"}
                  </p>
                </div>

                <Link
                  href={`/workout/${activeSession.training_day_id}`}
                  className="flex items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-5 py-3 text-sm text-emerald-300 hover:bg-emerald-500/15"
                >
                  Ouvrir la séance
                </Link>
              </div>
            </div>
          </SectionCard>
        ) : null}

        <SectionCard className="p-5 md:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-3xl font-semibold tracking-[-0.03em]">Records & volume</h2>
              <p className="mt-1 text-sm text-zinc-400">
                Vue d’ensemble de tes performances récentes.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {[
                { key: "month", label: "Ce mois" },
                { key: "3m", label: "3 derniers mois" },
                { key: "6m", label: "6 derniers mois" },
                { key: "year", label: "Cette année" },
              ].map((range) => (
                <button
                  key={range.key}
                  onClick={() => setChartRange(range.key)}
                  className={`rounded-xl border px-3 py-1.5 text-sm transition ${
                    chartRange === range.key
                      ? "border-white/20 bg-white/10 text-white"
                      : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/8"
                  }`}
                >
                  {range.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[22px] border border-white/10 bg-black/20 p-5">
              <p className="text-sm text-zinc-400">Volume ce mois</p>
              <p className="mt-2 text-4xl font-semibold tracking-[-0.04em]">
                {formatNumber(performanceStats.monthVolume)}
              </p>
            </div>

            <div className="rounded-[22px] border border-white/10 bg-black/20 p-5">
              <p className="text-sm text-zinc-400">Volume cette année</p>
              <p className="mt-2 text-4xl font-semibold tracking-[-0.04em]">
                {formatNumber(performanceStats.yearVolume)}
              </p>
            </div>

            <div className="rounded-[22px] border border-white/10 bg-black/20 p-5">
              <p className="text-sm text-zinc-400">Record séance volume</p>
              <p className="mt-2 text-4xl font-semibold tracking-[-0.04em]">
                {formatNumber(performanceStats.bestSessionVolume)}
              </p>
            </div>

            <div className="rounded-[22px] border border-white/10 bg-black/20 p-5">
              <p className="text-sm text-zinc-400">Record meilleure série</p>
              <p className="mt-2 text-4xl font-semibold tracking-[-0.04em]">
                {formatNumber(performanceStats.bestSetVolume)}
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-[24px] border border-white/10 bg-black/20 p-4 md:p-5">
            <div className="mb-4">
              <h3 className="text-xl font-medium">Progression volume</h3>
              <p className="mt-1 text-sm text-zinc-400">
                Volume total enregistré sur la période sélectionnée.
              </p>
            </div>
            <ProgressChart data={chartData} />
          </div>
        </SectionCard>

        <SectionCard className="p-5 md:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-3xl font-semibold tracking-[-0.03em]">Priorisation des muscles</h2>
              <p className="mt-1 text-sm text-zinc-400">
                Classe tes muscles par importance et ajuste le volume cible.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => setTopView("board")}
                className={`rounded-xl border px-3 py-1.5 text-sm transition ${
                  topView === "board"
                    ? "border-white/20 bg-white/10 text-white"
                    : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/8"
                }`}
              >
                Board
              </button>
              <button
                onClick={() => setTopView("series")}
                className={`rounded-xl border px-3 py-1.5 text-sm transition ${
                  topView === "series"
                    ? "border-white/20 bg-white/10 text-white"
                    : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/8"
                }`}
              >
                Séries
              </button>
            </div>
          </div>

          {topView === "board" ? (
            <div className="grid gap-5 lg:grid-cols-3">
              {["maintenance", "moderate", "priority"].map((key) => {
                const config = PRIORITY_CONFIG[key];
                const list = groupedMuscles[key];
                const isOver = dragOverPriority === key;

                return (
                  <div
                    key={key}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOverPriority(key);
                    }}
                    onDragLeave={() => {
                      if (dragOverPriority === key) setDragOverPriority(null);
                    }}
                    onDrop={async (e) => {
                      e.preventDefault();
                      await handlePriorityDrop(key);
                    }}
                    className={`rounded-[24px] border p-4 transition ${config.columnClass} ${
                      isOver ? "ring-2 ring-white/20" : ""
                    }`}
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <div className={`rounded-full border px-3 py-1 text-sm ${config.badgeClass}`}>
                        {config.label}
                      </div>
                      <span className="text-sm text-zinc-400">{list.length}</span>
                    </div>

                    <div className="space-y-3">
                      {list.map((muscle) => (
                        <div
                          key={muscle.id}
                          draggable
                          onDragStart={() => setDraggedMuscleId(muscle.id)}
                          onDragEnd={() => {
                            setDraggedMuscleId(null);
                            setDragOverPriority(null);
                          }}
                          className={`cursor-grab rounded-[18px] border p-4 active:cursor-grabbing ${config.cardClass}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-lg font-medium">{muscle.name}</p>
                              <p className="mt-1 text-sm text-zinc-400">{muscle.range}</p>
                              <p className="mt-2 text-xs text-zinc-500">
                                Cible actuelle : {muscle.targetSets} séries
                              </p>
                            </div>

                            <select
                              value={muscle.priority}
                              onChange={(e) => updateMusclePriority(muscle.id, e.target.value)}
                              className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none"
                            >
                              <option value="maintenance">Maintenance</option>
                              <option value="moderate">Modérée</option>
                              <option value="priority">Prioritaire</option>
                            </select>
                          </div>
                        </div>
                      ))}

                      {list.length === 0 ? (
                        <div className="rounded-[18px] border border-dashed border-white/10 p-4 text-sm text-zinc-500">
                          Aucun muscle ici.
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="overflow-hidden rounded-[24px] border border-white/10 bg-black/20">
              <div className="grid grid-cols-[1.4fr_1fr_1fr_120px] border-b border-white/10 bg-white/[0.03] px-5 py-4 text-sm text-zinc-400">
                <div>Muscle</div>
                <div>Nombre de séries</div>
                <div>Priorité</div>
                <div className="text-right">Cible</div>
              </div>

              <div className="divide-y divide-white/10">
                {musclesWithSettings.map((muscle) => {
                  const config = PRIORITY_CONFIG[muscle.priority];

                  return (
                    <div
                      key={muscle.id}
                      className="grid grid-cols-[1.4fr_1fr_1fr_120px] items-center px-5 py-4"
                    >
                      <div className="font-medium">{muscle.name}</div>
                      <div className="text-zinc-300">{config.range}</div>

                      <div>
                        <select
                          value={muscle.priority}
                          onChange={(e) => updateMusclePriority(muscle.id, e.target.value)}
                          className={`rounded-lg border px-3 py-1.5 text-sm outline-none ${config.badgeClass}`}
                        >
                          <option value="maintenance">Maintenance</option>
                          <option value="moderate">Modérée</option>
                          <option value="priority">Prioritaire</option>
                        </select>
                      </div>

                      <div className="flex justify-end">
                        <input
                          type="number"
                          min="0"
                          value={muscle.targetSets}
                          onChange={(e) => updateTargetSets(muscle.id, e.target.value)}
                          className="w-20 rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-right text-sm text-white outline-none"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </SectionCard>

        <SectionCard className="p-5 md:p-6">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-3xl font-semibold tracking-[-0.03em]">Programme</h2>
              <p className="mt-1 text-sm text-zinc-400">
                Construis tes séances, répartis tes exercices et pilote ton volume.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => setBottomView("week")}
                className={`rounded-xl border px-3 py-1.5 text-sm transition ${
                  bottomView === "week"
                    ? "border-white/20 bg-white/10 text-white"
                    : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/8"
                }`}
              >
                Semaine
              </button>

              <button
                onClick={() => setBottomView("muscles")}
                className={`rounded-xl border px-3 py-1.5 text-sm transition ${
                  bottomView === "muscles"
                    ? "border-white/20 bg-white/10 text-white"
                    : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/8"
                }`}
              >
                Muscles
              </button>

              <button
                onClick={() => setBottomView("days")}
                className={`rounded-xl border px-3 py-1.5 text-sm transition ${
                  bottomView === "days"
                    ? "border-white/20 bg-white/10 text-white"
                    : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/8"
                }`}
              >
                Séances
              </button>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <div className="rounded-[22px] border border-white/10 bg-black/20 p-5">
              <h3 className="text-lg font-medium">Créer une séance</h3>
              <p className="mt-1 text-sm text-zinc-400">
                Exemple : Upper 1, Lower 2, Push, Pull.
              </p>

              <form onSubmit={handleCreateDay} className="mt-4 flex gap-3">
                <input
                  value={newDayName}
                  onChange={(e) => setNewDayName(e.target.value)}
                  placeholder="Nom de la séance"
                  className="h-11 flex-1 rounded-2xl border border-white/10 bg-zinc-900 px-4 text-white outline-none"
                />
                <button
                  type="submit"
                  className="rounded-2xl border border-white/10 bg-white/10 px-4 text-sm hover:bg-white/15"
                >
                  Ajouter
                </button>
              </form>
            </div>

            <div className="rounded-[22px] border border-white/10 bg-black/20 p-5">
              <h3 className="text-lg font-medium">Créer un exercice personnalisé</h3>
              <p className="mt-1 text-sm text-zinc-400">
                Ajoute un mouvement absent de la bibliothèque.
              </p>

              <form onSubmit={handleCreateCustomExercise} className="mt-4 space-y-3">
                <select
                  value={customMuscleId}
                  onChange={(e) => setCustomMuscleId(e.target.value)}
                  className="h-11 w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 text-white outline-none"
                >
                  <option value="">Choisir un muscle</option>
                  {muscles.map((muscle) => (
                    <option key={muscle.id} value={muscle.id}>
                      {muscle.name}
                    </option>
                  ))}
                </select>

                <input
                  value={customExerciseName}
                  onChange={(e) => setCustomExerciseName(e.target.value)}
                  placeholder="Nom de l'exercice"
                  className="h-11 w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 text-white outline-none"
                />

                <button
                  type="submit"
                  className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm hover:bg-white/15"
                >
                  Créer
                </button>
              </form>
            </div>

            <div className="rounded-[22px] border border-white/10 bg-black/20 p-5">
              <h3 className="text-lg font-medium">Ajouter un exercice au programme</h3>
              <p className="mt-1 text-sm text-zinc-400">
                Affecte un exercice à une séance existante.
              </p>

              <form onSubmit={handleAddProgramExercise} className="mt-4 space-y-3">
                <select
                  value={addMuscleId}
                  onChange={(e) => {
                    setAddMuscleId(e.target.value);
                    setAddTemplateId("");
                  }}
                  className="h-11 w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 text-white outline-none"
                >
                  <option value="">Choisir un muscle</option>
                  {muscles.map((muscle) => (
                    <option key={muscle.id} value={muscle.id}>
                      {muscle.name}
                    </option>
                  ))}
                </select>

                <select
                  value={addTemplateId}
                  onChange={(e) => setAddTemplateId(e.target.value)}
                  className="h-11 w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 text-white outline-none"
                >
                  <option value="">Choisir un exercice</option>
                  {selectedAddTemplates.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>

                <select
                  value={addDayId}
                  onChange={(e) => setAddDayId(e.target.value)}
                  className="h-11 w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 text-white outline-none"
                >
                  <option value="">Choisir une séance</option>
                  {trainingDays.map((day) => (
                    <option key={day.id} value={day.id}>
                      {day.name}
                    </option>
                  ))}
                </select>

                <button
                  type="submit"
                  className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm hover:bg-white/15"
                >
                  Ajouter
                </button>
              </form>
            </div>
          </div>

          {customTemplates.length > 0 ? (
            <div className="mt-5 rounded-[24px] border border-white/10 bg-black/20 p-5">
              <h3 className="text-lg font-medium">Exercices personnalisés</h3>
              <p className="mt-1 text-sm text-zinc-400">
                Renomme ou supprime tes exercices custom.
              </p>

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {customTemplates.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4"
                  >
                    {editingTemplateId === item.id ? (
                      <div className="space-y-3">
                        <input
                          value={editingTemplateName}
                          onChange={(e) => setEditingTemplateName(e.target.value)}
                          className="h-10 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-white outline-none"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => saveCustomTemplateName(item.id)}
                            className="rounded-xl border border-white/10 bg-white/10 px-3 py-1.5 text-sm"
                          >
                            Sauver
                          </button>
                          <button
                            onClick={() => {
                              setEditingTemplateId(null);
                              setEditingTemplateName("");
                            }}
                            className="rounded-xl border border-white/10 px-3 py-1.5 text-sm text-zinc-400"
                          >
                            Annuler
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="font-medium">{item.name}</p>
                        <p className="mt-1 text-xs text-zinc-400">{item.muscles?.name}</p>
                        <div className="mt-4 flex gap-2">
                          <button
                            onClick={() => {
                              setEditingTemplateId(item.id);
                              setEditingTemplateName(item.name);
                            }}
                            className="rounded-xl border border-white/10 bg-white/10 px-3 py-1.5 text-sm"
                          >
                            Renommer
                          </button>
                          <button
                            onClick={() => deleteCustomTemplate(item.id)}
                            className="rounded-xl border border-white/10 bg-red-500/10 px-3 py-1.5 text-sm text-red-300"
                          >
                            Suppr.
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {bottomView === "week" ? (
            <div className="mt-5 space-y-5">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-[22px] border border-white/10 bg-black/20 p-5">
                  <p className="text-sm text-zinc-400">Séries semaine</p>
                  <p className="mt-2 text-4xl font-semibold tracking-[-0.04em]">
                    {weekSummary.totalSets}
                  </p>
                </div>

                <div className="rounded-[22px] border border-white/10 bg-black/20 p-5">
                  <p className="text-sm text-zinc-400">Exercices programmés</p>
                  <p className="mt-2 text-4xl font-semibold tracking-[-0.04em]">
                    {weekSummary.totalExercises}
                  </p>
                </div>

                <div className="rounded-[22px] border border-white/10 bg-black/20 p-5">
                  <p className="text-sm text-zinc-400">Muscles couverts</p>
                  <p className="mt-2 text-4xl font-semibold tracking-[-0.04em]">
                    {weekSummary.trainedMuscles}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                {dayBoards.map((day) => (
                  <div key={day.id} className={`rounded-[24px] border p-5 ${day.colorClass}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="rounded-full bg-white/10 px-3 py-1 text-sm">
                          {day.name}
                        </div>
                        <p className="mt-3 text-3xl font-semibold tracking-[-0.04em]">
                          {day.totalSets}
                        </p>
                        <p className="mt-1 text-sm text-zinc-400">séries au total</p>
                      </div>

                      <button
                        onClick={() => deleteTrainingDay(day.id)}
                        className="rounded-lg border border-white/10 bg-red-500/10 px-2.5 py-1 text-xs text-red-300 hover:bg-red-500/20"
                      >
                        Suppr.
                      </button>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {day.muscles.map((name) => (
                        <span
                          key={name}
                          className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-zinc-300"
                        >
                          {name}
                        </span>
                      ))}
                      {day.muscles.length === 0 ? (
                        <span className="text-sm text-zinc-500">Aucun muscle</span>
                      ) : null}
                    </div>

                    <div className="mt-5 space-y-2">
                      {day.items.slice(0, 6).map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-3 py-2"
                        >
                          <div>
                            <p className="text-sm font-medium">{item.exercise_templates?.name}</p>
                            <p className="text-xs text-zinc-400">
                              {item.exercise_templates?.muscles?.name}
                            </p>
                          </div>

                          <span className="text-xs text-zinc-300">{item.set_count} séries</span>
                        </div>
                      ))}

                      {day.items.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-white/10 px-3 py-4 text-sm text-zinc-500">
                          Aucun exercice dans cette séance.
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {bottomView === "muscles" ? (
            <div className="mt-5 overflow-x-auto">
              <div className="flex gap-4 pb-2">
                {muscleBoards.map((muscle) => {
                  const priority = getPriorityFromSets(muscle.targetSets);

                  return (
                    <div
                      key={muscle.id}
                      className={`min-w-[285px] rounded-[24px] border p-4 ${muscle.colorClass}`}
                    >
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div className="rounded-full bg-white/10 px-3 py-1 text-sm">
                          {muscle.name}
                        </div>

                        <div className="text-right">
                          <p className="text-sm text-zinc-300">
                            {muscle.currentSets}/{muscle.targetSets}
                          </p>
                          <p
                            className={`text-[11px] ${
                              muscle.diff === 0
                                ? "text-emerald-400"
                                : muscle.diff > 0
                                ? "text-amber-400"
                                : "text-rose-400"
                            }`}
                          >
                            {muscle.diff === 0
                              ? "objectif atteint"
                              : muscle.diff > 0
                              ? `+${muscle.diff}`
                              : `${muscle.diff}`}
                          </p>
                        </div>
                      </div>

                      <div className="mb-4">
                        <span
                          className={`rounded-full border px-2.5 py-1 text-xs ${PRIORITY_CONFIG[priority].badgeClass}`}
                        >
                          {PRIORITY_CONFIG[priority].label}
                        </span>
                      </div>

                      <div className="space-y-3">
                        {muscle.items.map((item) => (
                          <div
                            key={item.id}
                            className="rounded-[18px] border border-white/10 bg-black/20 p-3"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="font-medium">{item.exercise_templates?.name}</p>
                                <p className="mt-1 text-xs text-zinc-400">
                                  {item.training_days?.name}
                                </p>
                              </div>

                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  min="0"
                                  value={item.set_count}
                                  onChange={(e) =>
                                    updateProgramExerciseSets(item.id, e.target.value)
                                  }
                                  className="w-16 rounded-lg border border-white/10 bg-zinc-900 px-2 py-1 text-sm text-white outline-none"
                                />

                                <button
                                  onClick={() => deleteProgramExercise(item.id)}
                                  className="rounded-lg border border-white/10 bg-red-500/10 px-2 py-1 text-xs text-red-300 hover:bg-red-500/20"
                                >
                                  Suppr.
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}

                        {muscle.items.length === 0 ? (
                          <div className="rounded-[18px] border border-dashed border-white/10 p-4 text-sm text-zinc-500">
                            Aucun exercice attribué.
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {bottomView === "days" ? (
            <div className="mt-5 overflow-x-auto">
              <div className="flex gap-4 pb-2">
                {dayBoards.map((day) => {
                  const isOver = dragOverDayId === day.id;

                  return (
                    <div
                      key={day.id}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOverDayId(day.id);
                      }}
                      onDragLeave={() => {
                        if (dragOverDayId === day.id) setDragOverDayId(null);
                      }}
                      onDrop={async (e) => {
                        e.preventDefault();
                        await moveExerciseToDayOrPosition(day.id);
                      }}
                      className={`min-w-[320px] rounded-[24px] border p-4 transition ${day.colorClass} ${
                        isOver ? "ring-2 ring-white/20" : ""
                      }`}
                    >
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                          {editingDayId === day.id ? (
                            <div className="flex items-center gap-2">
                              <input
                                value={editingDayName}
                                onChange={(e) => setEditingDayName(e.target.value)}
                                className="h-9 rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none"
                              />
                              <button
                                onClick={() => saveTrainingDayName(day.id)}
                                className="rounded-lg border border-white/10 bg-white/10 px-2 py-1 text-xs"
                              >
                                OK
                              </button>
                              <button
                                onClick={() => {
                                  setEditingDayId(null);
                                  setEditingDayName("");
                                }}
                                className="rounded-lg border border-white/10 px-2 py-1 text-xs text-zinc-400"
                              >
                                X
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="rounded-full bg-white/10 px-3 py-1 text-sm">
                                {day.name}
                              </div>

                              <button
                                onClick={() => {
                                  setEditingDayId(day.id);
                                  setEditingDayName(day.name);
                                }}
                                className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-zinc-300"
                              >
                                Renommer
                              </button>

                              <Link
                                href={`/workout/${day.id}`}
                                className="rounded-lg border border-white/10 bg-white/10 px-2 py-1 text-xs text-white hover:bg-white/15"
                              >
                                Lancer
                              </Link>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-sm text-zinc-300">{day.totalSets}</span>
                          <button
                            onClick={() => deleteTrainingDay(day.id)}
                            className="rounded-lg border border-white/10 bg-red-500/10 px-2 py-1 text-xs text-red-300 hover:bg-red-500/20"
                          >
                            Suppr.
                          </button>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {day.items.map((item) => (
                          <div
                            key={item.id}
                            draggable
                            onDragStart={() => setDraggedExerciseId(item.id)}
                            onDragEnd={() => {
                              setDraggedExerciseId(null);
                              setDragOverDayId(null);
                              setDragOverExerciseId(null);
                            }}
                            onDragOver={(e) => {
                              e.preventDefault();
                              setDragOverDayId(day.id);
                              setDragOverExerciseId(item.id);
                            }}
                            onDrop={async (e) => {
                              e.preventDefault();
                              await moveExerciseToDayOrPosition(day.id, item.id);
                            }}
                            className={`cursor-grab rounded-[18px] border p-3 active:cursor-grabbing ${
                              dragOverExerciseId === item.id
                                ? "border-white/30 bg-white/10"
                                : "border-white/10 bg-black/20"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="font-medium">{item.exercise_templates?.name}</p>
                                <p className="mt-1 text-xs text-zinc-400">
                                  {item.exercise_templates?.muscles?.name}
                                </p>
                              </div>

                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  min="0"
                                  value={item.set_count}
                                  onChange={(e) =>
                                    updateProgramExerciseSets(item.id, e.target.value)
                                  }
                                  className="w-16 rounded-lg border border-white/10 bg-zinc-900 px-2 py-1 text-sm text-white outline-none"
                                />

                                <button
                                  onClick={() => deleteProgramExercise(item.id)}
                                  className="rounded-lg border border-white/10 bg-red-500/10 px-2 py-1 text-xs text-red-300 hover:bg-red-500/20"
                                >
                                  Suppr.
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}

                        {day.items.length === 0 ? (
                          <div className="rounded-[18px] border border-dashed border-white/10 p-4 text-sm text-zinc-500">
                            Dépose un exercice ici.
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </SectionCard>
      </div>
    </main>
  );
}