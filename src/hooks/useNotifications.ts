import { useState, useCallback, useEffect } from "react";

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

const SEED_NOTIFICATIONS: AppNotification[] = [
  {
    id: "n1",
    category: "workout",
    title: "Workout Reminder 💪",
    body: "You have a Leg Day session scheduled for today at 6:00 PM. Ready to crush it?",
    timestamp: new Date(Date.now() - 1000 * 60 * 20),
    read: false,
    actionLabel: "Start Session",
    actionPath: "/workout-session",
  },
  {
    id: "n2",
    category: "challenge",
    title: "Challenge Unlocked 🏆",
    body: "You've completed 3 workouts this week — you've earned the 'Hat Trick' badge!",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
    read: false,
    actionLabel: "View Rewards",
    actionPath: "/rewards",
  },
  {
    id: "n3",
    category: "nutrition",
    title: "Meal Reminder 🥗",
    body: "Lunch time! You're 800 calories below your daily target. Log your meal to stay on track.",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3),
    read: false,
    actionLabel: "Log Food",
    actionPath: "/nutrition",
  },
  {
    id: "n4",
    category: "progress",
    title: "New Personal Record! 🎉",
    body: "You just hit a new PR on Bench Press: 100 kg × 5 reps. Keep pushing!",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5),
    read: true,
    actionLabel: "View Records",
    actionPath: "/records",
  },
  {
    id: "n5",
    category: "progress",
    title: "Weekly Report Ready 📊",
    body: "Your week 14 report is in: 4 workouts, 2,800 kcal avg/day, weight down 0.4 kg.",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24),
    read: true,
    actionLabel: "View Progress",
    actionPath: "/progress",
  },
  {
    id: "n6",
    category: "challenge",
    title: "Challenge Expiring Soon ⏳",
    body: "The '10,000 Steps Daily' challenge ends in 2 days. You're 68% there — finish strong!",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 26),
    read: true,
    actionLabel: "View Challenge",
    actionPath: "/rewards",
  },
  {
    id: "n7",
    category: "nutrition",
    title: "Protein Goal Achieved ✅",
    body: "You hit your protein target of 150g today. Your muscles will thank you!",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48),
    read: true,
    actionLabel: "View Nutrition",
    actionPath: "/nutrition",
  },
  {
    id: "n8",
    category: "workout",
    title: "Streak Alert 🔥",
    body: "You've worked out 5 days in a row! One more day to earn the 'Iron Week' badge.",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 72),
    read: true,
    actionLabel: "View Rewards",
    actionPath: "/rewards",
  },
  {
    id: "n9",
    category: "system",
    title: "FitX Journey Update 🚀",
    body: "New features added: Before/After photo compare, recipe meal logging, and improved charts.",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 96),
    read: true,
  },
];

export function useNotifications(prefs?: {
  workoutReminders?: boolean;
  challengeAlerts?: boolean;
  progressUpdates?: boolean;
  weeklyReport?: boolean;
}) {
  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    // Filter seeded notifications based on preferences
    return SEED_NOTIFICATIONS.filter(n => {
      if (!prefs) return true;
      if (n.category === "workout" && prefs.workoutReminders === false) return false;
      if (n.category === "challenge" && prefs.challengeAlerts === false) return false;
      if (n.category === "progress" && prefs.progressUpdates === false) return false;
      return true;
    });
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  const markRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const dismiss = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const pushNotification = useCallback((notif: Omit<AppNotification, "id" | "timestamp" | "read">) => {
    const newNotif: AppNotification = {
      ...notif,
      id: `n_${Date.now()}`,
      timestamp: new Date(),
      read: false,
    };
    setNotifications(prev => [newNotif, ...prev]);
  }, []);

  // Format relative timestamp
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
    notifications,
    unreadCount,
    markRead,
    markAllRead,
    dismiss,
    dismissAll,
    pushNotification,
    formatTime,
  };
}
