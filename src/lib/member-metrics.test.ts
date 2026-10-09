import { describe, expect, it } from "vitest";
import { localDay, weeklyActivity, trainingStreak, workoutDate } from "./member-metrics";
describe("member dashboard metrics", () => {
  it("counts sessions rather than training days and excludes prior weeks", () => {
    const now = new Date(2026, 9, 9, 9);
    const days = weeklyActivity([
      { id: "a", date: new Date(2026, 9, 8), duration: 600, totalVolume: 200 },
      { id: "b", date: new Date(2026, 9, 8, 18), duration: 1200, totalVolume: 400 },
      { id: "old", date: new Date(2026, 8, 30), duration: 900 },
    ], now);
    expect(days[3]).toMatchObject({ day: "Thu", workouts: 2, minutes: 30, volume: 600 });
    expect(days.reduce((sum, day) => sum + day.workouts, 0)).toBe(2);
  });
  it("keeps yesterday's streak until today is complete, without counting duplicate sessions", () => {
    const now = new Date(2026, 9, 9);
    const logs = [8, 8, 7, 5].map((day, i) => ({ id: String(i), date: new Date(2026, 9, day) }));
    expect(trainingStreak(logs, now)).toBe(2);
    expect(trainingStreak(logs, new Date(2026, 9, 10))).toBe(0);
  });
  it("uses local calendar dates and accepts Firebase timestamps while ignoring missing dates", () => {
    const date = new Date(2026, 9, 9, 0, 15);
    expect(localDay(date)).toBe("2026-10-09");
    expect(workoutDate({ seconds: date.getTime() / 1000 })?.getTime()).toBe(date.getTime());
    expect(workoutDate(undefined)).toBeNull();
    expect(workoutDate("invalid")).toBeNull();
  });
});
