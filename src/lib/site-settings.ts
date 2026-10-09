import { z } from "zod";

export const DEFAULT_BRAND = "FitX Journey";
export function safeAssetUrl(value: string) {
  if (!value) return true;
  if (value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) return true;
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password; } catch { return false; }
}
export function safeExternalUrl(value: string) {
  if (!value) return true;
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password; } catch { return false; }
}
export function validHsl(value: string) {
  const match = value.match(/^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/);
  return !!match && Number(match[1]) <= 360 && Number(match[2]) <= 100 && Number(match[3]) <= 100;
}
const copy = (fallback = "", max = 500) => z.string().trim().max(max).catch(fallback).default(fallback);
const asset = z.string().trim().refine(safeAssetUrl).catch("").default("");
const color = z.string().trim().refine(v => !v || validHsl(v)).catch("").default("");
export const siteSettingsSchema = z.object({
  businessName: copy(DEFAULT_BRAND, 60), shortName: copy("", 20), tagline: copy("Make every day count.", 160),
  supportEmail: z.union([z.literal(""), z.string().email()]).catch("").default(""),
  supportUrl: z.string().trim().refine(safeExternalUrl).catch("").default(""),
  logoUrl: asset, darkLogoUrl: asset, faviconUrl: asset, heroImageUrl: asset,
  primaryHsl: color, accentHsl: color,
  lightBackgroundHsl: color, darkBackgroundHsl: color,
  radius: z.number().min(0).max(2).catch(1.25).default(1.25),
  fontFamily: z.enum(["inter", "syne", "system"]).catch("inter").default("inter"),
  motion: z.enum(["full", "reduced", "off"]).catch("full").default("full"),
  heroTitle: copy("Your fitness.", 120), heroHighlight: copy("Your journey.", 120),
  heroDescription: copy("Train smarter, eat better, and track every milestone — all in one place."),
  heroCta: copy("Get started", 50), loginTitle: copy("Welcome Back", 100),
  loginDescription: copy("Log in to continue your journey", 250),
  dashboardSubtitle: copy("A little movement. A little balance. Your kind of progress.", 250),
  welcomeTitle: copy("Small steps. Stronger you.", 120),
  sidebarTitle: copy("One step at a time.", 100), sidebarDescription: copy("Your plans, meals and progress. All in your corner.", 250),
  footerText: copy("", 250), announcementBanner: copy("", 300),
  maintenanceMode: z.boolean().catch(false).default(false),
  maintenanceMessage: copy("We're performing scheduled maintenance. Some features may be unavailable.", 300),
  signupEnabled: z.boolean().catch(true).default(true),
});
export type SiteSettings = z.infer<typeof siteSettingsSchema>;
export const DEFAULT_SETTINGS = siteSettingsSchema.parse({});
export function normalizeSiteSettings(data: unknown): SiteSettings {
  const result = siteSettingsSchema.safeParse(data);
  return result.success ? result.data : { ...DEFAULT_SETTINGS };
}
export function hslToHex(hsl: string) {
  if (!validHsl(hsl)) return "#087f68";
  const [h, s, l] = hsl.split(/\s+/).map(Number.parseFloat);
  const a = s / 100 * Math.min(l / 100, 1 - l / 100);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}
export function hexToHsl(hex: string) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
  const l = (max + min) / 2;
  const s = delta ? delta / (1 - Math.abs(2 * l - 1)) : 0;
  const h = !delta ? 0 : max === r ? ((g - b) / delta + 6) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  return `${Math.round(h * 60)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}
/** Select the foreground with the higher WCAG contrast, including bright custom brands. */
export function contrastForeground(hsl: string) {
  const hex = hslToHex(hsl);
  const linear = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  const luminance = .2126 * linear[0] + .7152 * linear[1] + .0722 * linear[2];
  return luminance > .179 ? "0 0% 0%" : "0 0% 100%";
}
