import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell, X, Check, CheckCheck, Trash2, Settings2,
  Dumbbell, UtensilsCrossed, TrendingUp, Trophy, Zap,
  Filter,
} from "lucide-react";
import type { AppNotification, NotifCategory } from "@/hooks/useNotifications";

/* ────────────────── TYPES ────────────────── */
interface Props {
  open: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  unreadCount: number;
  activeFilter: NotifCategory | "all";
  onFilterChange: (f: NotifCategory | "all") => void;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onDismiss: (id: string) => void;
  onDismissAll: () => void;
  formatTime: (d: Date) => string;
}

/* ────────────────── CATEGORY CONFIG ────────────────── */
const CATEGORIES: { value: NotifCategory | "all"; label: string; icon: any; color: string }[] = [
  { value: "all",       label: "All",        icon: Bell,             color: "#2563eb" },
  { value: "workout",   label: "Workouts",   icon: Dumbbell,         color: "#06b6d4" },
  { value: "nutrition", label: "Nutrition",  icon: UtensilsCrossed,  color: "#10b981" },
  { value: "progress",  label: "Progress",   icon: TrendingUp,       color: "#8b5cf6" },
  { value: "challenge", label: "Challenges", icon: Trophy,           color: "#f59e0b" },
  { value: "system",    label: "System",     icon: Zap,              color: "#6b7280" },
];

function getCategoryConfig(cat: NotifCategory) {
  return CATEGORIES.find(c => c.value === cat) || CATEGORIES[0];
}

/* ────────────────── SINGLE NOTIFICATION ITEM ────────────────── */
function NotifItem({ notif, onMarkRead, onDismiss, formatTime, onClose }: {
  notif: AppNotification;
  onMarkRead: (id: string) => void;
  onDismiss: (id: string) => void;
  formatTime: (d: Date) => string;
  onClose: () => void;
}) {
  const cfg = getCategoryConfig(notif.category);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20, height: 0, marginBottom: 0, padding: 0 }}
      transition={{ duration: 0.2 }}
      onClick={() => !notif.read && onMarkRead(notif.id)}
      className={`relative group flex gap-3 p-4 rounded-2xl border transition-all cursor-pointer ${
        notif.read
          ? "bg-secondary/20 border-border/40 opacity-70"
          : "bg-secondary/50 border-border hover:border-primary/20 hover:bg-secondary/70"
      }`}
    >
      {/* Unread dot */}
      {!notif.read && (
        <div className="absolute top-4 right-10 w-2 h-2 rounded-full bg-primary animate-pulse" />
      )}

      {/* Category icon */}
      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: `${cfg.color}18` }}>
        <cfg.icon size={16} style={{ color: cfg.color }} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <p className={`text-sm leading-snug ${notif.read ? "font-medium text-muted-foreground" : "font-bold"}`}>
            {notif.title}
          </p>
          <span className="text-[10px] text-muted-foreground/60 whitespace-nowrap flex-shrink-0 mt-0.5">
            {formatTime(notif.timestamp)}
          </span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{notif.body}</p>
        {notif.actionLabel && notif.actionPath && (
          <Link
            to={notif.actionPath}
            onClick={e => { e.stopPropagation(); onMarkRead(notif.id); onClose(); }}
            className="inline-flex items-center gap-1 mt-2 text-xs font-bold text-primary hover:text-primary/80 transition-colors"
          >
            {notif.actionLabel} →
          </Link>
        )}
      </div>

      {/* Dismiss button */}
      <button
        onClick={e => { e.stopPropagation(); onDismiss(notif.id); }}
        className="absolute top-3 right-3 w-6 h-6 rounded-lg bg-secondary/0 hover:bg-destructive/10 flex items-center justify-center text-muted-foreground/0 group-hover:text-muted-foreground hover:text-destructive transition-all"
        aria-label="Dismiss"
      >
        <X size={12} />
      </button>
    </motion.div>
  );
}

