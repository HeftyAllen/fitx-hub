import { z } from "zod";
import { safeExternalUrl } from "./site-settings";

export const FEATURES = [
  { id: "training", label: "Training", description: "Workout plans, active sessions and exercise library", paths: ["/workout-planner", "/workout-session", "/exercise-library"] },
  { id: "nutrition", label: "Nutrition", description: "Food diary, water and daily nutrition targets", paths: ["/nutrition"] },
  { id: "recipes", label: "Recipes", description: "Recipe search and saved recipes", parent: "nutrition", paths: ["/recipes"] },
  { id: "mealPlanner", label: "Meal planner", description: "Meal plans and calendar meal entries", parent: "nutrition", paths: ["/meal-planner"] },
  { id: "barcode", label: "Barcode scanner", description: "Food lookup by barcode inside Nutrition", parent: "nutrition", paths: [] },
  { id: "grocery", label: "Grocery list", description: "Shopping lists and meal-plan ingredients", parent: "nutrition", paths: ["/grocery", "/grocery-list"] },
  { id: "progress", label: "Progress", description: "Weight, measurements and progress photos", paths: ["/progress"] },
  { id: "records", label: "Personal records", description: "Achievements and training challenges", paths: ["/records"] },
  { id: "calendar", label: "Calendar", description: "Workout scheduling and personal events", paths: ["/calendar"] },
  { id: "rewards", label: "Rewards", description: "Badges and member rewards", paths: ["/rewards"] },
  { id: "library", label: "Coach library", description: "Published workouts and meal plans", paths: ["/library"] },
] as const;
export type FeatureId = typeof FEATURES[number]["id"];
export type PlanId = "free" | "plus" | "pro";
export type FeatureMode = "free" | "premium" | "disabled";
export interface FeaturePolicy { mode: FeatureMode; requiredPlan: "plus" | "pro"; label: string; message: string }
const policySchema = z.object({
  mode: z.enum(["free", "premium", "disabled"]).default("free"),
  requiredPlan: z.enum(["plus", "pro"]).default("plus"),
  label: z.string().max(60).default(""), message: z.string().max(300).default(""),
});
const membershipSchema = z.object({
  plusName: z.string().trim().min(1).max(40).catch("Plus").default("Plus"),
  proName: z.string().trim().min(1).max(40).catch("Pro").default("Pro"),
  plusPrice: z.string().trim().min(1).max(50).catch("R79 / month").default("R79 / month"),
  proPrice: z.string().trim().min(1).max(50).catch("R149 / month").default("R149 / month"),
  showFuturePlans: z.boolean().catch(true).default(true),
  plusRoadmap: z.string().max(800).catch("").default("Advanced weekly progress insights\nAdaptive training recommendations\nDownloadable progress summaries"),
  proRoadmap: z.string().max(800).catch("").default("Everything planned for Plus\nCoach-guided programmes and check-ins\nDeeper performance and nutrition reports"),
  paywallTitle: z.string().max(120).catch("Your journey. More possibilities.").default("Your journey. More possibilities."),
  paywallDescription: z.string().max(400).catch("").default("Explore your current access and see what is planned next."),
  upgradeUrl: z.string().trim().refine(safeExternalUrl).catch("").default(""),
  upgradeLabel: z.string().max(50).catch("Explore membership").default("Explore membership"),
});
export interface AccessConfig { features: Record<FeatureId, FeaturePolicy>; membership: z.infer<typeof membershipSchema> }
export const defaultPolicy = (): FeaturePolicy => ({ mode: "free", requiredPlan: "plus", label: "", message: "" });
export function normalizeAccessConfig(raw: unknown): AccessConfig {
  const data = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const features = data.features && typeof data.features === "object" ? data.features as Record<string, unknown> : {};
  return {
    features: Object.fromEntries(FEATURES.map(feature => {
      const result = policySchema.safeParse(features[feature.id] ?? {});
      return [feature.id, result.success ? result.data : { ...defaultPolicy(), mode: "disabled" }];
    })) as Record<FeatureId, FeaturePolicy>,
    membership: membershipSchema.parse(data.membership && typeof data.membership === "object" ? data.membership : {}),
  };
}
export const DEFAULT_ACCESS = normalizeAccessConfig({});
export function planFeatures(config: AccessConfig, plan: PlanId) {
  return FEATURES.filter(feature => resolveFeatureAccess(feature.id, config, { plan, features: [] }).state === "allowed");
}
export function allAvailableFeaturesFree(config: AccessConfig) {
  return FEATURES.every(feature => resolveFeatureAccess(feature.id, config, { plan: "free", features: [] }).state !== "premium");
}
export function membershipInterestPlan(raw: unknown): "plus" | "pro" | null {
  const plan = raw && typeof raw === "object" && "plan" in raw ? raw.plan : null;
  return plan === "plus" || plan === "pro" ? plan : null;
}
export interface MemberAccess { plan: PlanId; features: FeatureId[]; expiresAt?: unknown }
export function normalizeMemberAccess(raw: unknown): MemberAccess {
  const data = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  return { plan: data.plan === "plus" || data.plan === "pro" ? data.plan : "free", features: Array.isArray(data.features) ? data.features.filter((f): f is FeatureId => FEATURES.some(def => def.id === f)) : [], expiresAt: data.expiresAt };
}
export function expiryMillis(value: unknown): number | null {
  if (value == null) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "object" && "toMillis" in value && typeof value.toMillis === "function") return value.toMillis();
  if (typeof value === "object" && "seconds" in value && typeof value.seconds === "number") return value.seconds * 1000;
  // Invalid or user-edited expiry never grants access.
  return 0;
}
export type AccessState = "allowed" | "premium" | "disabled";
export function featureDefinition(id: FeatureId) { return FEATURES.find(feature => feature.id === id)!; }
export function featureForPath(path: string): FeatureId | undefined {
  // React Router also matches case variants, trailing slashes and encoded paths.
  // Access checks must resolve those URLs to the same feature as its normal route.
  let canonical: string;
  try { canonical = decodeURIComponent(path).replace(/\/+$/, "").toLowerCase(); } catch { return undefined; }
  return FEATURES.find(feature => (feature.paths as readonly string[]).includes(canonical))?.id;
}
export function resolveFeatureAccess(id: FeatureId, config: AccessConfig, member: MemberAccess, now = Date.now()): { state: AccessState; policy: FeaturePolicy; feature: FeatureId } {
  const definition = featureDefinition(id);
  const parent = "parent" in definition ? resolveFeatureAccess(definition.parent, config, member, now) : null;
  if (config.features[id].mode === "disabled") return { state: "disabled", policy: config.features[id], feature: id };
  if (parent?.state === "disabled") return parent;
  if (parent?.state === "premium") return parent;
  const policy = config.features[id];
  const expires = expiryMillis(member.expiresAt);
  const current = expires === null || expires > now;
  const meetsPlan = policy.requiredPlan === "pro" ? member.plan === "pro" : member.plan === "plus" || member.plan === "pro";
  const allowed = policy.mode === "free" || (current && (meetsPlan || member.features.includes(id)));
  return { state: allowed ? "allowed" : "premium", policy, feature: id };
}
