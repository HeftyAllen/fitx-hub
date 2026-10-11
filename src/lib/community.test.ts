import { describe, expect, it } from "vitest";
import { activitySchema, communityWorkout, parseActivity, responseStatuses, timestampMillis } from "./community";
import { emptyCoachingExercise } from "./coaching";
import { normalizeAccessConfig, normalizeMemberAccess, resolveFeatureAccess } from "./feature-access";
const workout = { title: "Together", kind: "workout", details: "Move at your own pace", exercises: [{ ...emptyCoachingExercise(), name: "Squat" }], durationMinutes: 30, startsAt: "", meetingUrl: "", status: "published", createdBy: "coach", createdAt: { seconds: 1 }, updatedAt: { seconds: 2 } };
describe("community activities", () => {
  it("requires exercises, class dates and safe class links before sharing", () => {
    expect(activitySchema.safeParse(workout).success).toBe(true);
    expect(activitySchema.safeParse({ ...workout, exercises: [] }).success).toBe(false);
    expect(activitySchema.safeParse({ ...workout, kind: "class", startsAt: "" }).success).toBe(false);
    expect(activitySchema.safeParse({ ...workout, kind: "class", startsAt: "2026-10-12T12:00:00Z", meetingUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(activitySchema.safeParse({ ...workout, kind: "class", startsAt: "2026-10-12T12:00:00Z", meetingUrl: "https://user:pass@example.com" }).success).toBe(false);
    expect(activitySchema.safeParse({ ...workout, kind: "nutrition" }).success).toBe(false);
    expect(parseActivity("draft", { ...workout, status: "broken" })).toBe(null);
  });
  it("uses stable group-specific workout IDs and sensible response types", () => {
    const activity = parseActivity("workout", workout)!;
    expect(communityWorkout("group-a", activity).id).not.toBe(communityWorkout("group-b", activity).id);
    expect(communityWorkout("group-a", activity).exercises[0].id).toBe(communityWorkout("group-a", activity).exercises[0].id);
    expect(responseStatuses("class")).toEqual(["going", "not_going", "completed"]);
    expect(responseStatuses("announcement")).toEqual(["seen"]);
    expect(timestampMillis({ toMillis: () => 2345 })).toBe(2345);
  });
  it("is opt-in and follows disabled, paid and individually granted access", () => {
    const member = normalizeMemberAccess({});
    expect(resolveFeatureAccess("community", normalizeAccessConfig({}), member).state).toBe("disabled");
    expect(resolveFeatureAccess("community", normalizeAccessConfig({ features: { community: { mode: "free" } } }), member).state).toBe("allowed");
    const paid = normalizeAccessConfig({ features: { community: { mode: "premium", requiredPlan: "pro" } } });
    expect(resolveFeatureAccess("community", paid, normalizeMemberAccess({ plan: "plus" })).state).toBe("premium");
    expect(resolveFeatureAccess("community", paid, normalizeMemberAccess({ features: ["community"] })).state).toBe("allowed");
    expect(resolveFeatureAccess("community", normalizeAccessConfig({ features: { community: { mode: "disabled" } } }), normalizeMemberAccess({ plan: "pro" })).state).toBe("disabled");
  });
});
