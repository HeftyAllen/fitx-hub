import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { MotionConfig } from "framer-motion";
import { db } from "@/lib/firebase";
import { appAsset } from "@/lib/app-paths";
import { useTheme } from "./ThemeContext";
import { contrastForeground, DEFAULT_SETTINGS, hslToHex, normalizeSiteSettings, type SiteSettings } from "@/lib/site-settings";
export type { SiteSettings } from "@/lib/site-settings";
const CACHE_KEY = "fitx-branding:v2";
function cachedSettings() {
  try { return normalizeSiteSettings(JSON.parse(localStorage.getItem(CACHE_KEY) || "{}")); } catch { return { ...DEFAULT_SETTINGS }; }
}
const SiteSettingsContext = createContext<SiteSettings>(DEFAULT_SETTINGS);
const SettingsStatusContext = createContext({ loading: true, error: "", fromCache: false });
const setVar = (name: string, value: string) => value ? document.documentElement.style.setProperty(name, value) : document.documentElement.style.removeProperty(name);
const updateMeta = (name: string, content: string) => {
  let element = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!element) { element = document.createElement("meta"); element.name = name; document.head.append(element); }
  element.content = content;
};
export function SiteSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SiteSettings>(cachedSettings);
  const [status, setStatus] = useState({ loading: true, error: "", fromCache: false });
  const { theme } = useTheme();
  useEffect(() => onSnapshot(doc(db, "siteSettings", "branding"), { includeMetadataChanges: true }, snap => {
    if (snap.metadata.fromCache && !snap.exists()) {
      if (!navigator.onLine) setStatus({ loading: false, error: "", fromCache: true });
      return;
    }
    const next = normalizeSiteSettings(snap.data() || {});
    setSettings(next);
    setStatus({ loading: false, error: "", fromCache: snap.metadata.fromCache });
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(next)); } catch { /* optional public cache */ }
  }, () => setStatus({ loading: false, error: "Brand settings could not refresh. Showing the last saved brand.", fromCache: true })), []);
  useEffect(() => {
    const primary = settings.primaryHsl;
    const accent = settings.accentHsl;
    for (const token of ["--primary", "--ring", "--sidebar-primary", "--sidebar-ring", "--brand-primary"]) setVar(token, primary);
    for (const token of ["--accent", "--sidebar-accent", "--brand-accent"]) setVar(token, accent);
    for (const token of ["--primary-foreground", "--sidebar-primary-foreground", "--brand-primary-foreground"]) setVar(token, primary ? contrastForeground(primary) : "");
    for (const token of ["--accent-foreground", "--sidebar-accent-foreground", "--brand-accent-foreground"]) setVar(token, accent ? contrastForeground(accent) : "");
    setVar("--brand-light-background", settings.lightBackgroundHsl);
    setVar("--brand-dark-background", settings.darkBackgroundHsl);
    setVar("--background", theme === "dark" ? settings.darkBackgroundHsl : settings.lightBackgroundHsl);
    setVar("--radius", `${settings.radius}rem`);
    setVar("--brand-font", settings.fontFamily === "syne" ? "Syne, Inter, sans-serif" : settings.fontFamily === "system" ? "system-ui, sans-serif" : "Inter, sans-serif");
    setVar("--gradient-primary", primary || accent ? "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))" : "");
    document.documentElement.dataset.motion = settings.motion;
  }, [settings, theme]);
  useEffect(() => {
    document.title = settings.businessName || DEFAULT_SETTINGS.businessName;
    updateMeta("description", settings.heroDescription);
    updateMeta("application-name", settings.businessName);
    updateMeta("apple-mobile-web-app-title", settings.shortName || settings.businessName);
    const primary = settings.primaryHsl || (theme === "dark" ? "158 63% 62%" : "165 76% 29%");
    updateMeta("theme-color", hslToHex(primary));
    let icon = document.querySelector<HTMLLinkElement>("link[rel='icon']");
    if (!icon) { icon = document.createElement("link"); icon.rel = "icon"; document.head.append(icon); }
    icon.href = settings.faviconUrl || (theme === "dark" && settings.darkLogoUrl) || settings.logoUrl || appAsset("favicon.ico");
    const publishManifest = () => navigator.serviceWorker?.controller?.postMessage({ type: "FITX_BRAND", manifest: {
      name: settings.businessName || DEFAULT_SETTINGS.businessName,
      short_name: settings.shortName || (settings.businessName || DEFAULT_SETTINGS.businessName).slice(0, 20),
      description: settings.heroDescription, theme_color: hslToHex(primary),
      background_color: hslToHex((theme === "dark" ? settings.darkBackgroundHsl : settings.lightBackgroundHsl) || (theme === "dark" ? "160 16% 7%" : "150 18% 97%")),
      logo: settings.logoUrl,
    }});
    const refreshManifest = (event: MessageEvent) => {
      if (event.data?.type !== "FITX_BRAND_UPDATED") return;
      const manifest = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
      if (manifest) manifest.href = `${appAsset("manifest.webmanifest")}?brand=${encodeURIComponent(settings.businessName)}&color=${hslToHex(primary).slice(1)}`;
    };
    publishManifest();
    navigator.serviceWorker?.addEventListener("controllerchange", publishManifest);
    navigator.serviceWorker?.addEventListener("message", refreshManifest);
    return () => { navigator.serviceWorker?.removeEventListener("controllerchange", publishManifest); navigator.serviceWorker?.removeEventListener("message", refreshManifest); };
  }, [settings, theme]);
  return <SiteSettingsContext.Provider value={settings}>
    <SettingsStatusContext.Provider value={status}>
      <MotionConfig reducedMotion={settings.motion === "full" ? "user" : "always"} transition={settings.motion === "off" ? { duration: 0 } : undefined}>
        {children}
      </MotionConfig>
    </SettingsStatusContext.Provider>
  </SiteSettingsContext.Provider>;
}
export const useSiteSettings = () => useContext(SiteSettingsContext);
export const useSettingsStatus = () => useContext(SettingsStatusContext);
export function useBrand(fallbackLogo?: string) {
  const settings = useSiteSettings();
  const { theme } = useTheme();
  return {
    name: settings.businessName || DEFAULT_SETTINGS.businessName, tagline: settings.tagline,
    logo: (theme === "dark" && settings.darkLogoUrl) || settings.logoUrl || fallbackLogo,
    supportEmail: settings.supportEmail, supportUrl: settings.supportUrl,
  };
}
