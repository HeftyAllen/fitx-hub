// Calorie + macro targets derived from onboarding answers.
// Mifflin–St Jeor + activity multiplier + goal-specific calorie delta.

export interface ProfileLike {
  gender?: string;
  dob?: string;
  height?: string | number;
  heightUnit?: "cm" | "ft";
  weight?: string | number;
  weightUnit?: "kg" | "lbs";
  daysPerWeek?: number;
  goalType?: string;
}

export interface NutritionTargets {
  bmr: number;
  tdee: number;
  calorieTarget: number;
  protein: number; // g
  carbs: number;   // g
  fat: number;     // g
  fiber: number;   // g
}

function toKg(weight: number, unit?: string) {
  return unit === "lbs" ? weight * 0.453592 : weight;
}

function toCm(height: number, unit?: string) {
  // ft input may be like 5.9 (5'9") or just inches — keep simple: treat as feet (decimal)
  return unit === "ft" ? height * 30.48 : height;
}

function age(dob?: string) {
  if (!dob) return 30;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return 30;
  const diff = Date.now() - d.getTime();
  return Math.max(14, Math.floor(diff / (365.25 * 24 * 3600 * 1000)));
}

function activityFactor(daysPerWeek = 3) {
  if (daysPerWeek <= 2) return 1.375;
  if (daysPerWeek <= 4) return 1.55;
  if (daysPerWeek <= 6) return 1.725;
  return 1.9;
}

function goalDelta(goal?: string) {
  switch (goal) {
    case "lose":      return -500;
    case "muscle":    return  300;
    case "endurance": return  200;
    default:          return    0; // maintain, general, flex
  }
}

function proteinPerKg(goal?: string) {
  if (goal === "muscle") return 2.2;
  if (goal === "lose")   return 2.0;
  return 1.8;
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
  const calorieTarget = Math.max(1200, Math.round((tdee + goalDelta(p.goalType)) / 10) * 10);

  const protein = Math.round(w * proteinPerKg(p.goalType));
  const fat     = Math.round((calorieTarget * 0.25) / 9);
  const carbs   = Math.max(50, Math.round((calorieTarget - protein * 4 - fat * 9) / 4));
  const fiber   = Math.round(calorieTarget / 100); // ~14g per 1000 cal, rounded simple

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
