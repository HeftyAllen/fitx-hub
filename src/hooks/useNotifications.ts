import { useState, useCallback, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";

export type NotifCategory = "workout" | "nutrition" | "progress" | "challenge" | "system";

export interface AppNotification {
  id: string;
  category: NotifCategory;
  title: string;
  body: string;
  timestamp: Date;
  read: boolean;
  actionLabel?: string;
  actionPath?: string;
  icon?: string;
}

/* ─────────── PER-USER LOCAL STORAGE ───────────
 * Notifications are namespaced by uid so a new account starts clean
 * and never inherits seeded data from a previous session.
 */
const STORAGE_PREFIX = "fitx_notifications_v2_";

function welcomeSeed(): AppNotification[] {
  // Brand-new account starts with a single welcome notification
  return [
    {
      id: `n_welcome_${Date.now()}`,
      category: "system",
      title: "Welcome to FitX Journey 🚀",
      body: "Set up your goals, plan your first workout and start fuelling your progress.",
      timestamp: new Date(),
      read: false,
      actionLabel: "Get Started",
      actionPath: "/onboarding",
    },
  ];
}

function loadFor(uid: string | null): AppNotification[] {
  if (!uid) return [];
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + uid);
    if (!raw) return welcomeSeed();
    const parsed = JSON.parse(raw) as AppNotification[];
    return parsed.map(n => ({ ...n, timestamp: new Date(n.timestamp) }));
  } catch {
    return welcomeSeed();
  }
}

function saveFor(uid: string | null, list: AppNotification[]) {
  if (!uid) return;
  try { localStorage.setItem(STORAGE_PREFIX + uid, JSON.stringify(list)); } catch { /* ignore */ }
}

export function useNotifications(prefs?: {
  workoutReminders?: boolean;
  challengeAlerts?: boolean;
  progressUpdates?: boolean;
  weeklyReport?: boolean;
}) {
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  const [notifications, setNotifications] = useState<AppNotification[]>(() => loadFor(uid));

  // Reset state whenever the auth user changes (sign in / sign out / new account)
  useEffect(() => {
    setNotifications(loadFor(uid));
  }, [uid]);

  // Persist on every change, scoped per-user
  useEffect(() => { saveFor(uid, notifications); }, [uid, notifications]);

  const filteredByPrefs = useMemo(() => {
    if (!prefs) return notifications;
    return notifications.filter(n => {
      if (n.category === "workout"   && prefs.workoutReminders === false) return false;
      if (n.category === "challenge" && prefs.challengeAlerts  === false) return false;
      if (n.category === "progress"  && prefs.progressUpdates  === false) return false;
      return true;
    });
  }, [notifications, prefs]);

  const unreadCount = filteredByPrefs.filter(n => !n.read).length;

  const markRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const dismiss = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const dismissAll = useCallback(() => setNotifications([]), []);

  const pushNotification = useCallback((notif: Omit<AppNotification, "id" | "timestamp" | "read">) => {
    const newNotif: AppNotification = {
      ...notif,
      id: `n_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date(),
      read: false,
    };
    setNotifications(prev => [newNotif, ...prev]);
  }, []);

  const formatTime = (date: Date): string => {
    const diff = Date.now() - date.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days === 1) return "Yesterday";
    return `${days}d ago`;
  };

  return {
    notifications: filteredByPrefs,
    unreadCount,
    markRead,
    markAllRead,
    dismiss,
    dismissAll,
    pushNotification,
    formatTime,
  };
}
