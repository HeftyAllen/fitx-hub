// Suggestions engine — builds a ranked list of insight cards for the Dashboard.
// Pure functions on top of already-fetched data so the Dashboard stays the
// single source of truth for queries.

import { computeTargets } from "@/lib/nutrition";
import { getQuoteOfDay, type Quote } from "@/lib/quotes";

export type SuggestionKind =
  | "motivation"
  | "burn-prediction"
  | "nutrition-tip"
  | "recovery-alert"
  | "calorie-compliance"
  | "performance"
  | "plateau";

export interface Suggestion {
  id: string;
  kind: SuggestionKind;
  priority: number; // higher = surface first (except motivation, always pinned)
  title: string;
  body: string;
  icon?: string;
  accent?: string; // tailwind text color, optional
  meta?: Record<string, unknown>;
}

export interface SuggestionInput {
  uid: string | null;
  profile: any | null;
  todayPlan: any | null;            // workout plan object for today (optional)
  workoutLogs: any[];               // recent workout logs
  todayCalories: number;            // calories logged today
  weightHistory: { dateISO: string; weightKg: number }[]; // chronological
}

const HOUR = new Date().getHours();

/* ───────── helpers ───────── */

function bodyweightKg(profile: any): number {
  if (!profile) return 75;
  const w = Number(profile.weight) || 75;
  return profile.weightUnit === "lbs" ? w * 0.453592 : w;
}

function isoDay(d: Date): string { return d.toISOString().slice(0, 10); }

