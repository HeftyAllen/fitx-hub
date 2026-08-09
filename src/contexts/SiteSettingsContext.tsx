import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface SiteSettings {
  businessName?: string;
  tagline?: string;
  supportEmail?: string;
  logoUrl?: string;
  faviconUrl?: string;
  primaryHsl?: string;
  accentHsl?: string;
  radius?: number;          // rem
  maintenanceMode?: boolean;
  maintenanceMessage?: string;
  signupEnabled?: boolean;
  announcementBanner?: string;
}

const SiteSettingsContext = createContext<SiteSettings>({});

function setVar(name: string, value?: string | null) {
  if (value) document.documentElement.style.setProperty(name, value);
  else document.documentElement.style.removeProperty(name);
}

export function SiteSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SiteSettings>({});

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "siteSettings", "branding"), (s) => {
      setSettings(s.exists() ? (s.data() as SiteSettings) : {});
    }, () => {});
    return unsub;
  }, []);

  // Apply theme tokens globally (affects every page instantly)
  useEffect(() => {
    setVar("--primary", settings.primaryHsl);
    setVar("--ring", settings.primaryHsl);
    setVar("--sidebar-primary", settings.primaryHsl);
    setVar("--accent", settings.accentHsl);
    setVar("--radius", settings.radius != null ? `${settings.radius}rem` : null);
  }, [settings.primaryHsl, settings.accentHsl, settings.radius]);

  // Title + favicon
  useEffect(() => {
    if (settings.businessName) document.title = settings.businessName;
    const href = settings.faviconUrl || settings.logoUrl;
    if (href) {
      let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      link.href = href;
    }
  }, [settings.businessName, settings.faviconUrl, settings.logoUrl]);

  return (
    <SiteSettingsContext.Provider value={settings}>
      {settings.maintenanceMode && (
        <div className="fixed top-0 inset-x-0 z-[60] bg-amber-500 text-amber-950 text-xs font-bold text-center py-1.5 px-3">
          ⚠ {settings.maintenanceMessage || "We're performing scheduled maintenance. Some features may be unavailable."}
        </div>
      )}
      {children}
    </SiteSettingsContext.Provider>
  );
}

export const useSiteSettings = () => useContext(SiteSettingsContext);

/** Brand name + logo helper so every surface stays in sync with admin settings. */
export function useBrand(fallbackLogo?: string) {
  const s = useSiteSettings();
  return {
    name: s.businessName || "FitX Journey",
    tagline: s.tagline || "",
    logo: s.logoUrl || fallbackLogo,
    supportEmail: s.supportEmail || "",
  };
}
