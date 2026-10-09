const key = (uid: string) => `fitx-workout-draft:${uid}`;
export interface WorkoutDraft {
  sessionId: string;
  plan: { id?: string; name: string; exercises: unknown[] };
  exercises: unknown[];
  currentIdx: number;
  elapsedSeconds: number;
  setNotes: Record<string, string>;
  savedAt: number;
}
export function loadWorkoutDraft(uid: string): WorkoutDraft | null {
  try {
    const draft = JSON.parse(localStorage.getItem(key(uid)) || "null");
    return draft &&
      typeof draft.sessionId === "string" &&
      Array.isArray(draft.plan?.exercises) &&
      Array.isArray(draft.exercises) &&
      Number.isFinite(draft.elapsedSeconds) &&
      Number.isFinite(draft.currentIdx) &&
      draft.currentIdx >= 0 &&
      draft.currentIdx < draft.exercises.length
      ? draft
      : null;
  } catch {
    return null;
  }
}
export function saveWorkoutDraft(uid: string, draft: WorkoutDraft) {
  localStorage.setItem(key(uid), JSON.stringify(draft));
}
export function clearWorkoutDraft(uid: string) {
  localStorage.removeItem(key(uid));
}
