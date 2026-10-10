import { useState } from "react";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  FileText,
  Activity,
  Megaphone,
  LifeBuoy,
  Settings,
  BarChart3,
  ArrowUpRight,
  ShieldCheck,
  LogOut,
  Menu,
  Dumbbell,
  Sun,
  Moon,
  ChevronRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAdmin } from "@/hooks/useAdmin";
import { useAuth } from "@/contexts/AuthContext";
import { useBrand } from "@/contexts/SiteSettingsContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ROLE_META, SECTION_PATH, type AdminSection } from "@/lib/permissions";
import { toast } from "sonner";
import SyncStatus from "@/components/SyncStatus";
import { memberGreetingName } from "@/lib/member-identity";
import logoFallback from "@/assets/logo.png";

export const SECTION_META: Record<
  AdminSection,
  { label: string; icon: LucideIcon; desc: string }
> = {
  overview: {
    label: "My workspace",
    icon: LayoutDashboard,
    desc: "Your priorities, in one place",
  },
  users: {
    label: "Members & team",
    icon: Users,
    desc: "Manage membership and access",
  },
  coaching: {
    label: "My members",
    icon: Dumbbell,
    desc: "Assignments and coaching check-ins",
  },
  content: {
    label: "Plan studio",
    icon: FileText,
    desc: "Build and publish training and meal plans",
  },
  activity: {
    label: "Activity trail",
    icon: Activity,
    desc: "Review recorded platform activity",
  },
  announcements: {
    label: "Announcements",
    icon: Megaphone,
    desc: "Keep the community informed",
  },
  support: {
    label: "Support inbox",
    icon: LifeBuoy,
    desc: "Reply to tickets and follow up",
  },
  reports: {
    label: "Reports",
    icon: BarChart3,
    desc: "Explore real recorded data",
  },
  settings: {
    label: "Platform settings",
    icon: Settings,
    desc: "Branding and platform controls",
  },
};

export default function AdminLayout() {
  const { role, sections } = useAdmin();
  const { user, userProfile, logout } = useAuth();
  const name = memberGreetingName(userProfile, user?.displayName) || "Your account";
  const { theme, toggleTheme } = useTheme();
  const brand = useBrand(logoFallback);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const meta = ROLE_META[role ?? "readonly"];
  const active =
    sections.find((s) => SECTION_PATH[s] === pathname) ?? "overview";
  const signOut = async () => {
    try {
      await logout();
      navigate("/", { replace: true });
    } catch {
      toast.error("Could not sign out. Try again.");
    }
  };
  const sidebar = (
    <>
      <Link to="/admin" className="flex items-center gap-3 px-2 py-3 mb-7">
        <img
          src={brand.logo || logoFallback}
          alt=""
          className="h-10 w-10 rounded-xl object-contain"
        />
        <div>
          <p className="font-extrabold tracking-tight">{brand.name}</p>
          <p className="text-[10px] uppercase tracking-[.2em] text-muted-foreground">
            Team workspace
          </p>
        </div>
      </Link>
      <div className="rounded-2xl border border-border bg-secondary/50 p-4 mb-6">
        <ShieldCheck size={18} className="workspace-accent mb-3" />
        <p className="text-sm font-bold">{meta.workspace}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {meta.label}
          {role === "readonly" ? " · View only" : ""}
        </p>
      </div>
      <p className="text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground px-3 mb-3">
        Workspace
      </p>
      <nav aria-label={`${meta.label} navigation`} className="space-y-1 flex-1">
        {sections.map((s) => {
          const { icon: Icon, label } = SECTION_META[s];
          return (
            <NavLink
              key={s}
              to={SECTION_PATH[s]}
              end={s === "overview"}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition-colors ${isActive ? "workspace-nav-active font-semibold" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`
              }
            >
              <Icon size={18} />
              <span>
                {s === "users" && role === "moderator"
                  ? "Member safety"
                  : s === "coaching" && role === "admin"
                    ? "Coach assignments"
                    : label}
              </span>
            </NavLink>
          );
        })}
      </nav>
      <div className="border-t border-border pt-5 mt-8 space-y-4">
        <Link
          to="/dashboard?view=member"
          onClick={() => setMobileOpen(false)}
          className="flex items-center justify-between text-xs text-muted-foreground px-3 hover:text-foreground"
        >
          Member view <ArrowUpRight size={14} />
        </Link>
        <div className="flex items-center gap-3 px-3">
          <span className="h-9 w-9 rounded-full bg-secondary grid place-items-center font-bold workspace-accent">
            {name[0].toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold">
              {name}
            </p>
            <p className="text-[10px] text-muted-foreground">{meta.label}</p>
          </div>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Sign out"
            onClick={signOut}
          >
            <LogOut size={15} />
          </Button>
        </div>
      </div>
    </>
  );
  return (
    <div
      className="workspace-shell min-h-screen bg-background"
      data-role={role}
    >
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 border-r border-border bg-card p-5 flex-col z-40 overflow-y-auto">
        {sidebar}
      </aside>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="workspace-shell flex flex-col w-72 px-5"
          data-role={role}
        >
          <SheetTitle className="sr-only">
            {meta.workspace} navigation
          </SheetTitle>
          <SheetDescription className="sr-only">
            Navigate to the tools available to your role.
          </SheetDescription>
          {sidebar}
        </SheetContent>
      </Sheet>
      <div className="lg:pl-64">
        <header className="h-20 border-b border-border flex items-center justify-between gap-3 px-4 md:px-8 bg-card/70 backdrop-blur-xl sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              className="lg:hidden shrink-0"
              size="icon"
              variant="ghost"
              aria-label="Open workspace menu"
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={20} />
            </Button>
            <span className="text-sm text-muted-foreground hidden sm:block">
              {meta.workspace}
            </span>
            <ChevronRight
              size={14}
              className="text-muted-foreground hidden sm:block"
            />
            <span className="text-sm font-semibold truncate">
              {SECTION_META[active].label}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/dashboard?view=member" className="workspace-member-switch"><Dumbbell size={15} /><span className="hidden sm:inline">Member view</span></Link>
            <SyncStatus compact />
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              onClick={toggleTheme}
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </Button>
          </div>
        </header>
        <main
          id="main-content"
          className="max-w-[1440px] mx-auto p-4 md:p-8 lg:p-10"
        >
          <Outlet />
        </main>
        <footer className="flex flex-wrap gap-3 justify-between px-8 py-6 text-[11px] text-muted-foreground">
          <span>
            {brand.name} · {meta.label} workspace
          </span>
          <span>Access is based on your assigned role</span>
        </footer>
      </div>
    </div>
  );
}
