import { afterEach, describe, expect, it } from "vitest";
import { basicProfileErrors, defaultOnboardingProfile, onboardingDraftKey, parseMeasurement, profileAge, readOnboardingDraft } from "./onboarding";

afterEach(() => sessionStorage.clear());
describe("onboarding measurements", () => {
  it("accepts mobile decimal commas and dots without losing precision", () => {
    expect(parseMeasurement("169,5")).toBe(169.5);
    expect(parseMeasurement(" 72.25 ")).toBe(72.25);
    expect(parseMeasurement("5,56")).toBe(5.56);
    for (const input of ["", "NaN", "-70", "0", "1,234.5", "1e3", "72kg"]) expect(parseMeasurement(input)).toBeNull();
  });
  it("validates each selected unit and names the field blocking Next", () => {
    const profile = { ...defaultOnboardingProfile("Friend"), dob: "2003-09-23", gender: "Female", height: "169,5", weight: "72" };
    expect(basicProfileErrors(profile)).toEqual({});
    expect(basicProfileErrors({ ...profile, heightUnit: "ft" })).toHaveProperty("height");
    expect(basicProfileErrors({ ...profile, heightUnit: "ft", height: "5,56", weightUnit: "lbs", weight: "158,7" })).toEqual({});
    expect(basicProfileErrors({ ...profile, name: "  " })).toHaveProperty("name");
  });
});
describe("onboarding recovery", () => {
  it("checks calendar dates and the exact sixteenth birthday", () => {
    const today = new Date(2026, 9, 11, 12);
    expect(profileAge("2010-10-11", today)).toBe(16);
    expect(profileAge("2010-10-12", today)).toBe(15);
    expect(profileAge("2003-02-30", today)).toBeNull();
    expect(profileAge("2027-01-01", today)).toBeNull();
  });
  it("recovers this member's valid draft without exposing it to another account", () => {
    const profile = { ...defaultOnboardingProfile("Friend"), dob: "2003-09-23", gender: "Female", height: "169,5", weight: "72", goalType: "lose", experienceLevel: "Beginner" };
    sessionStorage.setItem(onboardingDraftKey("friend"), JSON.stringify({ version: 1, step: 7, profile }));
    expect(readOnboardingDraft("friend")).toEqual({ step: 7, profile });
    expect(readOnboardingDraft("another", "Another friend")).toEqual({ step: 0, profile: defaultOnboardingProfile("Another friend") });
    sessionStorage.setItem(onboardingDraftKey("friend"), JSON.stringify({ version: 1, step: 7, profile: { ...profile, heightUnit: "ft" } }));
    expect(readOnboardingDraft("friend").step).toBe(1);
    sessionStorage.setItem(onboardingDraftKey("friend"), "invalid JSON");
    expect(readOnboardingDraft("friend").step).toBe(0);
  });
});
