import { describe, expect, it } from "vitest";
import { memberGreetingName } from "./member-identity";

describe("member greetings", () => {
  it("uses each member's complete saved name and respects a preferred greeting", () => {
    expect(memberGreetingName({ name: "Alex Morgan" })).toBe("Alex Morgan");
    expect(memberGreetingName({ name: "Sam Taylor", greetingName: "  Sammy  " })).toBe("Sammy");
    expect(memberGreetingName({ name: "  Ana   María  " })).toBe("Ana María");
  });
  it("falls back to a real sign-in name and keeps legacy QA accounts neutral", () => {
    expect(memberGreetingName({ name: "FitX QA" }, "Taylor Morgan")).toBe("Taylor Morgan");
    expect(memberGreetingName({ name: "fitxqa" })).toBe("");
    expect(memberGreetingName(null)).toBe("");
  });
});
