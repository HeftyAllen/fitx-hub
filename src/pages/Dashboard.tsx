import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/layout/AppLayout";
import { motion } from "framer-motion";
import { Plus, Dumbbell, UtensilsCrossed, Scale, Trophy, Droplets, TrendingUp, Flame, Calendar, Zap, Target, ChevronRight, Clock, BarChart3, Award, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, AreaChart, Area } from "recharts";
import { useChallenges } from "@/hooks/useChallenges";
import { buildSuggestions, type Suggestion } from "@/lib/suggestions";

const GREETINGS = [
  { label: "Welcome back,",       sub: "Glad to see you again. Let's crush it today." },
  { label: "Good to have you,",   sub: "Every rep counts. Let's make this session legendary." },
  { label: "Ready to grind,",     sub: "Your future self is watching. Don't disappoint them." },
  { label: "Look who's back,",    sub: "Consistency is your superpower. Keep showing up." },
  { label: "Let's get after it,", sub: "The only workout you'll regret is the one you skip." },
  { label: "Time to dominate,",   sub: "Pain is temporary. Progress is permanent." },
  { label: "Rise and conquer,",   sub: "Champions are built in sessions exactly like this one." },
  { label: "Back in the game,",   sub: "Your body is capable of more than you think. Prove it." },
  { label: "Let's go,",           sub: "Sweat today, flex tomorrow. Time to earn it." },
  { label: "Locked in,",          sub: "Focus. Breathe. Execute. You've got this." },
  { label: "Here we go,",         sub: "Another day, another chance to be better than yesterday." },
  { label: "Welcome back,",       sub: "Strength isn't given — it's built, one session at a time." },
];

function getDynamicGreeting() {
  const h = new Date().getHours();
  const label = h < 5 ? "Still up," : h < 12 ? "Good morning," : h < 17 ? "Good afternoon," : h < 22 ? "Good evening," : "Late one,";
  const slot = Math.floor(Date.now() / (1000 * 60 * 30));
  return { label, sub: GREETINGS[slot % GREETINGS.length].sub };
}

