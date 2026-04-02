import AppLayout from "@/components/layout/AppLayout";
import { motion } from "framer-motion";
import { Lock, Award } from "lucide-react";

const BADGES = [
  { id: "7day", name: "7-Day Warrior", desc: "Work out 7 days in a row", icon: "🔥", earned: false },
  { id: "30day", name: "30-Day Legend", desc: "30-day workout streak", icon: "🏆", earned: false },
  { id: "firstpr", name: "First PR", desc: "Set your first personal record", icon: "💪", earned: false },
  { id: "macro", name: "Macro Master", desc: "Hit macro targets 7 days straight", icon: "🎯", earned: false },
  { id: "hydration", name: "Hydration Hero", desc: "8 glasses of water for 7 days", icon: "💧", earned: false },
  { id: "explorer", name: "Exercise Explorer", desc: "Try 50 different exercises", icon: "🧭", earned: false },
  { id: "photo", name: "First Photo", desc: "Upload your first progress photo", icon: "📸", earned: false },
  { id: "recipe10", name: "Recipe Collector", desc: "Save 10 recipes", icon: "📖", earned: false },
];

export default function Rewards() {
  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
        <h1 className="text-2xl font-heading font-bold">Rewards</h1>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5 text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Level 1</p>
          <h2 className="text-xl font-heading font-bold gradient-text">Beginner</h2>
          <div className="mt-3 h-2 bg-secondary rounded-full overflow-hidden max-w-xs mx-auto">
            <div className="h-full gradient-bg rounded-full" style={{ width: "0%" }} />
          </div>
          <p className="text-xs text-muted-foreground mt-2">0 / 500 XP</p>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {BADGES.map((badge, i) => (
            <motion.div
              key={badge.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`glass-card p-4 text-center ${!badge.earned && "opacity-50"}`}
            >
              <div className="text-3xl mb-2">{badge.earned ? badge.icon : ""}</div>
              {!badge.earned && <Lock size={24} className="mx-auto mb-2 text-muted-foreground" />}
              <p className="text-xs font-heading font-bold">{badge.name}</p>
              <p className="text-xs text-muted-foreground mt-1">{badge.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
