import { beforeEach, describe, expect, it } from "vitest";
import {
  loadWorkoutDraft,
  saveWorkoutDraft,
  clearWorkoutDraft,
} from "./drafts";
beforeEach(() => localStorage.clear());
describe("workout recovery", () => {
  it("recovers one account without leaking to another", () => {
    const draft = {
      sessionId: "session",
      plan: { name: "Push", exercises: [{}] },
      exercises: [{}],
      currentIdx: 0,
      elapsedSeconds: 42,
      setNotes: { "0": "Good set" },
      savedAt: 1,
    };
    saveWorkoutDraft("a", draft);
    expect(loadWorkoutDraft("a")).toEqual(draft);
    expect(loadWorkoutDraft("b")).toBeNull();
    clearWorkoutDraft("a");
    expect(loadWorkoutDraft("a")).toBeNull();
  });
  it("handles corrupt and out-of-range drafts", () => {
    localStorage.setItem("fitx-workout-draft:a", "{bad");
    expect(loadWorkoutDraft("a")).toBeNull();
    localStorage.setItem(
      "fitx-workout-draft:a",
      JSON.stringify({
        sessionId: "s",
        plan: { exercises: [{}] },
        exercises: [{}],
        currentIdx: 99,
        elapsedSeconds: 0,
      }),
    );
    expect(loadWorkoutDraft("a")).toBeNull();
  });
});
