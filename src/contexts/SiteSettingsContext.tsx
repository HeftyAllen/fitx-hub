import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface SiteSettings {
  businessName?: string;
  supportEmail?: string;
  logoUrl?: string;
  primaryHsl?: string;
  maintenanceMode?: boolean;
  maintenanceMessage?: string;
  signupEnabled?: boolean;
}

const SiteSettingsContext = createContext<SiteSettings>({});

export function SiteSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SiteSettings>({});

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "siteSettings", "branding"), (s) => {
      setSettings(s.exists() ? (s.data() as SiteSettings) : {});
    }, () => {});
    return unsub;
  }, []);

  // Apply primary color globally
  useEffect(() => {
    if (settings.primaryHsl) {
      document.documentElement.style.setProperty("--primary", settings.primaryHsl);
    } else {
      document.documentElement.style.removeProperty("--primary");
    }
    if (settings.businessName) {
      document.title = settings.businessName;
    }
  }, [settings.primaryHsl, settings.businessName]);

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
