import { ReactNode } from "react";
import MemberNavigation from "./MemberNavigation";
import { motion, useReducedMotion } from "framer-motion";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { useAdmin } from "@/hooks/useAdmin";
import { Link } from "react-router-dom";
import { ArrowUpRight, ShieldCheck } from "lucide-react";

export default function AppLayout({ children }: { children: ReactNode }) {
  const settings = useSiteSettings();
  const { isAdmin, role } = useAdmin();
  const reduce = useReducedMotion() || settings.motion !== "full";
  return (
    <div className="member-shell min-h-screen bg-background text-foreground">
      <MemberNavigation />
      <a className="sr-only focus:not-sr-only fixed top-2 left-3 z-[100] member-action" href="#member-main" onClick={event => { event.preventDefault(); document.getElementById("member-main")?.focus(); }}>Skip to content</a>
      <motion.main
        id="member-main"
        tabIndex={-1}
        className="member-main min-w-0 pt-20 pb-24 lg:pl-64 lg:pb-8"
        initial={{ opacity: settings.motion === "off" ? 1 : 0, y: reduce ? 0 : 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: settings.motion === "off" ? 0 : 0.3 }}
      >
        {isAdmin && <aside className="member-preview-banner mx-4 md:mx-7 mb-5 flex flex-wrap items-center justify-between gap-3"><div className="flex gap-2 items-center"><ShieldCheck size={17} /><p className="text-xs"><strong>Member view</strong><span className="block sm:inline sm:ml-2 text-muted-foreground">Your own account{role === "admin" ? " · Administrator preview access" : " · Your usual membership access"}</span></p></div><Link to="/admin" className="text-xs font-semibold inline-flex gap-1 items-center">Back to team workspace<ArrowUpRight size={14} /></Link></aside>}
        {(settings.maintenanceMode || settings.announcementBanner) && <div className="mx-4 md:mx-7 mb-5 rounded-xl border border-primary/20 bg-primary/10 text-sm p-3" role="status">{settings.maintenanceMode ? settings.maintenanceMessage : settings.announcementBanner}</div>}
        {children}
      </motion.main>
    </div>
  );
}
