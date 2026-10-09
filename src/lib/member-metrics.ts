export interface MemberWorkout {
  id: string; planName?: string; duration?: number; totalVolume?: number; date?: unknown;
}
export function localDay(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function workoutDate(value: unknown): Date | null {
  let date: Date;
  if (value instanceof Date) date = value;
  else if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") date = value.toDate();
  else if (value && typeof value === "object" && "seconds" in value && typeof value.seconds === "number") date = new Date(value.seconds * 1000);
  else if (typeof value === "string" || typeof value === "number") date = new Date(value);
  else return null;
  return Number.isFinite(date.getTime()) ? date : null;
}
export function weeklyActivity(logs: MemberWorkout[], now = new Date()) {
  const monday = new Date(now);
  monday.setDate(now.getDate() - (now.getDay() + 6) % 7);
  monday.setHours(0, 0, 0, 0);
  return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, i) => {
    const date = new Date(monday); date.setDate(monday.getDate() + i);
    const key = localDay(date);
    const entries = logs.filter(log => { const d = workoutDate(log.date); return d && localDay(d) === key; });
    return { day, date: key, workouts: entries.length, minutes: Math.round(entries.reduce((sum, log) => sum + Math.max(0, Number(log.duration) || 0), 0) / 60), volume: entries.reduce((sum, log) => sum + Math.max(0, Number(log.totalVolume) || 0), 0) };
  });
}
export function trainingStreak(logs: MemberWorkout[], now = new Date()) {
  const dates = new Set(logs.flatMap(log => { const date = workoutDate(log.date); return date ? [localDay(date)] : []; }));
  const cursor = new Date(now);
  if (!dates.has(localDay(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (dates.has(localDay(cursor))) { streak++; cursor.setDate(cursor.getDate() - 1); }
  return streak;
}
