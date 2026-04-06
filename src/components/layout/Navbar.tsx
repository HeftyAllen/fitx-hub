import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import logo from "@/assets/logo.png";
import {
  LayoutDashboard, Dumbbell, UtensilsCrossed, TrendingUp,
  Trophy, Calendar, Award, Settings, LogOut, Bell,
} from "lucide-react";
import NotificationCenter from "@/components/notifications/NotificationCenter";
import { useNotifications, type NotifCategory } from "@/hooks/useNotifications";

const navLinks = [
  { to: "/dashboard",       label: "Dashboard", icon: LayoutDashboard },
  { to: "/workout-planner", label: "Workout",   icon: Dumbbell },
  { to: "/nutrition",       label: "Nutrition", icon: UtensilsCrossed },
  { to: "/progress",        label: "Progress",  icon: TrendingUp },
  { to: "/records",         label: "Records",   icon: Trophy },
  { to: "/calendar",        label: "Calendar",  icon: Calendar },
  { to: "/rewards",         label: "Rewards",   icon: Award },
];

export default function Navbar() {
  const { pathname } = useLocation();
  const { user, userProfile, logout } = useAuth();

  const [notifOpen, setNotifOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<NotifCategory | "all">("all");

  const prefs = userProfile ? {
    workoutReminders: (userProfile as any).notifications?.workoutReminders,
    challengeAlerts:  (userProfile as any).notifications?.challengeAlerts,
    progressUpdates:  (userProfile as any).notifications?.progressUpdates,
    weeklyReport:     (userProfile as any).notifications?.weeklyReport,
  } : undefined;

  const {
    notifications, unreadCount,
    markRead, markAllRead,
    dismiss, dismissAll,
    formatTime,
  } = useNotifications(prefs);

  if (!user) return null;

  const avatarLetter = userProfile?.name?.[0]?.toUpperCase()
    || user.email?.[0]?.toUpperCase()
    || "U";

  return (
    <>
      {/* ── Desktop Navbar ── */}
      <nav className="hidden md:flex fixed top-0 left-0 right-0 z-50 h-16 items-center justify-between px-6 bg-background/80 backdrop-blur-xl border-b border-border">
        <Link to="/dashboard" className="flex items-center gap-2">
          <img src={logo} alt="FitX Journey" className="h-9 w-auto" />
        </Link>

        <div className="flex items-center gap-1">
          {navLinks.map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 hover:bg-primary/10 ${
                pathname.startsWith(to) ? "text-primary bg-primary/10" : "text-muted-foreground"
              }`}>
              <Icon size={16} />
              <span>{label}</span>
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {/* Bell / notification trigger */}
          <button
            onClick={() => setNotifOpen(o => !o)}
            aria-label="Notifications"
            className={`relative p-2 rounded-xl transition-all ${
              notifOpen
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`}
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] font-black flex items-center justify-center leading-none">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {/* Avatar → Settings */}
          <Link to="/settings" aria-label="Settings"
            className="w-8 h-8 rounded-full gradient-bg flex items-center justify-center text-sm font-bold text-primary-foreground hover:scale-105 transition-transform overflow-hidden">
            {(userProfile as any)?.photoURL
              ? <img src={(userProfile as any).photoURL} alt="avatar" className="w-full h-full object-cover" />
              : avatarLetter}
          </Link>

          {/* Logout */}
          <button onClick={logout} aria-label="Log out"
            className="p-2 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
            <LogOut size={18} />
          </button>
        </div>
      </nav>

      {/* ── Mobile Bottom Nav ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 h-16 flex items-center justify-around bg-background/90 backdrop-blur-xl border-t border-border px-2">
        {[
          { to: "/dashboard",       icon: LayoutDashboard, label: "Home" },
          { to: "/workout-planner", icon: Dumbbell,        label: "Workout" },
          { to: "/nutrition",       icon: UtensilsCrossed, label: "Nutrition" },
          { to: "/progress",        icon: TrendingUp,      label: "Progress" },
          { to: "/settings",        icon: Settings,        label: "Profile" },
        ].map(({ to, icon: Icon, label }) => (
          <Link key={to} to={to}
            className={`flex flex-col items-center gap-1 text-xs transition-colors px-2 py-1 ${
              pathname.startsWith(to) ? "text-primary" : "text-muted-foreground"
            }`}>
            <Icon size={20} />
            <span>{label}</span>
          </Link>
        ))}

        {/* Mobile bell */}
        <button
          onClick={() => setNotifOpen(o => !o)}
          aria-label="Notifications"
          className={`relative flex flex-col items-center gap-1 text-xs transition-colors px-2 py-1 ${
            notifOpen ? "text-primary" : "text-muted-foreground"
          }`}
        >
          <div className="relative">
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[8px] font-black flex items-center justify-center leading-none">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </div>
          <span>Alerts</span>
        </button>
      </nav>

      {/* ── Notification Center ── */}
      <NotificationCenter
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        notifications={notifications}
        unreadCount={unreadCount}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        onMarkRead={markRead}
        onMarkAllRead={markAllRead}
        onDismiss={dismiss}
        onDismissAll={dismissAll}
        formatTime={formatTime}
      />
    </>
  );
}
