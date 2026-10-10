import { describe, expect, it } from "vitest";
import { parseProgramme, programmeSchema, programmeWorkout } from "./coaching";
import { featureForPath } from "./feature-access";
const routine = { title: "Home strength", kind: "workout", details: "Use controlled reps.", exercises: [{ name: "Bodyweight squat", sets: 2, reps: 10, restSeconds: 30 }], durationMinutes: 20, startsAt: "", meetingUrl: "" };
describe("shared coaching programmes", () => {
  it("creates a session-ready workout with an identity unique to its assignment", () => {
    const programme = parseProgramme("routine", { ...routine, status: "published" });
    expect(programme).not.toBeNull();
    const workout = programmeWorkout("client-one", programme!);
    expect(workout.exercises[0]).toMatchObject({ sets: 2, reps: 10, restSeconds: 30, equipment: "body weight" });
    expect(workout.id).not.toBe(programmeWorkout("client-two", programme!).id);
  });
  it("requires workout exercises and class times, and rejects unsafe class links", () => {
    expect(programmeSchema.safeParse({ ...routine, exercises: [] }).success).toBe(false);
    expect(programmeSchema.safeParse({ ...routine, kind: "class", startsAt: "" }).success).toBe(false);
    for (const meetingUrl of ["javascript:alert(1)", "http://example.org/class", "https://name:secret@example.org/class"]) {
      expect(programmeSchema.safeParse({ ...routine, kind: "class", startsAt: "2026-12-12T09:00:00.000Z", meetingUrl }).success).toBe(false);
    }
  });
  it("accepts nutrition guidance without exercises and ignores malformed records", () => {
    expect(parseProgramme("nutrition", { ...routine, kind: "nutrition", exercises: [], status: "published" })).not.toBeNull();
    expect(parseProgramme("bad", { ...routine, durationMinutes: -3, status: "published" })).toBeNull();
    expect(parseProgramme("bad", { ...routine, status: "draft" })).toBeNull();
  });
  it("keeps the private coaching route under the administrator's coach-library control", () => {
    expect(featureForPath("/coaching")).toBe("library");
  });
});
