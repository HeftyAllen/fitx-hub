import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/layout/AppLayout";
import { motion } from "framer-motion";
import { Plus, Dumbbell, UtensilsCrossed, Scale, Trophy, Droplets, TrendingUp, Flame, Calendar, Zap, Target, ChevronRight, Clock, BarChart3 } from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAuth as useAuthCtx } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, limit, where, Timestamp } from "firebase/firestore";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, AreaChart, Area } from "recharts";

const QUOTES = [
  "The only bad workout is the one that didn't happen.",
  "Your body can stand almost anything. It's your mind you have to convince.",
  "Success isn't always about greatness. It's about consistency.",
  "The pain you feel today will be the strength you feel tomorrow.",
  "Don't limit your challenges — challenge your limits.",
  "The clock is ticking. Are you becoming the person you want to be?",
];

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function MacroRing({ value, max, label, color, size = 90 }: { value: number; max: number; label: string; color: string; size?: number }) {
  const pct = Math.min((value / max) * 100, 100);
  const radius = (size - 16) / 2;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (pct / 100) * circ;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="hsl(var(--secondary))" strokeWidth="6" />
        <motion.circle
          cx={size/2} cy={size/2} r={radius} fill="none" stroke={color} strokeWidth="6"
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          transform={`rotate(-90 ${size/2} ${size/2})`}
        />
        <text x={size/2} y={size/2 - 4} textAnchor="middle" className="fill-foreground font-bold" fontSize="14">{value}</text>
        <text x={size/2} y={size/2 + 12} textAnchor="middle" className="fill-muted-foreground" fontSize="9">/ {max}</text>
      </svg>
      <span className="text-xs text-muted-foreground font-medium">{label}</span>
    </div>
  );
}