function consecutiveTrainingDays(logs: any[]): number {
  if (!logs?.length) return 0;
  const dates = new Set(
    logs.map(l => {
      const d = l.date?.toDate ? l.date.toDate() : new Date((l.date?.seconds || 0) * 1000);
      return isoDay(d);
    }),
  );
  let streak = 0;
  const cursor = new Date();
  while (dates.has(isoDay(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/* ───────── individual generators ───────── */

function motivationSuggestion(uid: string | null, profile: any): Suggestion {
  const quote: Quote = getQuoteOfDay(uid, isoDay(new Date()), profile?.goalType);
  return {
    id: "motivation",
    kind: "motivation",
    priority: 1000,
    title: "Today's Motivation",
    body: quote.author ? `"${quote.text}" — ${quote.author}` : `"${quote.text}"`,
    icon: "✨",
    accent: "text-amber-400",
  };
}

// MET-based: METs ≈ 5 for moderate resistance training, 8 for vigorous.
// duration estimated from exercise count × (sets ?? 3) × 1 min when missing.
function burnPrediction(profile: any, plan: any): Suggestion | null {
  if (!plan?.exercises?.length) return null;
  const bw = bodyweightKg(profile);
  const exercises = plan.exercises as any[];
  const totalMinutes = exercises.reduce((acc, ex) => {
    const sets = Number(ex.sets) || 3;
    const reps = Number(ex.reps) || 10;
    const restSec = Number(ex.rest) || 60;
    const workSec = Math.max(20, reps * 3);
    return acc + (sets * (workSec + restSec)) / 60;
  }, 0);
  const minutes = Math.max(15, Math.round(totalMinutes));
  const intensity = exercises.length >= 8 ? "vigorous" : exercises.length >= 5 ? "moderate" : "light";
  const met = intensity === "vigorous" ? 8 : intensity === "moderate" ? 5.5 : 4;
  const kcal = Math.round((met * 3.5 * bw / 200) * minutes);
  return {
    id: "burn-prediction",
    kind: "burn-prediction",
    priority: 800,
    title: "Today's Predicted Burn",
    body: `${plan.name || "Today's plan"} should burn ≈ ${kcal} kcal over ~${minutes} min (${intensity} intensity).`,
    icon: "🔥",
    accent: "text-orange-400",
    meta: { kcal, minutes, intensity },
  };
}

function nutritionTip(profile: any, todayPlan: any): Suggestion | null {
  if (!profile?.goalType) return null;
  let title = "Nutrition Tip";
  let body = "Balanced meals: protein at every meal, plenty of vegetables, smart carbs.";
  switch (profile.goalType) {
    case "muscle":
      title = "Fuel the Gain";
      body = todayPlan
        ? "Training today — front-load 30–40 g protein around your workout and add carbs pre + post to refill glycogen."
        : "Spread protein evenly across the day (4 meals of 30–40 g). Don't be afraid of carbs.";
      break;
    case "lose":
      title = "Stay Lean, Stay Strong";
      body = "Keep protein high (~2 g/kg) to preserve muscle in your deficit. Prioritise volume — veggies, fruit, lean protein.";
      break;
    case "endurance":
      title = "Refill the Tank";
      body = "Carbs are not the enemy here. Aim for 5–7 g/kg/day on training days and don't skimp pre-session.";
      break;
    case "maintain":
      title = "Maintain & Polish";
      body = "Anchor each meal with protein, two fists of veg, and one fist of carbs. Repeat.";
      break;
  }
  return { id: "nutrition-tip", kind: "nutrition-tip", priority: 500, title, body, icon: "🥗", accent: "text-emerald-400" };
}

function recoveryAlert(logs: any[]): Suggestion | null {
  const streak = consecutiveTrainingDays(logs);
  if (streak < 6) return null;
  return {
    id: "recovery-alert",
    kind: "recovery-alert",
    priority: 900,
    title: "Take a Recovery Day",
    body: `You've trained ${streak} days in a row. A planned rest day now prevents a forced one later.`,
    icon: "🧘",
    accent: "text-cyan-400",
    meta: { streak },
  };
}

function calorieCompliance(profile: any, consumed: number): Suggestion | null {
  if (!profile) return null;
  const targets = computeTargets(profile);
  const goal = targets.calorieTarget;
  const remaining = goal - consumed;
  const lateAfternoon = HOUR >= 18;
  if (lateAfternoon && remaining > 300) {
    return {
      id: "calorie-compliance",
      kind: "calorie-compliance",
      priority: 700,
      title: "You're Under Target",
      body: `You're ~${remaining} kcal below your ${goal} goal. Consider a balanced dinner or snack before bed — undereating slows recovery.`,
      icon: "🍽️",
      accent: "text-yellow-400",
    };
  }
  if (consumed > goal + 250) {
    return {
      id: "calorie-compliance",
      kind: "calorie-compliance",
      priority: 600,
      title: "Over Target Today",
      body: `You're ~${Math.round(consumed - goal)} kcal over. One day won't derail anything — just steer tomorrow back on track.`,
      icon: "📊",
      accent: "text-amber-400",
    };
  }
  return null;
}

function performanceInsight(logs: any[]): Suggestion | null {
  if (logs.length < 4) return null;
  const sorted = [...logs].sort((a, b) => {
    const ad = a.date?.toDate?.()?.getTime?.() ?? (a.date?.seconds || 0) * 1000;
    const bd = b.date?.toDate?.()?.getTime?.() ?? (b.date?.seconds || 0) * 1000;
    return ad - bd;
  });
  const half = Math.floor(sorted.length / 2);
  const earlier = sorted.slice(0, half).reduce((s, l) => s + (l.totalVolume || 0), 0) / Math.max(1, half);
  const later   = sorted.slice(half).reduce((s, l) => s + (l.totalVolume || 0), 0) / Math.max(1, sorted.length - half);
  if (later > earlier * 1.1) {
    return {
      id: "performance",
      kind: "performance",
      priority: 400,
      title: "Strength Trending Up",
      body: `Your training volume is up ~${Math.round(((later - earlier) / earlier) * 100)}% vs. earlier sessions. Keep stacking weeks.`,
      icon: "📈",
      accent: "text-green-400",
    };
  }
  return null;
}

function plateauDetection(profile: any, history: SuggestionInput["weightHistory"]): Suggestion | null {
  if (!profile?.goalType || history.length < 4) return null;
  const cutoff = Date.now() - 21 * 24 * 3600 * 1000;
  const window = history.filter(h => new Date(h.dateISO).getTime() >= cutoff);
  if (window.length < 3) return null;
  const first = window[0].weightKg;
  const last = window[window.length - 1].weightKg;
  const delta = last - first;
  if (profile.goalType === "lose" && delta > -0.3) {
    return {
      id: "plateau",
      kind: "plateau",
      priority: 750,
      title: "Weight-Loss Plateau",
      body: "Your weight has barely moved in 3+ weeks. Try a small calorie reduction (~150 kcal) or add one cardio session.",
      icon: "📉",
      accent: "text-rose-400",
    };
  }
  if (profile.goalType === "muscle" && delta < 0.2) {
    return {
      id: "plateau",
      kind: "plateau",
      priority: 750,
      title: "Muscle-Gain Stall",
      body: "Body weight is flat over 3+ weeks. Bump intake by ~150–200 kcal/day and prioritise sleep.",
      icon: "💪",
      accent: "text-violet-400",
    };
  }
  return null;
}

/* ───────── orchestrator ───────── */

export function buildSuggestions(input: SuggestionInput): Suggestion[] {
  const out: Suggestion[] = [];
  out.push(motivationSuggestion(input.uid, input.profile));

  const candidates = [
    burnPrediction(input.profile, input.todayPlan),
    nutritionTip(input.profile, input.todayPlan),
    recoveryAlert(input.workoutLogs),
    calorieCompliance(input.profile, input.todayCalories),
    performanceInsight(input.workoutLogs),
    plateauDetection(input.profile, input.weightHistory),
  ].filter(Boolean) as Suggestion[];

  candidates.sort((a, b) => b.priority - a.priority);
  return [out[0], ...candidates.slice(0, 3)];
}