/** Prefer a real name, then Google display name, then a tidy handle from the email. */
function displayName(profileName?: string | null, authName?: string | null, email?: string | null) {
  const first = (s?: string | null) => (s || "").trim().split(/\s+/)[0];
  const fromProfile = first(profileName);
  if (fromProfile) return fromProfile;
  const fromAuth = first(authName);
  if (fromAuth) return fromAuth;
  const handle = (email || "").split("@")[0].replace(/[._\-+\d]+/g, " ").trim();
  if (handle) return handle.charAt(0).toUpperCase() + handle.slice(1);
  return "Athlete";
}

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
  const [greeting] = useState(() => getDynamicGreeting());
  const [workoutLogs, setWorkoutLogs] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [recentPRs, setRecentPRs] = useState<any[]>([]);
  const [todayCalories, setTodayCalories] = useState(0);
  const [weightHistory, setWeightHistory] = useState<{ dateISO: string; weightKg: number }[]>([]);
  const { challenges, loading: challengesLoading } = useChallenges();
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

        const dayLogs = logs.filter((l: any) => {
          const logDate = l.date?.toDate ? l.date.toDate() : new Date((l.date?.seconds || 0) * 1000);
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

    // Fetch recent PRs
    getDocs(collection(db, "users", user.uid, "personalRecords")).then(snap => {
      const prs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      prs.sort((a: any, b: any) => (b.date?.seconds || 0) - (a.date?.seconds || 0));
      setRecentPRs(prs.slice(0, 3));
    });

    // Today's calories
    const today = new Date().toISOString().split("T")[0];
    getDoc(doc(db, "users", user.uid, "foodLog", today)).then(snap => {
      if (!snap.exists()) return setTodayCalories(0);
      const data = snap.data() as any;
      let cals = 0;
      ["breakfast", "lunch", "dinner", "snacks"].forEach(meal => {
        (data[meal] || []).forEach((item: any) => { cals += Number(item.calories) || 0; });
      });
      setTodayCalories(Math.round(cals));
    }).catch(() => setTodayCalories(0));

    // Weight history (last ~60d)
    getDocs(collection(db, "users", user.uid, "weightLogs")).then(snap => {
      const items = snap.docs.map(d => {
        const data = d.data() as any;
        const date = data.date?.toDate ? data.date.toDate() : new Date(data.date || d.id);
        return { dateISO: date.toISOString().slice(0, 10), weightKg: Number(data.weightKg ?? data.weight) || 0 };
      }).filter(x => x.weightKg > 0).sort((a, b) => a.dateISO.localeCompare(b.dateISO));
      setWeightHistory(items);
    }).catch(() => setWeightHistory([]));
  }, [user]);

  const totalWorkoutsThisWeek = weeklyData.filter(d => d.minutes > 0).length;
  const totalMinutesThisWeek = weeklyData.reduce((s, d) => s + d.minutes, 0);
  const totalVolumeThisWeek = weeklyData.reduce((s, d) => s + d.volume, 0);

  // Current streak calc (simplified)
  const streak = workoutLogs.length > 0 ? Math.min(workoutLogs.length, 7) : 0;

  const todayDayName = WEEKDAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];
  const todayPlan = plans.find(p => p.days?.includes(todayDayName));

  const suggestions = useMemo<Suggestion[]>(() => buildSuggestions({
    uid: user?.uid ?? null,
    profile: userProfile,
    todayPlan,
    workoutLogs,
    todayCalories,
    weightHistory,
  }), [user?.uid, userProfile, todayPlan, workoutLogs, todayCalories, weightHistory]);

  const level = Math.floor((workoutLogs.length * 50) / 500) + 1;
  const xp = workoutLogs.length * 50;

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-5">
        {/* ===== HERO ===== */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-3xl border border-white/[0.06] p-6 md:p-8"
          style={{
            background:
              "radial-gradient(120% 120% at 0% 0%, hsl(var(--primary) / 0.28) 0%, transparent 55%), radial-gradient(120% 120% at 100% 100%, hsl(var(--accent) / 0.22) 0%, transparent 55%), linear-gradient(135deg, hsl(240 20% 10% / 0.9), hsl(240 15% 8% / 0.9))",
            boxShadow: "0 30px 80px -40px hsl(var(--primary) / 0.5)",
          }}
        >
          {/* aurora blobs */}
          <motion.div
            aria-hidden
            className="pointer-events-none absolute -top-24 -left-16 w-72 h-72 rounded-full bg-primary/30 blur-3xl"
            animate={{ x: [0, 30, 0], y: [0, 20, 0] }}
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            aria-hidden
            className="pointer-events-none absolute -bottom-24 -right-16 w-80 h-80 rounded-full bg-accent/25 blur-3xl"
            animate={{ x: [0, -25, 0], y: [0, -15, 0] }}
            transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
          />

          <div className="relative flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{greeting.label}</p>
              <h1 className="mt-1 text-3xl md:text-5xl font-heading font-bold leading-tight">
                <span className="gradient-text">{name}</span>
              </h1>
              <p className="text-sm text-muted-foreground mt-2 max-w-md">{greeting.sub}</p>

              {/* Primary CTA */}
              <div className="mt-5 flex flex-wrap gap-2">
                {todayPlan ? (
                  <Link
                    to="/workout-session"
                    state={{ plan: todayPlan }}
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl gradient-bg text-primary-foreground font-semibold text-sm shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-transform"
                  >
                    <Flame size={16} /> Start {todayPlan.name}
                  </Link>
                ) : (
                  <Link
                    to="/workout-planner"
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl gradient-bg text-primary-foreground font-semibold text-sm shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-transform"
                  >
                    <Plus size={16} /> Plan Today's Workout
                  </Link>
                )}
                <Link
                  to="/nutrition"
                  className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] transition-colors text-sm font-medium"
                >
                  <UtensilsCrossed size={14} /> Log Meal
                </Link>
              </div>
            </div>

            {/* Streak + Level pills, right side */}
            <div className="flex gap-3">
              <div className="flex-1 lg:flex-none min-w-[130px] rounded-2xl bg-white/[0.04] border border-white/[0.08] px-4 py-3 backdrop-blur-sm">
                <div className="flex items-center gap-2 text-muted-foreground text-[10px] uppercase tracking-wider">
                  <span className="text-base">🔥</span> Streak
                </div>
                <p className="text-2xl font-heading font-bold mt-1">{streak}<span className="text-xs text-muted-foreground font-normal ml-1">days</span></p>
              </div>
              <div className="flex-1 lg:flex-none min-w-[130px] rounded-2xl bg-white/[0.04] border border-white/[0.08] px-4 py-3 backdrop-blur-sm">
                <div className="flex items-center gap-2 text-muted-foreground text-[10px] uppercase tracking-wider">
                  <Zap size={12} className="text-warning" /> Level {level}
                </div>
                <p className="text-2xl font-heading font-bold mt-1">{xp}<span className="text-xs text-muted-foreground font-normal ml-1">xp</span></p>
                <div className="mt-1.5 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                  <div className="h-full gradient-bg" style={{ width: `${(xp % 500) / 5}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Compact quick stats strip */}
          <div className="relative mt-6 grid grid-cols-3 gap-3">
            {[
              { label: "Workouts", value: totalWorkoutsThisWeek, sub: "this week", icon: Dumbbell, color: "text-primary" },
              { label: "Minutes", value: totalMinutesThisWeek, sub: "trained", icon: Clock, color: "text-accent" },
              { label: "Volume", value: totalVolumeThisWeek.toLocaleString(), sub: "kg lifted", icon: BarChart3, color: "text-success" },
            ].map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.06 }}
                className="rounded-2xl bg-black/25 border border-white/[0.05] px-4 py-3"
              >
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <s.icon size={11} className={s.color} /> {s.label}
                </div>
                <p className="text-xl md:text-2xl font-heading font-bold mt-1">{s.value}</p>
                <p className="text-[10px] text-muted-foreground">{s.sub}</p>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* ===== MAIN GRID: focused, less clutter ===== */}
        <motion.div variants={stagger} initial="hidden" animate="visible" className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Weekly Activity — main hero chart */}
          <motion.div variants={fadeUp} className="lg:col-span-2 glass-card p-5 rounded-2xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-heading font-bold">Weekly Activity</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Training minutes this week</p>
              </div>
              <Link to="/calendar" className="text-xs text-primary hover:underline flex items-center gap-1">
                Calendar <ChevronRight size={12} />
              </Link>
            </div>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weeklyData}>
                  <defs>
                    <linearGradient id="gradientArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "hsl(218 11% 65%)", fontSize: 11 }} />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{ background: "hsl(240 15% 12%)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", fontSize: "12px" }}
                    labelStyle={{ color: "hsl(210 20% 98%)" }}
                    itemStyle={{ color: "hsl(210 20% 98%)" }}
                  />
                  <Area type="monotone" dataKey="minutes" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#gradientArea)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Today's Workout — prominent */}
          <motion.div variants={fadeUp} className="glass-card p-5 rounded-2xl flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-heading font-bold">Today</h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06] text-muted-foreground uppercase tracking-wider">{todayDayName}</span>
            </div>
            {todayPlan ? (
              <div className="flex-1 flex flex-col">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-3 rounded-2xl gradient-bg shadow-lg">
                    <Dumbbell size={20} className="text-primary-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-heading font-bold text-base truncate">{todayPlan.name}</p>
                    <p className="text-xs text-muted-foreground">{todayPlan.exercises?.length || 0} exercises</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 mb-4">
                  {todayPlan.exercises?.slice(0, 4).map((ex: any, i: number) => (
                    <span key={i} className="text-[10px] px-2 py-1 rounded-full bg-white/[0.04] text-muted-foreground">{ex.name.slice(0, 18)}</span>
                  ))}
                </div>
                <Link
                  to="/workout-session"
                  state={{ plan: todayPlan }}
                  className="mt-auto flex items-center justify-center gap-2 w-full py-3 rounded-xl gradient-bg text-primary-foreground text-sm font-semibold hover:scale-[0.98] active:scale-[0.96] transition-transform shadow-lg"
                >
                  <Flame size={14} /> Start Session
                </Link>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center py-4 text-center">
                <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-3">
                  <Calendar size={22} className="text-muted-foreground/60" />
                </div>
                <p className="text-sm font-medium">Rest Day</p>
                <p className="text-xs text-muted-foreground mt-0.5 mb-3">Recover and refuel</p>
                <Link to="/workout-planner" className="text-xs text-primary hover:underline font-medium">
                  Plan a workout →
                </Link>
              </div>
            )}
          </motion.div>

          {/* Smart Suggestions */}
          <motion.div
            variants={fadeUp}
            className="lg:col-span-2 relative glass-card p-5 rounded-2xl overflow-hidden"
          >
            <div className="pointer-events-none absolute -top-16 -right-12 w-48 h-48 rounded-full bg-primary/15 blur-3xl" />

            <div className="relative flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center">
                  <Sparkles size={14} className="text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-heading font-bold">For You Today</h3>
                  <p className="text-[10px] text-muted-foreground -mt-0.5">Smart suggestions tuned to your day</p>
                </div>
              </div>
              <span className="text-[10px] text-muted-foreground bg-white/[0.04] px-2 py-1 rounded-full border border-white/[0.05]">
                {suggestions.length}
              </span>
            </div>

            <div className="relative grid sm:grid-cols-2 gap-2">
              {suggestions.slice(0, 4).map((s, i) => (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className="group p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-white/[0.12] hover:bg-white/[0.04] transition-all"
                >
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-black/25 border border-white/[0.05] flex items-center justify-center flex-shrink-0">
                      <span className="text-sm leading-none">{s.icon ?? "💡"}</span>
                    </div>
                    <div className="min-w-0">
                      <p className={`text-xs font-semibold ${s.accent ?? "text-foreground"}`}>{s.title}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug line-clamp-2">{s.body}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Hydration */}
          <motion.div variants={fadeUp} className="glass-card p-5 rounded-2xl">
            <WaterTracker />
          </motion.div>

          {/* Recent Workouts */}
          <motion.div variants={fadeUp} className="lg:col-span-2 glass-card p-5 rounded-2xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-heading font-bold">Recent Workouts</h3>
              <Link to="/calendar" className="text-xs text-primary hover:underline flex items-center gap-1">
                View All <ChevronRight size={12} />
              </Link>
            </div>
            {workoutLogs.length === 0 ? (
              <div className="text-center py-8">
                <Dumbbell size={26} className="mx-auto text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">No workouts yet — let's fix that.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {workoutLogs.slice(0, 4).map((log: any, i: number) => {
                  const logDate = log.date?.toDate ? log.date.toDate() : new Date(log.date?.seconds * 1000);
                  return (
                    <div key={log.id || i} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.1] transition-colors">
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

          {/* Active Challenges */}
          <motion.div variants={fadeUp} className="glass-card p-5 rounded-2xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-heading font-bold">Challenges</h3>
              <Link to="/records" className="text-xs text-primary hover:underline flex items-center gap-1">
                All <ChevronRight size={12} />
              </Link>
            </div>
            {challengesLoading ? (
              <div className="space-y-2">
                {[1, 2].map(i => <div key={i} className="h-12 rounded-xl bg-white/[0.03] shimmer" />)}
              </div>
            ) : challenges.filter(c => c.joined && !c.completed).length === 0 ? (
              <div className="text-center py-5">
                <Zap size={24} className="mx-auto text-muted-foreground/30 mb-2" />
                <p className="text-xs text-muted-foreground mb-2">No active challenges</p>
                <Link to="/records" className="text-xs text-primary hover:underline font-medium">Join one →</Link>
              </div>
            ) : (
              <div className="space-y-2">
                {challenges.filter(c => c.joined && !c.completed).slice(0, 3).map(c => {
                  const pct = Math.min((c.progress / c.target) * 100, 100);
                  return (
                    <div key={c.id} className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-base flex-shrink-0">{c.icon}</span>
                        <p className="text-xs font-medium truncate flex-1">{c.name}</p>
                        <span className="text-[10px] text-primary font-semibold">{Math.round(pct)}%</span>
                      </div>
                      <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                        <div className={`h-full bg-gradient-to-r ${c.color} rounded-full`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        </motion.div>
      </div>
    </AppLayout>
  );
}
