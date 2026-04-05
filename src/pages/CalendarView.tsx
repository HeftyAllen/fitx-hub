import { useState, useEffect, useMemo } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, ChevronRight, Plus, X, Trash2, Play, Dumbbell,
  Clock, Flame, CalendarDays, Edit2, Zap, Trophy
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import {
  collection, getDocs, addDoc, deleteDoc, doc, updateDoc, Timestamp, query as fbQuery, where
} from "firebase/firestore";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, isSameDay, isToday } from "date-fns";
import { useChallenges } from "@/hooks/useChallenges";

interface WorkoutPlan {
  id: string;
  name: string;
  exercises: any[];
  days?: string[];
  createdAt: any;
}

interface CalendarEntry {
  id: string;
  date: string; // YYYY-MM-DD
  planId: string;
  planName: string;
  completed?: boolean;
  notes?: string;
}

const DAY_COLORS = [
  "bg-blue-500/20 text-blue-400",
  "bg-purple-500/20 text-purple-400",
  "bg-green-500/20 text-green-400",
  "bg-orange-500/20 text-orange-400",
  "bg-pink-500/20 text-pink-400",
  "bg-cyan-500/20 text-cyan-400",
  "bg-amber-500/20 text-amber-400",
];

export default function CalendarView() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const { challenges } = useChallenges();

  useEffect(() => { if (user) fetchData(); }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [plansSnap, entriesSnap] = await Promise.all([
        getDocs(collection(db, "users", user.uid, "workoutPlans")),
        getDocs(collection(db, "users", user.uid, "calendarEntries")),
      ]);
      setPlans(plansSnap.docs.map(d => ({ id: d.id, ...d.data() } as WorkoutPlan)));
      setEntries(entriesSnap.docs.map(d => ({ id: d.id, ...d.data() } as CalendarEntry)));
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const addEntry = async (planId: string, planName: string, date: Date) => {
    if (!user) return;
    const dateStr = format(date, "yyyy-MM-dd");
    const ref = await addDoc(collection(db, "users", user.uid, "calendarEntries"), {
      date: dateStr, planId, planName, completed: false, createdAt: Timestamp.now(),
    });
    setEntries(prev => [...prev, { id: ref.id, date: dateStr, planId, planName, completed: false }]);
    toast.success(`"${planName}" scheduled for ${format(date, "MMM d")}`);
    setShowAddModal(false);
  };

  const removeEntry = async (entryId: string) => {
    if (!user) return;
    await deleteDoc(doc(db, "users", user.uid, "calendarEntries", entryId));
    setEntries(prev => prev.filter(e => e.id !== entryId));
    toast.success("Removed from calendar");
  };

  const toggleComplete = async (entry: CalendarEntry) => {
    if (!user) return;
    await updateDoc(doc(db, "users", user.uid, "calendarEntries", entry.id), { completed: !entry.completed });
    setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, completed: !e.completed } : e));
  };

  // Calendar grid
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPad = getDay(monthStart); // 0=Sun
  const paddedDays = [...Array.from({ length: startPad }, () => null), ...daysInMonth];

  const getEntriesForDate = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return entries.filter(e => e.date === dateStr);
  };

  const selectedEntries = selectedDate ? getEntriesForDate(selectedDate) : [];

  // Streak calc
  const streak = useMemo(() => {
    let count = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = format(d, "yyyy-MM-dd");
      if (entries.some(e => e.date === dateStr && e.completed)) count++;
      else if (i > 0) break;
    }
    return count;
  }, [entries]);

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-heading font-bold gradient-text">Fitness Calendar</h1>
            <p className="text-xs text-muted-foreground mt-1">Schedule and track your workouts</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="glass-card px-4 py-2 rounded-xl flex items-center gap-2">
              <span className="text-lg">🔥</span>
              <div>
                <p className="text-sm font-bold text-foreground">{streak} Day Streak</p>
                <p className="text-[10px] text-muted-foreground">Keep it going!</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-[1fr_320px] gap-5">
          {/* Calendar */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5 rounded-2xl">
            {/* Month nav */}
            <div className="flex items-center justify-between mb-5">
              <Button size="icon" variant="ghost" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="rounded-xl h-9 w-9">
                <ChevronLeft size={18} />
              </Button>
              <h3 className="font-heading font-bold text-lg">
                {format(currentMonth, "MMMM yyyy")}
              </h3>
              <Button size="icon" variant="ghost" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="rounded-xl h-9 w-9">
                <ChevronRight size={18} />
              </Button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground mb-2">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
                <div key={d} className="py-1.5 font-medium">{d}</div>
              ))}
            </div>

            {/* Days grid */}
            <div className="grid grid-cols-7 gap-1">
              {paddedDays.map((day, i) => {
                if (!day) return <div key={`pad-${i}`} />;
                const dayEntries = getEntriesForDate(day);
                const hasWorkout = dayEntries.length > 0;
                const allCompleted = hasWorkout && dayEntries.every(e => e.completed);
                const isSelected = selectedDate && isSameDay(day, selectedDate);
                const todayClass = isToday(day);

                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => setSelectedDate(day)}
                    className={`aspect-square flex flex-col items-center justify-center rounded-xl text-sm transition-all relative p-1 ${
                      isSelected
                        ? "gradient-bg text-primary-foreground font-bold ring-2 ring-primary/50"
                        : todayClass
                        ? "bg-primary/10 text-primary font-bold border border-primary/30"
                        : "hover:bg-secondary text-foreground"
                    }`}
                  >
                    <span className="text-xs">{day.getDate()}</span>
                    {hasWorkout && (
                      <div className="flex gap-0.5 mt-0.5">
                        {dayEntries.slice(0, 3).map((e, j) => (
                          <div key={e.id} className={`w-1.5 h-1.5 rounded-full ${
                            e.completed ? "bg-green-400" : "bg-primary"
                          }`} />
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mt-4 pt-4 border-t border-white/[0.05]">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="w-2 h-2 rounded-full bg-primary" /> Scheduled
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="w-2 h-2 rounded-full bg-green-400" /> Completed
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="w-3 h-3 rounded border border-primary/30 bg-primary/10" /> Today
              </div>
            </div>
          </motion.div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Selected day detail */}
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="glass-card p-5 rounded-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-heading font-bold text-sm">
                  {selectedDate ? format(selectedDate, "EEEE, MMM d") : "Select a day"}
                </h3>
                {selectedDate && (
                  <Button size="sm" onClick={() => setShowAddModal(true)}
                    className="gradient-bg text-primary-foreground rounded-xl text-xs gap-1 h-8">
                    <Plus size={14} /> Add
                  </Button>
                )}
              </div>

              {!selectedDate ? (
                <div className="text-center py-6">
                  <CalendarDays size={32} className="mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-xs text-muted-foreground">Click a day to see details</p>
                </div>
              ) : selectedEntries.length === 0 ? (
                <div className="text-center py-6">
                  <Dumbbell size={28} className="mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-xs text-muted-foreground mb-3">Rest day — no workouts scheduled</p>
                  <Button size="sm" variant="outline" onClick={() => setShowAddModal(true)}
                    className="rounded-xl text-xs border-white/10 gap-1">
                    <Plus size={12} /> Schedule Workout
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedEntries.map((entry, i) => {
                    const plan = plans.find(p => p.id === entry.planId);
                    return (
                      <motion.div key={entry.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className={`p-3 rounded-xl border transition-all ${
                          entry.completed
                            ? "bg-green-500/5 border-green-500/20"
                            : "glass-card"
                        }`}>
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{entry.planName}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {plan ? `${plan.exercises?.length || 0} exercises` : "Plan"}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <button onClick={() => toggleComplete(entry)}
                              className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs transition-all ${
                                entry.completed
                                  ? "bg-green-500/20 text-green-400"
                                  : "bg-secondary hover:bg-primary/20 text-muted-foreground hover:text-primary"
                              }`}>
                              ✓
                            </button>
                            <button onClick={() => removeEntry(entry.id)}
                              className="w-6 h-6 rounded-lg flex items-center justify-center bg-secondary hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-all">
                              <X size={12} />
                            </button>
                          </div>
                        </div>
                        {plan && !entry.completed && (
                          <Button size="sm" onClick={() => navigate("/workout-session", { state: { plan } })}
                            className="w-full gradient-bg text-primary-foreground rounded-lg text-xs gap-1 h-7 mt-1">
                            <Play size={12} /> Start Workout
                          </Button>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>

            {/* Quick stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="glass-card p-4 rounded-2xl text-center">
                <Dumbbell size={16} className="mx-auto mb-1 text-primary" />
                <p className="text-lg font-bold">{entries.filter(e => e.completed).length}</p>
                <p className="text-[10px] text-muted-foreground">Completed</p>
              </div>
              <div className="glass-card p-4 rounded-2xl text-center">
                <CalendarDays size={16} className="mx-auto mb-1 text-accent" />
                <p className="text-lg font-bold">{entries.filter(e => {
                  const d = new Date(e.date);
                  return d.getMonth() === currentMonth.getMonth() && d.getFullYear() === currentMonth.getFullYear();
                }).length}</p>
                <p className="text-[10px] text-muted-foreground">This Month</p>
              </div>
            </div>

            {/* Challenges Progress */}
            {challenges.filter(c => c.joined && !c.completed).length > 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="glass-card p-4 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-heading font-bold uppercase tracking-wider text-muted-foreground">Challenges</h3>
                  <Link to="/records" className="text-xs text-primary hover:underline">View All</Link>
                </div>
                {challenges.filter(c => c.joined && !c.completed).slice(0, 3).map(c => {
                  const pct = Math.min((c.progress / c.target) * 100, 100);
                  return (
                    <div key={c.id} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm">{c.icon}</span>
                          <span className="text-xs font-medium truncate max-w-[110px]">{c.name}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{Math.round(pct)}%</span>
                      </div>
                      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div className={`h-full bg-gradient-to-r ${c.color} rounded-full transition-all`}
                          style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
                <div className="flex items-center gap-1.5 pt-1 border-t border-white/[0.05]">
                  <Trophy size={12} className="text-warning" />
                  <span className="text-xs text-muted-foreground">
                    {challenges.filter(c => c.completed).length} completed · {challenges.filter(c => c.completed).reduce((s, c) => s + c.xpReward, 0)} XP
                  </span>
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* Add to Calendar Modal */}
        <AnimatePresence>
          {showAddModal && selectedDate && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setShowAddModal(false)}>
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                className="glass-card w-full max-w-md p-6 rounded-2xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-heading font-bold text-lg">Schedule Workout</h3>
                    <p className="text-xs text-muted-foreground">{format(selectedDate, "EEEE, MMMM d, yyyy")}</p>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => setShowAddModal(false)}><X size={18} /></Button>
                </div>

                {plans.length === 0 ? (
                  <div className="text-center py-8">
                    <Dumbbell size={32} className="mx-auto text-muted-foreground/30 mb-3" />
                    <p className="text-sm text-muted-foreground mb-3">No workout plans yet</p>
                    <Button onClick={() => navigate("/workout-planner")}
                      className="gradient-bg text-primary-foreground rounded-xl gap-2">
                      <Plus size={14} /> Create a Plan
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {plans.map(plan => (
                      <button key={plan.id} onClick={() => addEntry(plan.id, plan.name, selectedDate)}
                        className="w-full flex items-center justify-between p-4 rounded-xl bg-secondary/40 hover:bg-secondary/80 transition-colors text-left group">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{plan.name}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            <span>{plan.exercises?.length || 0} exercises</span>
                            {plan.days?.length ? (
                              <span>· {plan.days.join(", ")}</span>
                            ) : null}
                          </div>
                        </div>
                        <Plus size={18} className="text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    ))}
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppLayout>
  );
}
