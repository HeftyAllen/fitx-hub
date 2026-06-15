import { useEffect, useMemo, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { motion } from "framer-motion";
import { Sparkles, X, Plus, Loader2 } from "lucide-react";
import { format, startOfWeek, addDays } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MEALS = ["Breakfast", "Lunch", "Dinner", "Snack"] as const;
type Meal = typeof MEALS[number];

interface PlanCell { title: string; calories?: number; }
type WeekPlan = Record<string, PlanCell | undefined>; // key: `${day}-${meal}`

function weekKey(d: Date) { return format(startOfWeek(d, { weekStartsOn: 1 }), "yyyy-'W'II"); }

export default function MealPlanner() {
  const { user } = useAuth();
  const [weekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [plan, setPlan] = useState<WeekPlan>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<{ day: string; meal: Meal } | null>(null);
  const [title, setTitle] = useState("");
  const [cal, setCal] = useState("");
  const [saving, setSaving] = useState(false);

  const wk = useMemo(() => weekKey(weekStart), [weekStart]);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    const ref = doc(db, "users", user.uid, "mealPlan", wk);
    const unsub = onSnapshot(ref, (snap) => {
      setPlan(snap.exists() ? ((snap.data().cells || {}) as WeekPlan) : {});
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [user, wk]);

  const persist = async (next: WeekPlan) => {
    if (!user) return;
    await setDoc(doc(db, "users", user.uid, "mealPlan", wk), { cells: next, updatedAt: Date.now() }, { merge: true });
  };

  const openEditor = (day: string, meal: Meal) => {
    const cell = plan[`${day}-${meal}`];
    setTitle(cell?.title ?? "");
    setCal(cell?.calories ? String(cell.calories) : "");
    setEditing({ day, meal });
  };

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const next = { ...plan };
      const k = `${editing.day}-${editing.meal}`;
      if (!title.trim()) {
        delete next[k];
      } else {
        next[k] = { title: title.trim(), ...(cal ? { calories: Number(cal) } : {}) };
      }
      setPlan(next);
      await persist(next);
      toast.success("Meal plan updated");
      setEditing(null);
    } catch {
      toast.error("Save failed");
    } finally { setSaving(false); }
  };

  const clearWeek = async () => {
    if (!confirm("Clear all meals this week?")) return;
    setPlan({});
    await persist({});
    toast.success("Week cleared");
  };

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto p-4 md:p-6 pt-20 space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-heading font-bold">Meal Planner</h1>
            <p className="text-xs text-muted-foreground mt-1">Week of {format(weekStart, "d MMM yyyy")}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={clearWeek} className="px-3 py-2 rounded-xl bg-secondary text-xs font-semibold text-muted-foreground hover:text-foreground">
              Clear week
            </button>
            <button disabled className="flex items-center gap-2 px-4 py-2 rounded-xl gradient-bg text-primary-foreground text-sm font-medium opacity-60 cursor-not-allowed">
              <Sparkles size={16} /> Generate Plan
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="animate-spin text-primary" />
          </div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="overflow-x-auto">
            <div className="min-w-[760px] grid grid-cols-8 gap-2">
              <div />
              {DAYS.map((d, i) => (
                <div key={d} className="text-center text-xs font-heading font-bold text-muted-foreground py-2">
                  <div>{d}</div>
                  <div className="text-[10px] font-normal text-muted-foreground/70">{format(addDays(weekStart, i), "d MMM")}</div>
                </div>
              ))}
              {MEALS.map((meal) => (
                <div key={meal} className="contents">
                  <div className="flex items-center text-xs font-bold text-muted-foreground px-1">{meal}</div>
                  {DAYS.map((day) => {
                    const cell = plan[`${day}-${meal}`];
                    return (
                      <button key={`${meal}-${day}`} onClick={() => openEditor(day, meal)}
                        className={`glass-card p-2 min-h-[72px] flex flex-col items-start justify-center gap-1 text-xs hover:border-primary/40 transition-colors rounded-xl text-left ${
                          cell ? "border-primary/30 bg-primary/5" : "text-muted-foreground"
                        }`}>
                        {cell ? (
                          <>
                            <span className="font-semibold text-foreground leading-tight line-clamp-2">{cell.title}</span>
                            {cell.calories ? <span className="text-[10px] text-amber-400 font-bold">{cell.calories} cal</span> : null}
                          </>
                        ) : (
                          <span className="flex items-center gap-1 opacity-70"><Plus size={11} /> Add</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing?.meal} · {editing?.day}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Meal name</label>
              <input value={title} onChange={e => setTitle(e.target.value)} autoFocus
                placeholder="e.g. Chicken & rice"
                className="w-full px-3 py-2.5 rounded-xl bg-secondary text-sm focus:outline-none focus:ring-1 focus:ring-primary/50" />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Calories (optional)</label>
              <input value={cal} onChange={e => setCal(e.target.value)} type="number" min={0}
                placeholder="kcal"
                className="w-full px-3 py-2.5 rounded-xl bg-secondary text-sm focus:outline-none focus:ring-1 focus:ring-primary/50" />
            </div>
          </div>
          <div className="flex justify-between gap-2">
            <button onClick={() => { setTitle(""); setCal(""); }} className="px-3 py-2 rounded-lg bg-secondary text-xs text-muted-foreground hover:text-destructive">
              Clear
            </button>
            <div className="flex gap-2">
              <button onClick={() => setEditing(null)} className="px-3 py-2 rounded-lg bg-secondary text-sm">Cancel</button>
              <button onClick={save} disabled={saving}
                className="px-4 py-2 rounded-lg gradient-bg text-primary-foreground text-sm font-bold disabled:opacity-60">
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
