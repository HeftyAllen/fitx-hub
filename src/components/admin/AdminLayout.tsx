import { useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Users, FileText, Activity, Megaphone,
  LifeBuoy, Settings as SettingsIcon, BarChart3, Home, ShieldCheck, LogOut,
  Menu, X, Eye,
} from "lucide-react";
import { useAdmin } from "@/hooks/useAdmin";
import { useAuth } from "@/contexts/AuthContext";
import { useBrand } from "@/contexts/SiteSettingsContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { ROLE_META, SECTION_PATH, type AdminSection } from "@/lib/permissions";
import logoFallback from "@/assets/logo.png";

const SECTION_META: Record<AdminSection, { label: string; icon: any; end?: boolean }> = {
  overview:      { label: "Overview",      icon: LayoutDashboard, end: true },
  users:         { label: "Users",         icon: Users },
  content:       { label: "Content",       icon: FileText },
  activity:      { label: "Activity",      icon: Activity },
  announcements: { label: "Announcements", icon: Megaphone },
  support:       { label: "Support",       icon: LifeBuoy },
  reports:       { label: "Reports",       icon: BarChart3 },
  settings:      { label: "Settings",      icon: SettingsIcon },
};

export default function AdminLayout() {
  const { role, sections, canWrite } = useAdmin();
  const { user, logout } = useAuth();
  const brand = useBrand(logoFallback);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const roleMeta = role ? ROLE_META[role] : null;

  const handleLogout = async () => {
    try {
      await logout();
      toast.success("Signed out");
      navigate("/", { replace: true });
    } catch (e: any) {
      toast.error(e.message ?? "Sign out failed");
    }
  };

  const nav = (
    <nav className="flex flex-col gap-1 flex-1">
      {sections.map((s) => {
        const { label, icon: Icon, end } = SECTION_META[s];
        return (
          <NavLink
            key={s}
            to={SECTION_PATH[s]}
            end={end}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.span
                    layoutId="admin-active"
                    className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-full bg-primary"
                  />
                )}
                <Icon size={16} />
                {label}
              </>
            )}
          </NavLink>
        );
      })}
    </nav>
  );

  const sidebarInner = (
    <>
      <Link to="/" className="flex items-center gap-2 mb-5">
        {brand.logo
          ? <img src={brand.logo} alt={brand.name} className="h-8 w-auto max-w-[140px] object-contain" />
          : <span className="font-black tracking-tight">{brand.name}</span>}
      </Link>

      <div className="px-3 py-3 mb-4 rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/20">
        <div className="flex items-center gap-2">
          <ShieldCheck size={18} className="text-primary shrink-0" />
          <div className="min-w-0">
            <div className="text-sm font-bold truncate">{roleMeta?.label ?? "Console"}</div>
            <div className="text-[10px] text-muted-foreground leading-tight">{roleMeta?.blurb}</div>
          </div>
        </div>
        {!canWrite && (
          <Badge variant="outline" className="mt-2 text-[10px] gap-1">
            <Eye size={10} /> View only
          </Badge>
        )}
      </div>

      {nav}

      <div className="mt-4 pt-4 border-t border-border space-y-2">
        <Link to="/dashboard" className="flex items-center gap-2 px-3 text-xs text-muted-foreground hover:text-foreground">
          <Home size={13} /> Back to app
        </Link>
        <div className="px-3 text-xs text-muted-foreground truncate" title={user?.email ?? ""}>
          {user?.email}
        </div>
        <Button variant="outline" size="sm" className="w-full justify-start gap-2" onClick={handleLogout}>
          <LogOut size={14} /> Sign out
        </Button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Mobile top bar */}
      <div className="lg:hidden sticky top-0 z-40 flex items-center justify-between h-14 px-4 border-b border-border bg-background/85 backdrop-blur-xl">
        <div className="flex items-center gap-2 min-w-0">
          {brand.logo && <img src={brand.logo} alt="" className="h-6 w-auto object-contain" />}
          <span className="text-sm font-bold truncate">{roleMeta?.label ?? "Console"}</span>
        </div>
        <Button size="icon" variant="ghost" onClick={() => setMobileOpen(true)} aria-label="Open menu">
          <Menu size={18} />
        </Button>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            className="lg:hidden fixed inset-0 z-50 bg-background/70 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setMobileOpen(false)}
          >
            <motion.aside
              className="absolute left-0 top-0 h-full w-[270px] bg-card border-r border-border p-4 flex flex-col"
              initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }}
              transition={{ type: "spring", damping: 26, stiffness: 260 }}
              onClick={(e) => e.stopPropagation()}
            >
              <Button size="icon" variant="ghost" className="absolute right-2 top-2"
                onClick={() => setMobileOpen(false)} aria-label="Close menu">
                <X size={16} />
              </Button>
              {sidebarInner}
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-[264px_1fr] min-h-screen">
        <aside className="hidden lg:flex border-r border-border bg-card/30 backdrop-blur-xl p-4 sticky top-0 h-screen flex-col">
          {sidebarInner}
        </aside>

        <main className="p-4 md:p-8 max-w-[1400px] w-full">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
  );
}
