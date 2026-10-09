export interface WorkoutPayload {
  dateMs: number;
  planId: string | null;
  planName: string;
  exercises: {
    name: string;
    bodyPart: string;
    sets: { weight: number; reps: number; completed: boolean; note?: string }[];
  }[];
  duration: number;
  totalVolume: number;
  notes: Record<string, string>;
}
export interface QueuedWorkout {
  id: string;
  uid: string;
  payload: WorkoutPayload;
  savedAt: number;
  error?: string;
}
const DATABASE = "fitx-offline-v1";
const CHANGE = "fitx-offline-change";
let opening: Promise<IDBDatabase> | undefined;
function database() {
  if (!opening)
    opening = new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(DATABASE, 1);
      req.onupgradeneeded = () =>
        req.result.createObjectStore("workouts", { keyPath: "id" });
      req.onsuccess = () => {
        req.result.onversionchange = () => {
          req.result.close();
          opening = undefined;
        };
        resolve(req.result);
      };
      req.onerror = () => {
        opening = undefined;
        reject(req.error);
      };
    });
  return opening;
}
async function transaction<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("workouts", mode);
    const req = operation(tx.objectStore("workouts"));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () =>
      reject(tx.error ?? new Error("Offline storage was interrupted."));
  });
}
function changed() {
  window.dispatchEvent(new Event(CHANGE));
}
export function subscribeQueue(listener: () => void) {
  window.addEventListener(CHANGE, listener);
  return () => window.removeEventListener(CHANGE, listener);
}
export async function listWorkouts(uid: string): Promise<QueuedWorkout[]> {
  return (await transaction<QueuedWorkout[]>("readonly", (s) => s.getAll()))
    .filter((r) => r.uid === uid)
    .sort((a, b) => a.savedAt - b.savedAt);
}
export async function queueWorkout(
  uid: string,
  id: string,
  payload: WorkoutPayload,
) {
  await transaction("readwrite", (s) =>
    s.put({ id, uid, payload, savedAt: Date.now() } satisfies QueuedWorkout),
  );
  changed();
}
const active = new Map<string, Promise<void>>();
/** Stable document IDs make retries safe even if a prior response was lost. */
export function syncWorkouts(
  uid: string,
  write: (entry: QueuedWorkout) => Promise<void>,
  retryFailed = false,
): Promise<void> {
  const current = active.get(uid);
  if (current) return current;
  const job = (async () => {
    const queue = await listWorkouts(uid);
    for (const entry of queue) {
      if (entry.error && !retryFailed) continue;
      try {
        await write(entry);
        await transaction("readwrite", (s) => s.delete(entry.id));
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Sync failed. Reconnect and retry.";
        await transaction("readwrite", (s) =>
          s.put({ ...entry, error: message }),
        );
      }
      changed();
    }
  })().finally(() => active.delete(uid));
  active.set(uid, job);
  return job;
}