/* ────────────────── MAIN COMPONENT ────────────────── */
export default function NotificationCenter({
  open, onClose, notifications, unreadCount, activeFilter, onFilterChange,
  onMarkRead, onMarkAllRead, onDismiss, onDismissAll, formatTime,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    };
    setTimeout(() => document.addEventListener("mousedown", handler), 10);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const filtered = activeFilter === "all"
    ? notifications
    : notifications.filter(n => n.category === activeFilter);

  const filteredUnread = filtered.filter(n => !n.read).length;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:backdrop-blur-none md:bg-transparent"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, x: 40, scale: 0.97 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, scale: 0.97 }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="fixed z-50 top-0 right-0 bottom-0 md:top-[72px] md:bottom-auto md:right-4 md:rounded-3xl
              w-full sm:w-[400px] max-h-screen md:max-h-[calc(100vh-88px)]
              bg-card border border-border md:shadow-2xl md:shadow-black/40
              flex flex-col overflow-hidden"
          >
            {/* ── Header ── */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Bell size={18} className="text-primary" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] font-black flex items-center justify-center">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </div>
                <div>
                  <h2 className="text-sm font-black">Notifications</h2>
                  {unreadCount > 0
                    ? <p className="text-[10px] text-primary font-semibold">{unreadCount} unread</p>
                    : <p className="text-[10px] text-muted-foreground">All caught up!</p>}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button onClick={onMarkAllRead}
                    title="Mark all read"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-primary hover:bg-primary/10 transition-colors">
                    <CheckCheck size={13} /> All read
                  </button>
                )}
                {notifications.length > 0 && (
                  <button onClick={onDismissAll}
                    title="Clear all"
                    className="p-2 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                    <Trash2 size={14} />
                  </button>
                )}
                <button onClick={onClose}
                  className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors ml-1">
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* ── Category filters ── */}
            <div className="flex gap-1.5 px-4 py-3 border-b border-border/50 overflow-x-auto scrollbar-hide flex-shrink-0">
              {CATEGORIES.map(cat => {
                const count = cat.value === "all"
                  ? notifications.filter(n => !n.read).length
                  : notifications.filter(n => n.category === cat.value && !n.read).length;
                return (
                  <button key={cat.value} onClick={() => onFilterChange(cat.value as any)}
                    className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      activeFilter === cat.value
                        ? "text-primary-foreground shadow-md"
                        : "bg-secondary/60 text-muted-foreground hover:text-foreground"
                    }`}
                    style={activeFilter === cat.value ? { background: cat.color } : {}}>
                    <cat.icon size={11} />
                    {cat.label}
                    {count > 0 && (
                      <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black leading-none ${
                        activeFilter === cat.value ? "bg-white/20 text-white" : "bg-secondary text-muted-foreground"
                      }`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* ── Notification list ── */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {/* Unread section */}
              {filteredUnread > 0 && (
                <>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1 pb-1">
                    New · {filteredUnread}
                  </p>
                  <AnimatePresence>
                    {filtered.filter(n => !n.read).map(n => (
                      <NotifItem key={n.id} notif={n}
                        onMarkRead={onMarkRead} onDismiss={onDismiss}
                        formatTime={formatTime} onClose={onClose} />
                    ))}
                  </AnimatePresence>
                </>
              )}

              {/* Read section */}
              {filtered.some(n => n.read) && (
                <>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1 pb-1 pt-3">
                    Earlier
                  </p>
                  <AnimatePresence>
                    {filtered.filter(n => n.read).map(n => (
                      <NotifItem key={n.id} notif={n}
                        onMarkRead={onMarkRead} onDismiss={onDismiss}
                        formatTime={formatTime} onClose={onClose} />
                    ))}
                  </AnimatePresence>
                </>
              )}

              {/* Empty state */}
              {filtered.length === 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mb-4">
                    <Bell size={24} className="text-muted-foreground/40" />
                  </div>
                  <p className="text-sm font-bold text-muted-foreground">No notifications here</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    {activeFilter === "all"
                      ? "You're all caught up — check back later!"
                      : `No ${activeFilter} notifications yet`}
                  </p>
                </motion.div>
              )}
            </div>

            {/* ── Footer ── */}
            <div className="px-4 py-3 border-t border-border flex-shrink-0">
              <Link to="/settings" onClick={onClose}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-2xl bg-secondary/60 hover:bg-secondary transition-colors text-xs font-semibold text-muted-foreground hover:text-foreground">
                <Settings2 size={13} /> Notification Settings
              </Link>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
