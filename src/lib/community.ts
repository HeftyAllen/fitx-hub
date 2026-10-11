import { z } from "zod";
import { coachingExerciseSchema, type CoachingExercise } from "./coaching";

export const COMMUNITY_EMOJIS = ["👍", "❤️", "😂", "🔥", "💪", "🎉", "👏", "😮"] as const;
export const CHAT_EMOJIS = [...COMMUNITY_EMOJIS, "😊", "🙌", "✅", "🏋️", "🥗", "👋", "🙏", "😅", "🚀", "⭐", "🏃", "💯"];
export const activityKinds = {
  workout: { label: "Shared workout", emoji: "🏋️", feature: "training" },
  class: { label: "Class", emoji: "📅", feature: "training" },
  nutrition: { label: "Nutrition guidance", emoji: "🥗", feature: "nutrition" },
  challenge: { label: "Group challenge", emoji: "🔥", feature: "records" },
  announcement: { label: "Announcement", emoji: "📣", feature: "community" },
} as const;
export type ActivityKind = keyof typeof activityKinds;
export const groupSchema = z.object({
  name: z.string().trim().min(2, "Give your group a name.").max(80),
  description: z.string().trim().max(500),
  tone: z.enum(["mint", "blue", "violet", "amber"]),
});
export interface CommunityGroup extends z.infer<typeof groupSchema> { id: string; coachId: string; status: "active" | "archived"; createdBy: string; createdAt: unknown; lastMessageAt?: unknown }
export interface CommunityMember { id: string; name: string; role: "coach" | "member"; status: "active" | "removed"; assignmentId: string; joinedAt: unknown; lastReadAt?: unknown; typingUntil?: unknown }
export interface CommunityMessage { id: string; senderId: string; senderName: string; senderRole: "admin" | "moderator" | "coach" | "member"; text: string; replyTo: string; reactions: Record<string, string>; status: "visible" | "removed"; createdAt: unknown; pending: boolean }
export const activitySchema = z.object({
  title: z.string().trim().min(1, "Give this activity a title.").max(120),
  kind: z.enum(["workout", "class", "nutrition", "challenge", "announcement"]),
  details: z.string().trim().min(1, "Add the instructions or announcement.").max(10000),
  exercises: z.array(coachingExerciseSchema).max(20),
  durationMinutes: z.number().int().min(5).max(180),
  startsAt: z.string().datetime().or(z.literal("")),
  meetingUrl: z.string().max(1000).refine(value => { if (!value) return true; try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password; } catch { return false; } }, "Use a full HTTPS class link."),
}).superRefine((data, ctx) => {
  if (data.kind === "workout" && !data.exercises.length) ctx.addIssue({ code: "custom", message: "Add at least one exercise.", path: ["exercises"] });
  if (data.kind === "class" && !data.startsAt) ctx.addIssue({ code: "custom", message: "Choose the class date and time.", path: ["startsAt"] });
  if (["nutrition", "announcement", "challenge"].includes(data.kind) && data.exercises.length) ctx.addIssue({ code: "custom", message: "Exercises belong to a workout or class.", path: ["exercises"] });
});
export type CommunityActivityInput = z.infer<typeof activitySchema>;
export interface CommunityActivity extends CommunityActivityInput { id: string; status: "draft" | "published" | "withdrawn"; createdBy: string; createdAt: unknown; updatedAt: unknown }
export interface ActivityResponse { id: string; activityId: string; userId: string; name: string; status: "going" | "not_going" | "seen" | "joined" | "completed"; feedback: string; updatedAt: unknown }
export interface CommunityReport { id: string; messageId: string; reporterId: string; reason: string; status: "open" | "resolved"; createdAt: unknown }
export function timestampMillis(value: unknown): number {
  if (value && typeof value === "object" && "toMillis" in value && typeof value.toMillis === "function") return value.toMillis();
  if (value && typeof value === "object" && "seconds" in value && typeof value.seconds === "number") return value.seconds * 1000;
  return 0;
}
export function parseGroup(id: string, raw: Record<string, unknown>): CommunityGroup | null {
  const data = groupSchema.safeParse(raw);
  return data.success && typeof raw.coachId === "string" && (raw.status === "active" || raw.status === "archived") ? { ...data.data, id, coachId: raw.coachId, status: raw.status, createdBy: String(raw.createdBy || ""), createdAt: raw.createdAt, lastMessageAt: raw.lastMessageAt } : null;
}
export function parseActivity(id: string, raw: Record<string, unknown>): CommunityActivity | null {
  const data = activitySchema.safeParse(raw);
  return data.success && ["draft", "published", "withdrawn"].includes(String(raw.status)) ? { ...data.data, id, status: raw.status as CommunityActivity["status"], createdBy: String(raw.createdBy || ""), createdAt: raw.createdAt, updatedAt: raw.updatedAt } : null;
}
export function communityWorkout(groupId: string, activity: CommunityActivity) {
  return { id: `community_${groupId}_${activity.id}`, name: activity.title, exercises: activity.exercises.map((exercise: CoachingExercise, index) => ({ ...exercise, id: `community_${activity.id}_${index}` })), source: "community", sourceId: activity.id, communityGroupId: groupId };
}
export function responseStatuses(kind: ActivityKind): ActivityResponse["status"][] {
  return kind === "class" ? ["going", "not_going", "completed"] : kind === "challenge" ? ["joined", "completed"] : kind === "announcement" ? ["seen"] : ["seen", "completed"];
}
