import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import {
  collection, getDocs, setDoc, doc, Timestamp, getDoc,
} from "firebase/firestore";

export interface ChallengeTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  type: "workouts" | "streak" | "volume" | "prs";
  target: number;
  targetLabel: string;
  xpReward: number;
  difficulty: "Easy" | "Medium" | "Hard" | "Extreme";
  color: string;
}

export interface JoinedChallenge {
  challengeId: string;
  joinedAt: Timestamp;
  completedAt?: Timestamp;
  xpAwarded?: boolean;
}

export interface ChallengeWithProgress extends ChallengeTemplate {
  joined: boolean;
  completed: boolean;
  progress: number;
  joinedAt?: Timestamp;
  completedAt?: Timestamp;
}

export const CHALLENGE_TEMPLATES: ChallengeTemplate[] = [
  {
    id: "first-workout",
    name: "First Steps",
    description: "Complete your very first workout",
    icon: "👟",
    type: "workouts",
    target: 1,
    targetLabel: "workout",
    xpReward: 50,
    difficulty: "Easy",
    color: "from-green-500 to-emerald-600",
  },
  {
    id: "5-workouts",
    name: "Iron Week",
    description: "Complete 5 workouts total",
    icon: "🏋️",
    type: "workouts",
    target: 5,
    targetLabel: "workouts",
    xpReward: 100,
    difficulty: "Easy",
    color: "from-blue-500 to-cyan-500",
  },
  {
    id: "10-workouts",
    name: "Dedicated Athlete",
    description: "Complete 10 workouts",
    icon: "💪",
    type: "workouts",
    target: 10,
    targetLabel: "workouts",
    xpReward: 250,
    difficulty: "Medium",
    color: "from-purple-500 to-violet-600",
  },
  {
    id: "30-workouts",
    name: "30 Workouts Club",
    description: "Complete 30 workouts",
    icon: "🏆",
    type: "workouts",
    target: 30,
    targetLabel: "workouts",
    xpReward: 750,
    difficulty: "Hard",
    color: "from-orange-500 to-amber-500",
  },
  {
    id: "7day-streak",
    name: "7-Day Warrior",
    description: "Work out 7 days in a row",
    icon: "🔥",
    type: "streak",
    target: 7,
    targetLabel: "day streak",
    xpReward: 200,
    difficulty: "Medium",
    color: "from-red-500 to-orange-500",
  },
  {
    id: "30day-streak",
    name: "30-Day Legend",
    description: "Work out 30 days in a row",
    icon: "⚡",
    type: "streak",
    target: 30,
    targetLabel: "day streak",
    xpReward: 1000,
    difficulty: "Extreme",
    color: "from-yellow-500 to-amber-600",
  },
  {
    id: "first-pr",
    name: "PR Setter",
    description: "Set your first personal record",
    icon: "🎯",
    type: "prs",
    target: 1,
    targetLabel: "PR",
    xpReward: 100,
    difficulty: "Easy",
    color: "from-cyan-500 to-blue-500",
  },
  {
    id: "5-prs",
    name: "Record Breaker",
    description: "Set 5 personal records",
    icon: "💫",
    type: "prs",
    target: 5,
    targetLabel: "PRs",
    xpReward: 300,
    difficulty: "Medium",
    color: "from-pink-500 to-rose-600",
  },
  {
    id: "volume-10k",
    name: "10K Club",
    description: "Lift 10,000 kg total volume",
    icon: "🏗️",
    type: "volume",
    target: 10000,
    targetLabel: "kg",
    xpReward: 200,
    difficulty: "Medium",
    color: "from-teal-500 to-cyan-600",
  },
  {
    id: "volume-100k",
    name: "Volume King",
    description: "Lift 100,000 kg total volume",
    icon: "👑",
    type: "volume",
    target: 100000,
    targetLabel: "kg",
    xpReward: 1000,
    difficulty: "Extreme",
    color: "from-amber-500 to-yellow-600",
  },
];

export function useChallenges() {
  const { user } = useAuth();
  const [challenges, setChallenges] = useState<ChallengeWithProgress[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchChallenges = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [joinedSnap, logsSnap, prsSnap, calSnap] = await Promise.all([
        getDocs(collection(db, "users", user.uid, "joinedChallenges")),
        getDocs(collection(db, "users", user.uid, "workoutLogs")),
        getDocs(collection(db, "users", user.uid, "personalRecords")),
        getDocs(collection(db, "users", user.uid, "calendarEntries")),
      ]);

      const joined: Record<string, JoinedChallenge> = {};
      joinedSnap.docs.forEach(d => { joined[d.id] = { challengeId: d.id, ...d.data() } as JoinedChallenge; });

      const workoutCount = logsSnap.docs.length;
      const totalVolume = logsSnap.docs.reduce((s, d) => s + ((d.data().totalVolume as number) || 0), 0);
      const prCount = prsSnap.docs.length;

      // Streak calc from calendar entries
      const completedDates = new Set(
        calSnap.docs.filter(d => d.data().completed).map(d => d.data().date as string)
      );
      let streak = 0;
      const today = new Date();
      for (let i = 0; i < 365; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split("T")[0];
        if (completedDates.has(dateStr)) streak++;
        else if (i > 0) break;
      }

      const getProgress = (type: ChallengeTemplate["type"]): number => {
        if (type === "workouts") return workoutCount;
        if (type === "streak") return streak;
        if (type === "volume") return totalVolume;
        if (type === "prs") return prCount;
        return 0;
      };

      const result: ChallengeWithProgress[] = CHALLENGE_TEMPLATES.map(tmpl => {
        const j = joined[tmpl.id];
        const progress = getProgress(tmpl.type);
        const completed = j?.completedAt != null || (j != null && progress >= tmpl.target);
        return {
          ...tmpl,
          joined: !!j,
          completed,
          progress,
          joinedAt: j?.joinedAt,
          completedAt: j?.completedAt,
        };
      });

      setChallenges(result);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchChallenges(); }, [fetchChallenges]);

  const joinChallenge = async (challengeId: string) => {
    if (!user) return;
    await setDoc(doc(db, "users", user.uid, "joinedChallenges", challengeId), {
      joinedAt: Timestamp.now(),
    });
    setChallenges(prev => prev.map(c =>
      c.id === challengeId ? { ...c, joined: true, joinedAt: Timestamp.now() } : c
    ));
  };

  const completeChallenge = async (challengeId: string) => {
    if (!user) return;
    const ref = doc(db, "users", user.uid, "joinedChallenges", challengeId);
    const existing = await getDoc(ref);
    if (existing.exists() && !existing.data().completedAt) {
      await setDoc(ref, { ...existing.data(), completedAt: Timestamp.now(), xpAwarded: true }, { merge: true });
    }
    setChallenges(prev => prev.map(c =>
      c.id === challengeId ? { ...c, completed: true, completedAt: Timestamp.now() } : c
    ));
  };

  return { challenges, loading, fetchChallenges, joinChallenge, completeChallenge };
}
