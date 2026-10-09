import { describe, expect, it } from "vitest";
import { normalizeSiteSettings, safeAssetUrl, safeExternalUrl, validHsl, contrastForeground, hslToHex, hexToHsl } from "./site-settings";
describe("published branding", () => {
  it("supports older saved brands and safely defaults missing or malformed fields", () => {
    const brand = normalizeSiteSettings({ businessName: "Pulse Studio", primaryHsl: "262 65% 53%", logoUrl: "/logo.png", motion: "unknown", radius: 99 });
    expect(brand.businessName).toBe("Pulse Studio");
    expect(brand.primaryHsl).toBe("262 65% 53%");
    expect(brand.radius).toBe(1.25);
    expect(brand.motion).toBe("full");
    expect(brand.signupEnabled).toBe(true);
    expect(normalizeSiteSettings(null).businessName).toBe("FitX Journey");
  });
  it("allows public assets and rejects script, credentialed and protocol-relative URLs", () => {
    for (const url of ["javascript:alert(1)", "//evil.test/logo.png", "https://name:password@example.com/logo.png", "http://example.com/logo.png", "data:image/svg+xml,test"]) expect(safeAssetUrl(url)).toBe(false);
    expect(safeAssetUrl("https://example.com/logo.png")).toBe(true);
    expect(safeAssetUrl("/logo.png")).toBe(true);
    expect(safeExternalUrl("/checkout")).toBe(false);
    expect(normalizeSiteSettings({ faviconUrl: "javascript:alert(1)" }).faviconUrl).toBe("");
  });
  it("bounds CSS colour values and picks a readable foreground for bright or dark brands", () => {
    expect(validHsl("262 65% 53%")).toBe(true);
    expect(validHsl("999 65% 53%")).toBe(false);
    expect(validHsl("262 65% 53%; display:none")).toBe(false);
    expect(contrastForeground("0 0% 100%")).toBe("0 0% 0%");
    expect(contrastForeground("0 0% 0%")).toBe("0 0% 100%");
    expect(hslToHex(hexToHsl("#ffffff"))).toBe("#ffffff");
  });
});
