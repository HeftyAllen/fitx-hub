import "fake-indexeddb/auto";
import { describe, it, expect, vi } from "vitest";
import {
  queueWorkout,
  listWorkouts,
  syncWorkouts,
  type WorkoutPayload,
} from "./queue";
const payload: WorkoutPayload = {
  dateMs: 1,
  planId: "p",
  planName: "Workout",
  exercises: [],
  duration: 600,
  totalVolume: 200,
  notes: {},
};
describe("durable offline workout queue", () => {
  it("isolates accounts and removes records only after successful confirmation", async () => {
    await queueWorkout("a", "a-record", payload);
    await queueWorkout("b", "b-record", payload);
    expect((await listWorkouts("a")).map((r) => r.id)).toEqual(["a-record"]);
    const write = vi.fn(async () => {});
    await syncWorkouts("a", write);
    expect(write).toHaveBeenCalledOnce();
    expect(await listWorkouts("a")).toEqual([]);
    expect(await listWorkouts("b")).toHaveLength(1);
  });
  it("keeps rejected writes and retries with the same document ID only when requested", async () => {
    await queueWorkout("c", "c-record", payload);
    await syncWorkouts("c", async () => {
      throw new Error("Permission denied");
    });
    expect((await listWorkouts("c"))[0].error).toBe("Permission denied");
    const retry = vi.fn(async () => {});
    await syncWorkouts("c", retry);
    expect(retry).not.toHaveBeenCalled();
    await syncWorkouts("c", retry, true);
    expect(retry.mock.calls[0]?.length).toBe(1);
    expect(await listWorkouts("c")).toEqual([]);
  });
  it("coalesces concurrent sync requests and preserves workouts added during syncing", async () => {
    await queueWorkout("d", "d-first", payload);
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const write = vi.fn(async () => {
      await pending;
    });
    const first = syncWorkouts("d", write);
    const second = syncWorkouts("d", write);
    expect(first).toBe(second);
    await queueWorkout("d", "d-next", payload);
    release();
    await first;
    expect(write).toHaveBeenCalledOnce();
    expect((await listWorkouts("d")).map((r) => r.id)).toEqual(["d-next"]);
  });
});
