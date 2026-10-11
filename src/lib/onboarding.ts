import { z } from "zod";
import type { WeeklyPace } from "./nutrition";

export const onboardingProfileSchema = z.object({
  name: z.string().max(100), dob: z.string(), gender: z.string(), height: z.string(), weight: z.string(),
  heightUnit: z.enum(["cm", "ft"]), weightUnit: z.enum(["kg", "lbs"]),
  goalType: z.string(), weeklyPace: z.union([z.literal(-1), z.literal(-0.5), z.literal(-0.25), z.literal(0), z.literal(0.25), z.literal(0.5), z.literal(1)]),
  nutritionPreference: z.enum(["balanced", "high-protein", "low-carb", "high-carb", "higher-fat"]),
  experienceLevel: z.string(), daysPerWeek: z.number().int().min(1).max(7), workoutDuration: z.number().int().min(15).max(60),
  dietaryPrefs: z.array(z.string()), equipmentAccess: z.array(z.string()),
});
export type OnboardingProfile = z.infer<typeof onboardingProfileSchema>;
const draftSchema = z.object({ version: z.literal(1), step: z.number().int().min(0).max(7), profile: onboardingProfileSchema });
export const onboardingDraftKey = (uid: string) => `fitx:onboarding:${uid}`;

export function defaultOnboardingProfile(name = ""): OnboardingProfile {
  return {
    name: name.slice(0, 100), dob: "", gender: "", height: "", weight: "", heightUnit: "cm", weightUnit: "kg", goalType: "",
    weeklyPace: 0 as WeeklyPace, nutritionPreference: "balanced", experienceLevel: "", daysPerWeek: 3, workoutDuration: 30,
    dietaryPrefs: [], equipmentAccess: [],
  };
}

/** Preserve the typed text; normalise only when calculating or saving. */
export function parseMeasurement(value: string | number): number | null {
  const text = String(value).trim();
  if (!/^(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(text)) return null;
  const parsed = Number(text.replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function profileAge(dob: string, today = new Date()): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return null;
  const [year, month, day] = dob.split("-").map(Number);
  const birth = new Date(year, month - 1, day);
  if (birth.getFullYear() !== year || birth.getMonth() !== month - 1 || birth.getDate() !== day || birth > today) return null;
  let age = today.getFullYear() - year;
  if (today.getMonth() < month - 1 || (today.getMonth() === month - 1 && today.getDate() < day)) age--;
  return age;
}

export function basicProfileErrors(profile: OnboardingProfile) {
  const errors: Partial<Record<"name" | "dob" | "gender" | "height" | "weight", string>> = {};
  if (!profile.name.trim()) errors.name = "Enter your name.";
  const age = profileAge(profile.dob);
  if (age === null || age < 16) errors.dob = "Enter a valid date of birth. You must be at least 16.";
  if (!["Male", "Female", "Other"].includes(profile.gender)) errors.gender = "Choose a gender.";
  const height = parseMeasurement(profile.height), weight = parseMeasurement(profile.weight);
  const cm = height === null ? null : height * (profile.heightUnit === "ft" ? 30.48 : 1);
  const kg = weight === null ? null : weight * (profile.weightUnit === "lbs" ? 0.453592 : 1);
  if (cm === null || cm < 60 || cm > 300) errors.height = profile.heightUnit === "ft"
    ? "Enter height in feet (for example 5.56), or switch to cm."
    : "Enter a height between 60 and 300 cm. Decimals can use a dot or comma.";
  if (kg === null || kg < 20 || kg > 650) errors.weight = profile.weightUnit === "lbs"
    ? "Enter weight in pounds, or switch to kg."
    : "Enter a weight between 20 and 650 kg. Decimals can use a dot or comma.";
  return errors;
}

export function firstIncompleteStep(profile: OnboardingProfile): number | null {
  if (Object.keys(basicProfileErrors(profile)).length) return 1;
  if (!["muscle", "lose", "flex", "endurance", "maintain", "general"].includes(profile.goalType)) return 2;
  if (!["Beginner", "Intermediate", "Advanced"].includes(profile.experienceLevel)) return 4;
  return null;
}

export function readOnboardingDraft(uid: string, name = "") {
  const fallback = { step: 0, profile: defaultOnboardingProfile(name) };
  try {
    const saved = sessionStorage.getItem(onboardingDraftKey(uid));
    if (!saved) return fallback;
    const result = draftSchema.safeParse(JSON.parse(saved));
    if (!result.success) return fallback;
    const incomplete = firstIncompleteStep(result.data.profile);
    return { profile: result.data.profile, step: incomplete === null ? result.data.step : Math.min(result.data.step, incomplete) };
  } catch { return fallback; }
}

export function onboardingSaveError(error: unknown): string {
  const code = (error as { code?: string })?.code;
  if (code === "permission-denied") return "Your profile could not be saved because access was denied. Ask the app administrator to check your account and Firebase permissions, then retry. Your answers are still here.";
  if (code === "unauthenticated") return "Your sign-in session expired. Sign in again with the same account to continue setup.";
  return "We couldn't save your profile. Check your connection and try again. Your answers are still here.";
}
