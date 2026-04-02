import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/layout/AppLayout";
import { motion } from "framer-motion";
import { Plus, Dumbbell, UtensilsCrossed, Scale, Trophy, Droplets } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";

const QUOTES = [
  "The only bad workout is the one that didn't happen.",
  "Your body can stand almost anything. It's your mind you have to convince.",
  "Success isn't always about greatness. It's about consistency.",
  "The pain you feel today will be the strength you feel tomorrow.",
];

function MacroRing({ value, max, label, color }: { value: number; max: number; label: string; color: string }) {
  const pct = Math.min((value / max) * 100, 100);
  const radius = 40;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (pct / 100) * circ;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="hsl(var(--secondary))" strokeWidth="8" />
        <motion.circle
          cx="50" cy="50" r={radius} fill="none" stroke={color} strokeWidth="8"
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: "easeOut" }}
          transform="rotate(-90 50 50)"
        />
        <text x="50" y="46" textAnchor="middle" className="fill-foreground text-lg font-bold" fontSize="16">{value}</text>
        <text x="50" y="62" textAnchor="middle" className="fill-muted-foreground" fontSize="10">/ {max}</text>
      </svg>
      <span className="text-xs text-muted-foreground font-medium">{label}</span>
    </div>
  );
}

function WaterTracker() {
  const [glasses, setGlasses] = useState(0);
  const goal = 8;
  return (
    <div className="glass-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-heading font-bold uppercase tracking-wider text-muted-foreground">Water Intake</h3>
        <Droplets size={16} className="text-accent" />
      </div>
      <div className="flex gap-1.5">
        {Array.from({ length: goal }).map((_, i) => (
          <motion.div
            key={i}
            className={`h-8 flex-1 rounded-lg cursor-pointer transition-colors ${i < glasses ? "bg-accent" : "bg-secondary"}`}
            onClick={() => setGlasses(i + 1 === glasses ? i : i + 1)}
            whileTap={{ scale: 0.9 }}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{glasses} / {goal} glasses</p>
    </div>
  );
}

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.08 } } };
const fadeUp = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

export default function Dashboard() {
  const { user, userProfile } = useAuth();
  const name = userProfile?.name || user?.displayName || "Athlete";
  const quote = QUOTES[Math.floor(Math.random() * QUOTES.length)];

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
        {/* Greeting */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible" className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-heading font-bold">
              Hey, <span className="gradient-text">{name}</span> 👋
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Let's crush it today</p>
          </div>
          <div className="flex items-center gap-2 glass-card px-4 py-2">
            <span className="text-lg">🔥</span>
            <span className="text-sm font-bold">0 Day Streak</span>
          </div>
        </motion.div>

        <motion.div variants={stagger} initial="hidden" animate="visible" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Macros */}
          <motion.div variants={fadeUp} className="glass-card p-5 md:col-span-2 lg:col-span-1">
            <h3 className="text-sm font-heading font-bold uppercase tracking-wider text-muted-foreground mb-4">Today's Macros</h3>
            <div className="flex justify-around">
              <MacroRing value={0} max={2200} label="Calories" color="#2563EB" />
              <MacroRing value={0} max={150} label="Protein" color="#06B6D4" />
              <MacroRing value={0} max={250} label="Carbs" color="#FACC15" />
            </div>
          </motion.div>

          {/* Today's Workout */}
          <motion.div variants={fadeUp} className="glass-card p-5">
            <h3 className="text-sm font-heading font-bold uppercase tracking-wider text-muted-foreground mb-3">Today's Workout</h3>
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <Dumbbell size={32} className="text-muted-foreground mb-2" />
              <p className="text-muted-foreground text-sm">No workout scheduled</p>
              <Link to="/workout-planner" className="mt-3 text-xs text-primary hover:underline font-medium">
                Plan a workout →
              </Link>
            </div>
          </motion.div>

          {/* Water */}
          <motion.div variants={fadeUp}>
            <WaterTracker />
          </motion.div>

          {/* Quick Actions */}
          <motion.div variants={fadeUp} className="glass-card p-5 md:col-span-2 lg:col-span-3">
            <h3 className="text-sm font-heading font-bold uppercase tracking-wider text-muted-foreground mb-3">Quick Actions</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Log Meal", icon: UtensilsCrossed, to: "/nutrition", color: "text-success" },
                { label: "Start Workout", icon: Dumbbell, to: "/workout-planner", color: "text-primary" },
                { label: "Log Weight", icon: Scale, to: "/progress", color: "text-accent" },
                { label: "Add PR", icon: Trophy, to: "/records", color: "text-warning" },
              ].map(({ label, icon: Icon, to, color }) => (
                <Link key={label} to={to} className="flex items-center gap-3 p-3 rounded-2xl bg-secondary hover:bg-secondary/80 transition-all hover:scale-[1.02] active:scale-[0.98]">
                  <div className={`p-2 rounded-xl bg-background ${color}`}>
                    <Icon size={18} />
                  </div>
                  <span className="text-sm font-medium">{label}</span>
                </Link>
              ))}
            </div>
          </motion.div>

          {/* Motivation */}
          <motion.div variants={fadeUp} className="glass-card p-5 md:col-span-2 lg:col-span-3">
            <p className="text-center text-muted-foreground italic text-sm">"{quote}"</p>
          </motion.div>
        </motion.div>
      </div>
    </AppLayout>
  );
}
