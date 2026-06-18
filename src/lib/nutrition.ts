// Calorie + macro targets derived from onboarding answers.
// Mifflin–St Jeor + activity multiplier + weeklyPace-driven calorie delta.
//
// 1 kg of body weight ≈ 7700 kcal, so a pace of ±1 kg/week ≈ ±1100 kcal/day.
// We cap the deficit so the target never drops below safe MIN_CALORIES.

export type WeeklyPace = -1 | -0.5 | -0.25 | 0 | 0.25 | 0.5 | 1; // kg/week
export type NutritionPreference =
  | "balanced"
  | "high-protein"
  | "low-carb"
  | "high-carb"
  | "higher-fat"
  | "custom";

export interface CustomMacroSplit {
  proteinPct: number; // 0–100
  carbPct: number;
  fatPct: number;
}

export interface MealSplit {
  breakfast: number;
  lunch: number;
  dinner: number;
  snacks: number;
}

export const DEFAULT_MEAL_SPLIT: MealSplit = { breakfast: 0.25, lunch: 0.3, dinner: 0.3, snacks: 0.15 };

export interface ProfileLike {
  gender?: string;
  dob?: string;
  height?: string | number;
  heightUnit?: "cm" | "ft";
  weight?: string | number;
  weightUnit?: "kg" | "lbs";
  daysPerWeek?: number;
  goalType?: string;
  weeklyPace?: WeeklyPace;
  nutritionPreference?: NutritionPreference;
  customMacroSplit?: CustomMacroSplit;
  mealSplit?: MealSplit;
}

export interface NutritionTargets {
  bmr: number;
  tdee: number;
  calorieTarget: number;
  protein: number; // g
  carbs: number;
  fat: number;
  fiber: number;
}

const KCAL_PER_KG = 7700;
const MIN_CALORIES = 1200;

function toKg(weight: number, unit?: string) {
  return unit === "lbs" ? weight * 0.453592 : weight;
}
function toCm(height: number, unit?: string) {
  return unit === "ft" ? height * 30.48 : height;
}
function age(dob?: string) {
  if (!dob) return 30;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return 30;
  return Math.max(14, Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000)));
}
function activityFactor(daysPerWeek = 3) {
  if (daysPerWeek <= 2) return 1.375;
  if (daysPerWeek <= 4) return 1.55;
  if (daysPerWeek <= 6) return 1.725;
  return 1.9;
}

// Resolve the effective weekly pace: prefer explicit weeklyPace,
// fall back to a sensible default per goalType so older profiles keep working.
function effectivePace(p: ProfileLike): WeeklyPace {
  if (typeof p.weeklyPace === "number") return p.weeklyPace;
  switch (p.goalType) {
    case "lose":      return -0.5;
    case "muscle":    return 0.25;
    case "endurance": return 0; // performance-focused, maintain
    case "maintain":  return 0;
    default:          return 0;
  }
}

function macroSplitFor(pref: NutritionPreference, custom?: CustomMacroSplit): CustomMacroSplit {
  switch (pref) {
    case "high-protein": return { proteinPct: 40, carbPct: 35, fatPct: 25 };
    case "low-carb":     return { proteinPct: 35, carbPct: 20, fatPct: 45 };
    case "high-carb":    return { proteinPct: 25, carbPct: 55, fatPct: 20 };
    case "higher-fat":   return { proteinPct: 25, carbPct: 30, fatPct: 45 };
    case "custom":
      return custom && custom.proteinPct + custom.carbPct + custom.fatPct === 100
        ? custom
        : { proteinPct: 30, carbPct: 40, fatPct: 30 };
    case "balanced":
    default:             return { proteinPct: 30, carbPct: 40, fatPct: 30 };
  }
}

export function computeTargets(p: ProfileLike): NutritionTargets {
  const w = toKg(Number(p.weight) || 70, p.weightUnit);
  const h = toCm(Number(p.height) || 170, p.heightUnit);
  const a = age(p.dob);
  const isFemale = (p.gender || "").toLowerCase().startsWith("f");

  const bmr = isFemale
    ? 10 * w + 6.25 * h - 5 * a - 161
    : 10 * w + 6.25 * h - 5 * a + 5;

  const tdee = bmr * activityFactor(p.daysPerWeek);
  const pace = effectivePace(p);
  const dailyDelta = (pace * KCAL_PER_KG) / 7;
  const calorieTarget = Math.max(MIN_CALORIES, Math.round((tdee + dailyDelta) / 10) * 10);

  const split = macroSplitFor(p.nutritionPreference || "balanced", p.customMacroSplit);
  const protein = Math.round((calorieTarget * (split.proteinPct / 100)) / 4);
  const carbs   = Math.round((calorieTarget * (split.carbPct / 100)) / 4);
  const fat     = Math.round((calorieTarget * (split.fatPct / 100)) / 9);
  const fiber   = Math.round(calorieTarget / 100);

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    calorieTarget,
    protein,
    carbs,
    fat,
    fiber,
  };
}

// Distribute the daily calorie target across meal buckets.
export function distributeMealTargets(calorieTarget: number, split: MealSplit = DEFAULT_MEAL_SPLIT) {
  return {
    breakfast: Math.round(calorieTarget * split.breakfast),
    lunch:     Math.round(calorieTarget * split.lunch),
    dinner:    Math.round(calorieTarget * split.dinner),
    snacks:    Math.round(calorieTarget * split.snacks),
  };
}

export const PACE_OPTIONS: { value: WeeklyPace; label: string; goalKind: "lose" | "gain" | "maintain" }[] = [
  { value: -1,    label: "Lose 1 kg / week",    goalKind: "lose" },
  { value: -0.5,  label: "Lose 0.5 kg / week",  goalKind: "lose" },
  { value: -0.25, label: "Lose 0.25 kg / week", goalKind: "lose" },
  { value: 0,     label: "Maintain weight",     goalKind: "maintain" },
  { value: 0.25,  label: "Gain 0.25 kg / week", goalKind: "gain" },
  { value: 0.5,   label: "Gain 0.5 kg / week",  goalKind: "gain" },
  { value: 1,     label: "Gain 1 kg / week",    goalKind: "gain" },
];