function WaterTracker() {
  const [glasses, setGlasses] = useState(0);
  const goal = 8;
  const pct = (glasses / goal) * 100;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-heading font-bold uppercase tracking-wider text-muted-foreground">Hydration</h3>
        <Droplets size={14} className="text-accent" />
      </div>
      <div className="relative h-2 bg-secondary rounded-full overflow-hidden">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ background: "linear-gradient(90deg, #2563EB, #06B6D4)" }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>
      <div className="flex gap-1">
        {Array.from({ length: goal }).map((_, i) => (
          <motion.button
            key={i}
            className={`h-7 flex-1 rounded-lg transition-all ${i < glasses ? "bg-accent/30 border border-accent/50" : "bg-secondary/60 border border-white/[0.05]"}`}
            onClick={() => setGlasses(i + 1 === glasses ? i : i + 1)}
            whileTap={{ scale: 0.85 }}
          >
            <Droplets size={10} className={`mx-auto ${i < glasses ? "text-accent" : "text-muted-foreground/40"}`} />
          </motion.button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground text-center">{glasses} / {goal} glasses · {Math.round(glasses * 250)}ml</p>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, change, color }: { icon: any; label: string; value: string; change?: string; color: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-4 rounded-2xl hover:scale-[1.02] transition-transform"
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-xl ${color}`}>
          <Icon size={16} />
        </div>
        {change && (
          <span className="text-xs font-medium text-green-400 flex items-center gap-0.5">
            <TrendingUp size={10} /> {change}
          </span>
        )}
      </div>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </motion.div>
  );
}

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.06 } } };
const fadeUp = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

export default function Dashboard() {
  const { user, userProfile } = useAuth();
  const name = userProfile?.name || user?.displayName || "Athlete";
  const [quote] = useState(() => QUOTES[Math.floor(Math.random() * QUOTES.length)]);
  const [workoutLogs, setWorkoutLogs] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [weeklyData, setWeeklyData] = useState<{ day: string; minutes: number; volume: number }[]>(
    WEEKDAYS.map(d => ({ day: d, minutes: 0, volume: 0 }))
  );

  useEffect(() => {
    if (!user) return;
    // Fetch recent workout logs
    getDocs(collection(db, "users", user.uid, "workoutLogs")).then(snap => {
      const logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setWorkoutLogs(logs);

      // Build weekly chart data
      const now = new Date();
      const startOfWeek = new Date(now);
      const dayOfWeek = now.getDay();
      startOfWeek.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      startOfWeek.setHours(0, 0, 0, 0);

      const data = WEEKDAYS.map((day, i) => {
        const targetDate = new Date(startOfWeek);
        targetDate.setDate(startOfWeek.getDate() + i);
        const dateStr = targetDate.toISOString().split("T")[0];

        const dayLogs = logs.filter(l => {
          const logDate = l.date?.toDate ? l.date.toDate() : new Date(l.date?.seconds * 1000);
          return logDate.toISOString().split("T")[0] === dateStr;
        });

        return {
          day,
          minutes: dayLogs.reduce((s: number, l: any) => s + Math.round((l.duration || 0) / 60), 0),
          volume: dayLogs.reduce((s: number, l: any) => s + (l.totalVolume || 0), 0),
        };
      });
      setWeeklyData(data);
    });

    // Fetch plans
    getDocs(collection(db, "users", user.uid, "workoutPlans")).then(snap => {
      setPlans(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, [user]);

  const totalWorkoutsThisWeek = weeklyData.filter(d => d.minutes > 0).length;
  const totalMinutesThisWeek = weeklyData.reduce((s, d) => s + d.minutes, 0);
  const totalVolumeThisWeek = weeklyData.reduce((s, d) => s + d.volume, 0);

  // Current streak calc (simplified)
  const streak = workoutLogs.length > 0 ? Math.min(workoutLogs.length, 7) : 0;

  const todayDayName = WEEKDAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];
  const todayPlan = plans.find(p => p.days?.includes(todayDayName));

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-5">
        {/* Top greeting + stats row */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible" className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Welcome back,</p>
            <h1 className="text-2xl md:text-3xl font-heading font-bold">
              <span className="gradient-text">{name}</span>
            </h1>
            <p className="text-xs text-muted-foreground mt-1">Glad to see you again! Let's crush it today.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="glass-card px-4 py-2.5 rounded-2xl flex items-center gap-2">
              <motion.span
                className="text-lg"
                animate={{ rotate: [0, -10, 10, -10, 0] }}
                transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 3 }}
              >
                🔥
              </motion.span>
              <div>
                <p className="text-sm font-bold">{streak} Days</p>
                <p className="text-xs text-muted-foreground">Streak</p>
              </div>
            </div>
            <div className="glass-card px-4 py-2.5 rounded-2xl flex items-center gap-2">
              <Zap size={18} className="text-warning" />
              <div>
                <p className="text-sm font-bold">{workoutLogs.length * 50} XP</p>
                <p className="text-xs text-muted-foreground">Level {Math.floor((workoutLogs.length * 50) / 500) + 1}</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Stat cards row */}
        <motion.div variants={stagger} initial="hidden" animate="visible" className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={Dumbbell} label="Workouts This Week" value={String(totalWorkoutsThisWeek)} change={totalWorkoutsThisWeek > 0 ? `+${totalWorkoutsThisWeek}` : undefined} color="bg-primary/20 text-primary" />
          <StatCard icon={Clock} label="Minutes Trained" value={String(totalMinutesThisWeek)} color="bg-accent/20 text-accent" />
          <StatCard icon={BarChart3} label="Total Volume (kg)" value={totalVolumeThisWeek.toLocaleString()} color="bg-success/20 text-success" />
          <StatCard icon={Trophy} label="Total PRs" value={String(workoutLogs.length)} color="bg-warning/20 text-warning" />
        </motion.div>

        {/* Main grid */}
        <motion.div variants={stagger} initial="hidden" animate="visible" className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Weekly Activity Chart - takes 2 cols */}
          <motion.div variants={fadeUp} className="lg:col-span-2 glass-card p-5 rounded-2xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-heading font-bold uppercase tracking-wider text-muted-foreground">Weekly Activity</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Minutes trained per day</p>
              </div>
              <Link to="/calendar" className="text-xs text-primary hover:underline flex items-center gap-1">
                View Calendar <ChevronRight size={12} />
              </Link>
            </div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weeklyData}>
                  <defs>
                    <linearGradient id="gradientArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2563EB" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#06B6D4" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "hsl(218 11% 65%)", fontSize: 11 }} />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{ background: "hsl(240 15% 12%)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", fontSize: "12px" }}
                    labelStyle={{ color: "hsl(210 20% 98%)" }}
                    itemStyle={{ color: "hsl(210 20% 98%)" }}
                  />
                  <Area type="monotone" dataKey="minutes" stroke="#2563EB" strokeWidth={2} fill="url(#gradientArea)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Today's Macros */}
          <motion.div variants={fadeUp} className="glass-card p-5 rounded-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-heading font-bold uppercase tracking-wider text-muted-foreground">Today's Macros</h3>
              <Link to="/nutrition" className="text-xs text-primary hover:underline">Log →</Link>
            </div>
            <div className="flex justify-around">
              <MacroRing value={0} max={2200} label="Calories" color="#2563EB" size={80} />
              <MacroRing value={0} max={150} label="Protein" color="#06B6D4" size={80} />
              <MacroRing value={0} max={250} label="Carbs" color="#FACC15" size={80} />
            </div>
            <div className="mt-4 pt-3 border-t border-white/[0.06]">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Fats</span>
                <span className="font-medium">0 / 70g</span>
              </div>
              <div className="relative h-1.5 mt-1 bg-secondary rounded-full overflow-hidden">
                <div className="absolute inset-y-0 left-0 rounded-full bg-orange-500/70 w-0" />
              </div>
            </div>
          </motion.div>

          {/* Today's Workout */}
          <motion.div variants={fadeUp} className="glass-card p-5 rounded-2xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-heading font-bold uppercase tracking-wider text-muted-foreground">Today's Workout</h3>
              <span className="text-xs px-2 py-0.5 rounded-full gradient-bg text-primary-foreground">{todayDayName}</span>
            </div>
            {todayPlan ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-primary/20">
                    <Dumbbell size={18} className="text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{todayPlan.name}</p>
                    <p className="text-xs text-muted-foreground">{todayPlan.exercises?.length || 0} exercises</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {todayPlan.exercises?.slice(0, 4).map((ex: any, i: number) => (
                    <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{ex.name.slice(0, 15)}</span>
                  ))}
                </div>
                <Link
                  to="/workout-session"
                  state={{ plan: todayPlan }}
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl gradient-bg text-primary-foreground text-sm font-medium hover:scale-[0.98] active:scale-[0.96] transition-transform"
                >
                  <Flame size={14} /> Start Workout
                </Link>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-4 text-center">
                <Dumbbell size={28} className="text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">Rest Day</p>
                <Link to="/workout-planner" className="mt-2 text-xs text-primary hover:underline font-medium">
                  Plan a workout →
                </Link>
              </div>
            )}
          </motion.div>

          {/* Volume Chart */}
          <motion.div variants={fadeUp} className="glass-card p-5 rounded-2xl">
            <h3 className="text-xs font-heading font-bold uppercase tracking-wider text-muted-foreground mb-4">Volume This Week</h3>
            <div className="h-36">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyData}>
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "hsl(218 11% 65%)", fontSize: 10 }} />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{ background: "hsl(240 15% 12%)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", fontSize: "12px" }}
                    labelStyle={{ color: "hsl(210 20% 98%)" }}
                    itemStyle={{ color: "hsl(210 20% 98%)" }}
                  />
                  <Bar dataKey="volume" radius={[6, 6, 0, 0]} fill="url(#barGrad)" />
                  <defs>
                    <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#06B6D4" />
                      <stop offset="100%" stopColor="#2563EB" />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Water Tracker */}
          <motion.div variants={fadeUp} className="glass-card p-5 rounded-2xl">
            <WaterTracker />
          </motion.div>

          {/* Quick Actions */}
          <motion.div variants={fadeUp} className="lg:col-span-3 glass-card p-5 rounded-2xl">
            <h3 className="text-xs font-heading font-bold uppercase tracking-wider text-muted-foreground mb-3">Quick Actions</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Log Meal", icon: UtensilsCrossed, to: "/nutrition", color: "bg-success/15 text-success" },
                { label: "Start Workout", icon: Dumbbell, to: "/workout-planner", color: "bg-primary/15 text-primary" },
                { label: "Log Weight", icon: Scale, to: "/progress", color: "bg-accent/15 text-accent" },
                { label: "Add PR", icon: Trophy, to: "/records", color: "bg-warning/15 text-warning" },
              ].map(({ label, icon: Icon, to, color }) => (
                <Link key={label} to={to} className="flex items-center gap-3 p-3.5 rounded-2xl bg-secondary/50 border border-white/[0.05] hover:border-white/[0.12] transition-all hover:scale-[1.02] active:scale-[0.98]">
                  <div className={`p-2.5 rounded-xl ${color}`}>
                    <Icon size={16} />
                  </div>
                  <span className="text-sm font-medium">{label}</span>
                </Link>
              ))}
            </div>
          </motion.div>

          {/* Recent Workouts */}
          <motion.div variants={fadeUp} className="lg:col-span-2 glass-card p-5 rounded-2xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-heading font-bold uppercase tracking-wider text-muted-foreground">Recent Workouts</h3>
              <Link to="/records" className="text-xs text-primary hover:underline flex items-center gap-1">
                View All <ChevronRight size={12} />
              </Link>
            </div>
            {workoutLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No workouts logged yet. Start your first workout!</p>
            ) : (
              <div className="space-y-2">
                {workoutLogs.slice(0, 4).map((log: any, i: number) => {
                  const logDate = log.date?.toDate ? log.date.toDate() : new Date(log.date?.seconds * 1000);
                  return (
                    <div key={log.id || i} className="flex items-center gap-3 p-3 rounded-xl bg-secondary/30 border border-white/[0.04]">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Dumbbell size={14} className="text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{log.planName || "Workout"}</p>
                        <p className="text-xs text-muted-foreground">{logDate.toLocaleDateString()}</p>
                      </div>
                      <div className="text-right text-xs">
                        <p className="font-medium">{Math.round((log.duration || 0) / 60)} min</p>
                        <p className="text-muted-foreground">{(log.totalVolume || 0).toLocaleString()} kg</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>

          {/* Motivation */}
          <motion.div variants={fadeUp} className="glass-card p-5 rounded-2xl flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-heading font-bold uppercase tracking-wider text-muted-foreground mb-3">Daily Motivation</h3>
              <p className="text-foreground/80 italic text-sm leading-relaxed">"{quote}"</p>
            </div>
            <div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/[0.06]">
              <Target size={14} className="text-primary" />
              <p className="text-xs text-muted-foreground">Stay consistent, results will follow</p>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </AppLayout>
  );
}
