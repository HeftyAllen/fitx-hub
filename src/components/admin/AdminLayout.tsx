import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Users, FileText, Activity, Megaphone,
  LifeBuoy, Settings as SettingsIcon, BarChart3, Home, ShieldCheck, LogOut,
} from "lucide-react";
import { useAdmin } from "@/hooks/useAdmin";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { toast } from "sonner";

const links = [
  { to: "/admin",               label: "Overview",      icon: LayoutDashboard, end: true },
  { to: "/admin/users",         label: "Users",         icon: Users },
  { to: "/admin/content",       label: "Content",       icon: FileText },
  { to: "/admin/activity",      label: "Activity",      icon: Activity },
  { to: "/admin/announcements", label: "Announcements", icon: Megaphone },
  { to: "/admin/support",       label: "Support",       icon: LifeBuoy },
  { to: "/admin/reports",       label: "Reports",       icon: BarChart3 },
  { to: "/admin/settings",      label: "Settings",      icon: SettingsIcon },
];

export default function AdminLayout() {
  const { role } = useAdmin();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const handleLogout = async () => {
    try {
      await logout();
      toast.success("Signed out");
      navigate("/", { replace: true });
    } catch (e: any) {
      toast.error(e.message ?? "Sign out failed");
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] min-h-screen">
        {/* Sidebar */}
        <aside className="border-r border-border bg-card/30 backdrop-blur-xl p-4 lg:sticky lg:top-0 lg:h-screen flex flex-col">
          <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
            <Home size={14} /> Home
          </Link>

          <div className="flex items-center gap-2 px-3 py-3 mb-4 rounded-xl bg-primary/10 border border-primary/20">
            <ShieldCheck size={18} className="text-primary" />
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">Admin Console</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{role ?? "—"}</div>
            </div>
          </div>

          <nav className="flex flex-col gap-1 flex-1">
            {links.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`
                }
              >
                <Icon size={16} />
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="mt-4 pt-4 border-t border-border space-y-2">
            <div className="px-3 text-xs text-muted-foreground truncate" title={user?.email ?? ""}>
              {user?.email}
            </div>
            <Button variant="outline" size="sm" className="w-full justify-start gap-2" onClick={handleLogout}>
              <LogOut size={14} /> Sign out
            </Button>
          </div>
        </aside>

        {/* Main */}
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
