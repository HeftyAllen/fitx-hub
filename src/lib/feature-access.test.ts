import { describe, expect, it } from "vitest";
import { FEATURES, normalizeAccessConfig, normalizeMemberAccess, resolveFeatureAccess, featureForPath, allAvailableFeaturesFree, planFeatures, membershipInterestPlan } from "./feature-access";
import { decodeFirestoreFields, serverFeatureAllowed } from "../../supabase/functions/_shared/member-access";
describe("feature access", () => {
  const free = normalizeMemberAccess({});
  it("keeps every existing section available when no feature settings have been published", () => {
    for (const feature of FEATURES) expect(resolveFeatureAccess(feature.id, normalizeAccessConfig({}), free).state).toBe("allowed");
    expect(featureForPath("/grocery-list")).toBe("grocery");
    expect(featureForPath("/grocery")).toBe("grocery");
    for (const path of ["/nutrition/", "/NUTRITION", "/n%75trition", "/nutrition///"]) expect(featureForPath(path)).toBe("nutrition");
  });
  it("disabling Nutrition disables all its tools, including for Pro memberships", () => {
    const config = normalizeAccessConfig({ features: { nutrition: { mode: "disabled" } } });
    for (const feature of ["nutrition", "recipes", "mealPlanner", "barcode", "grocery"] as const) expect(resolveFeatureAccess(feature, config, normalizeMemberAccess({ plan: "pro", features: [feature] })).state).toBe("disabled");
    expect(resolveFeatureAccess("training", config, free).state).toBe("allowed");
  });
  it("requires the minimum plan and rejects forged profile values", () => {
    const config = normalizeAccessConfig({ features: { progress: { mode: "premium", requiredPlan: "pro" } } });
    expect(resolveFeatureAccess("progress", config, normalizeMemberAccess({ plan: "plus" })).state).toBe("premium");
    expect(resolveFeatureAccess("progress", config, normalizeMemberAccess({ plan: "pro" })).state).toBe("allowed");
    expect(resolveFeatureAccess("progress", config, normalizeMemberAccess({ membership: "pro", role: "admin", plan: "admin" })).state).toBe("premium");
  });
  it("extra grants need to satisfy a paid parent as well as the child", () => {
    const config = normalizeAccessConfig({ features: { nutrition: { mode: "premium" }, recipes: { mode: "premium", requiredPlan: "pro" } } });
    expect(resolveFeatureAccess("recipes", config, normalizeMemberAccess({ features: ["recipes"] })).state).toBe("premium");
    expect(resolveFeatureAccess("recipes", config, normalizeMemberAccess({ features: ["nutrition", "recipes"] })).state).toBe("allowed");
    expect(resolveFeatureAccess("recipes", config, normalizeMemberAccess({ plan: "plus" })).state).toBe("premium");
  });
  it("expires grants at the exact deadline and fails closed for invalid policies or expiry", () => {
    const config = normalizeAccessConfig({ features: { nutrition: { mode: "premium" }, records: { mode: "typo" } } });
    const member = normalizeMemberAccess({ plan: "pro", features: ["nutrition"], expiresAt: { seconds: 20 } });
    expect(resolveFeatureAccess("nutrition", config, member, 19999).state).toBe("allowed");
    expect(resolveFeatureAccess("nutrition", config, member, 20000).state).toBe("premium");
    expect(resolveFeatureAccess("records", config, member).state).toBe("disabled");
    expect(resolveFeatureAccess("nutrition", config, normalizeMemberAccess({ plan: "pro", expiresAt: "invalid" })).state).toBe("premium");
  });
  it("rejects unsafe checkout URLs while preserving published access policies", () => {
    const config = normalizeAccessConfig({ membership: { upgradeUrl: "javascript:alert(1)" }, features: { barcode: { mode: "premium" } } });
    expect(config.membership.upgradeUrl).toBe("");
    expect(config.features.barcode.mode).toBe("premium");
  });
  it("keeps future plans separate from actual access and respects parent restrictions in plan listings", () => {
    const preview = normalizeAccessConfig({ membership: { plusPrice: "", proPrice: "R199 / month", showFuturePlans: false }, features: { nutrition: { mode: "disabled" }, recipes: { mode: "premium" } } });
    expect(allAvailableFeaturesFree(preview)).toBe(true);
    expect(preview.membership.plusPrice).toBe("R79 / month");
    expect(preview.membership.proPrice).toBe("R199 / month");
    expect(planFeatures(preview, "pro").map(feature => feature.id)).not.toContain("recipes");
    const paid = normalizeAccessConfig({ features: { nutrition: { mode: "premium", requiredPlan: "pro" } } });
    expect(allAvailableFeaturesFree(paid)).toBe(false);
    expect(planFeatures(paid, "plus").map(feature => feature.id)).not.toContain("mealPlanner");
    expect(planFeatures(paid, "pro").map(feature => feature.id)).toContain("mealPlanner");
    expect(membershipInterestPlan({ plan: "admin" })).toBe(null);
    expect(normalizeMemberAccess({ membershipInterest: { plan: "pro" } }).plan).toBe("free");
  });
});
describe("server food access", () => {
  it("decodes nested Firestore policy maps, membership arrays and timestamp fields", () => {
    expect(decodeFirestoreFields({ plan: { stringValue: "plus" }, features: { arrayValue: { values: [{ stringValue: "barcode" }] } }, expiresAt: { timestampValue: "2026-10-10T00:00:00Z" }, featuresMap: { mapValue: { fields: { nutrition: { mapValue: { fields: { mode: { stringValue: "premium" } } } } } } } })).toEqual({ plan: "plus", features: ["barcode"], expiresAt: "2026-10-10T00:00:00Z", featuresMap: { nutrition: { mode: "premium" } } });
  });
  it("checks the trusted plan, expiry and Nutrition parent before serving barcode results", () => {
    const config = { features: { nutrition: { mode: "premium" }, barcode: { mode: "premium", requiredPlan: "pro" } } };
    expect(serverFeatureAllowed("barcode", config, { plan: "plus" })).toBe(false);
    expect(serverFeatureAllowed("barcode", config, { plan: "plus", features: ["barcode"] })).toBe(true);
    expect(serverFeatureAllowed("barcode", config, { plan: "pro", expiresAt: "2020-01-01" })).toBe(false);
    expect(serverFeatureAllowed("barcode", { features: { nutrition: { mode: "disabled" } } }, { plan: "pro" })).toBe(false);
    expect(serverFeatureAllowed("nutrition", null, null)).toBe(true);
    expect(serverFeatureAllowed("nutrition", { features: { nutrition: { mode: "" } } }, { plan: "pro" })).toBe(false);
    expect(serverFeatureAllowed("nutrition", { features: { nutrition: { mode: "premium", requiredPlan: "" } } }, { plan: "pro", features: ["nutrition"] })).toBe(false);
  });
});
