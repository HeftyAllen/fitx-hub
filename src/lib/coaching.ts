import { z } from "zod";

export const programmeKinds = {
  workout: { label: "Home workout", tone: "blue", feature: "training" },
  class: { label: "Gym / online class", tone: "violet", feature: "training" },
  nutrition: { label: "Nutrition plan", tone: "mint", feature: "nutrition" },
} as const;
export type ProgrammeKind = keyof typeof programmeKinds;
export interface CoachAssignment { id: string; coachId: string; memberId: string; memberName: string; coachName?: string; goal: string; status: "active" | "archived" }
export const coachingExerciseSchema = z.object({
  name: z.string().trim().min(1).max(120),
  sets: z.number().int().min(1).max(10), reps: z.number().int().min(1).max(100), restSeconds: z.number().int().min(0).max(600),
  equipment: z.string().trim().max(80).default("body weight"),
  bodyPart: z.string().trim().max(80).default("general"), target: z.string().trim().max(80).default("general"),
});
export type CoachingExercise = z.infer<typeof coachingExerciseSchema>;
export const programmeSchema = z.object({
  title: z.string().trim().min(1, "Give the programme a title.").max(120),
  kind: z.enum(["workout", "class", "nutrition"]),
  details: z.string().trim().min(1, "Add instructions for your members.").max(10000),
  exercises: z.array(coachingExerciseSchema).max(20),
  durationMinutes: z.number().int().min(5).max(180),
  startsAt: z.string().datetime().or(z.literal("")),
  meetingUrl: z.string().trim().max(1000).refine(value => {
    if (!value) return true;
    try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password; } catch { return false; }
  }, "Use a full HTTPS class link."),
}).superRefine((data, ctx) => {
  if (data.kind === "workout" && data.exercises.length === 0) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Add at least one exercise.", path: ["exercises"] });
  if (data.kind === "class" && !data.startsAt) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Choose the class date and time.", path: ["startsAt"] });
});
export type ProgrammeInput = z.infer<typeof programmeSchema>;
export type CoachingProgramme = ProgrammeInput & { id: string; status: "published" | "withdrawn" };
export interface ProgrammeResponse { id: string; status: "seen" | "completed"; feedback: string }
export const emptyCoachingExercise = (): CoachingExercise => ({ name: "", sets: 3, reps: 10, restSeconds: 60, equipment: "body weight", bodyPart: "general", target: "general" });
export function parseProgramme(id: string, data: unknown): CoachingProgramme | null {
  const parsed = programmeSchema.safeParse(data);
  const status = data && typeof data === "object" && "status" in data ? data.status : null;
  return parsed.success && (status === "published" || status === "withdrawn") ? { ...parsed.data, id, status } : null;
}
export function programmeSchedule(startsAt: string) {
  return startsAt ? new Date(startsAt).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "At your own pace";
}
export function programmeWorkout(assignmentId: string, programme: CoachingProgramme) {
  return { id: `coach_${assignmentId}_${programme.id}`, name: programme.title, exercises: programme.exercises.map((exercise, index) => ({ ...exercise, id: `coach_${programme.id}_exercise_${index + 1}` })), source: "coaching", sourceId: programme.id, assignmentId };
}
