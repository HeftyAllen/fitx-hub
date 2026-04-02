import { useState, useEffect } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Dumbbell, Play, Trash2, Copy, Edit2, GripVertical, Search, X, ChevronDown, ChevronUp, Clock, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, Timestamp } from "firebase/firestore";
import { searchExercises } from "@/lib/api";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface ExerciseInPlan {
  id: string;
  name: string;
  gifUrl?: string;
  bodyPart: string;
  equipment: string;
  target: string;
  sets: number;
  reps: number;
  restSeconds: number;
  weight?: number;
}

interface WorkoutPlan {
  id: string;
  name: string;
  exercises: ExerciseInPlan[];
  createdAt: any;
  days?: string[];
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const MUSCLE_COLORS: Record<string, string> = {
  chest: "bg-blue-500/20 text-blue-400",
  back: "bg-purple-500/20 text-purple-400",
  legs: "bg-green-500/20 text-green-400",
  shoulders: "bg-orange-500/20 text-orange-400",
  arms: "bg-pink-500/20 text-pink-400",
  core: "bg-yellow-500/20 text-yellow-400",
  cardio: "bg-red-500/20 text-red-400",
  default: "bg-accent/20 text-accent",
};

function getMuscleColor(bodyPart: string) {
  const key = Object.keys(MUSCLE_COLORS).find(k => bodyPart.toLowerCase().includes(k));
  return MUSCLE_COLORS[key || "default"];
}

export default function WorkoutPlanner() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingPlan, setEditingPlan] = useState<WorkoutPlan | null>(null);

  useEffect(() => {
    if (user) fetchPlans();
  }, [user]);

  const fetchPlans = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "users", user.uid, "workoutPlans"));
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as WorkoutPlan));
      data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setPlans(data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const deletePlan = async (planId: string) => {
    if (!user) return;
    await deleteDoc(doc(db, "users", user.uid, "workoutPlans", planId));
    setPlans(p => p.filter(x => x.id !== planId));
    toast.success("Plan deleted");
  };

  const duplicatePlan = async (plan: WorkoutPlan) => {
    if (!user) return;
    const { id, ...rest } = plan;
    const ref = await addDoc(collection(db, "users", user.uid, "workoutPlans"), {
      ...rest,
      name: `${rest.name} (Copy)`,
      createdAt: Timestamp.now(),
    });
    setPlans(p => [{ ...rest, id: ref.id, name: `${rest.name} (Copy)`, createdAt: Timestamp.now() }, ...p]);
    toast.success("Plan duplicated");
  };

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl md:text-3xl font-heading font-bold gradient-text">Workout Planner</h1>
          <Button
            onClick={() => { setEditingPlan(null); setShowCreate(true); }}
            className="gradient-bg text-primary-foreground rounded-xl glow-pulse gap-2"
          >
            <Plus size={16} /> New Plan
          </Button>
        </div>

        <AnimatePresence mode="wait">
          {showCreate && (
            <CreatePlanModal
              existingPlan={editingPlan}
              onClose={() => { setShowCreate(false); setEditingPlan(null); }}
              onSave={async (plan) => {
                if (!user) return;
                if (editingPlan) {
                  await updateDoc(doc(db, "users", user.uid, "workoutPlans", editingPlan.id), plan);
                  setPlans(p => p.map(x => x.id === editingPlan.id ? { ...x, ...plan } : x));
                  toast.success("Plan updated");
                } else {
                  const ref = await addDoc(collection(db, "users", user.uid, "workoutPlans"), {
                    ...plan,
                    createdAt: Timestamp.now(),
                  });
                  setPlans(p => [{ ...plan, id: ref.id, createdAt: Timestamp.now() } as WorkoutPlan, ...p]);
                  toast.success("Plan created!");
                }
                setShowCreate(false);
                setEditingPlan(null);
              }}
            />
          )}
        </AnimatePresence>

        {loading ? (
          <div className="grid gap-4">
            {[1, 2].map(i => (
              <div key={i} className="glass-card p-6 h-32 shimmer rounded-2xl" />
            ))}
          </div>
        ) : plans.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-8">
            <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
              <Dumbbell size={48} className="mb-4 text-primary" />
              <h3 className="font-heading font-bold text-lg mb-1 text-foreground">No Workout Plans Yet</h3>
              <p className="text-sm mb-4">Create your first workout plan to get started</p>
              <Button onClick={() => setShowCreate(true)} className="gradient-bg text-primary-foreground rounded-xl gap-2">
                <Plus size={16} /> Create Your First Plan
              </Button>
            </div>
          </motion.div>
        ) : (
          <div className="grid gap-4">
            {plans.map((plan, idx) => (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="glass-card p-5 rounded-2xl hover:scale-[1.01] transition-transform"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-heading font-bold text-lg text-foreground">{plan.name}</h3>
                    <p className="text-sm text-muted-foreground">{plan.exercises?.length || 0} exercises</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground hover:text-primary"
                      onClick={() => navigate("/workout-session", { state: { plan } })}
                    >
                      <Play size={16} />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => { setEditingPlan(plan); setShowCreate(true); }}>
                      <Edit2 size={14} />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => duplicatePlan(plan)}>
                      <Copy size={14} />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => deletePlan(plan.id)}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
                {plan.days && plan.days.length > 0 && (
                  <div className="flex gap-1 mb-3">
                    {DAYS.map(d => (
                      <span key={d} className={`text-xs px-2 py-0.5 rounded-full ${plan.days?.includes(d) ? "gradient-bg text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                        {d}
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {plan.exercises?.slice(0, 6).map((ex, i) => (
                    <span key={i} className={`text-xs px-2 py-1 rounded-lg ${getMuscleColor(ex.bodyPart)}`}>
                      {ex.name.length > 20 ? ex.name.slice(0, 20) + "…" : ex.name}
                    </span>
                  ))}
                  {(plan.exercises?.length || 0) > 6 && (
                    <span className="text-xs px-2 py-1 rounded-lg bg-muted text-muted-foreground">+{plan.exercises.length - 6} more</span>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

/* ============ CREATE / EDIT PLAN MODAL ============ */

function CreatePlanModal({
  existingPlan,
  onClose,
  onSave,
}: {
  existingPlan: WorkoutPlan | null;
  onClose: () => void;
  onSave: (plan: { name: string; exercises: ExerciseInPlan[]; days: string[] }) => void;
}) {
  const [name, setName] = useState(existingPlan?.name || "");
  const [exercises, setExercises] = useState<ExerciseInPlan[]>(existingPlan?.exercises || []);
  const [days, setDays] = useState<string[]>(existingPlan?.days || []);
  const [showSearch, setShowSearch] = useState(false);
  const [showCustom, setShowCustom] = useState(false);

  const addExercise = (ex: ExerciseInPlan) => {
    setExercises(prev => [...prev, ex]);
    setShowSearch(false);
  };

  const removeExercise = (idx: number) => {
    setExercises(prev => prev.filter((_, i) => i !== idx));
  };

  const updateExercise = (idx: number, field: string, value: number) => {
    setExercises(prev => prev.map((ex, i) => i === idx ? { ...ex, [field]: value } : ex));
  };

  const moveExercise = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= exercises.length) return;
    const copy = [...exercises];
    [copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]];
    setExercises(copy);
  };

  const toggleDay = (d: string) => {
    setDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="glass-card w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6 rounded-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-heading font-bold">{existingPlan ? "Edit Plan" : "Create Workout Plan"}</h2>
          <Button size="icon" variant="ghost" onClick={onClose}><X size={18} /></Button>
        </div>

        <div className="space-y-5">
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Plan Name</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Push Day, Leg Day..." className="bg-secondary/50 border-white/10 rounded-xl" />
          </div>

          <div>
            <label className="text-sm text-muted-foreground mb-2 block">Schedule Days</label>
            <div className="flex gap-2">
              {DAYS.map(d => (
                <button
                  key={d}
                  onClick={() => toggleDay(d)}
                  className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all ${days.includes(d) ? "gradient-bg text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-muted-foreground">Exercises ({exercises.length})</label>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setShowCustom(true)} className="rounded-xl text-xs gap-1 border-white/10">
                  <Plus size={14} /> Custom
                </Button>
                <Button size="sm" onClick={() => setShowSearch(true)} className="gradient-bg text-primary-foreground rounded-xl text-xs gap-1">
                  <Search size={14} /> Search
                </Button>
              </div>
            </div>

            <AnimatePresence>
              {showSearch && (
                <ExerciseSearchPanel onAdd={addExercise} onClose={() => setShowSearch(false)} />
              )}
              {showCustom && (
                <CustomExerciseForm onAdd={(ex) => { addExercise(ex); setShowCustom(false); }} onClose={() => setShowCustom(false)} />
              )}
            </AnimatePresence>

            <div className="space-y-2 mt-3">
              {exercises.map((ex, idx) => (
                <motion.div
                  key={idx}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="glass-card p-3 rounded-xl flex items-center gap-3"
                >
                  <div className="flex flex-col gap-0.5">
                    <button onClick={() => moveExercise(idx, -1)} className="text-muted-foreground hover:text-foreground"><ChevronUp size={14} /></button>
                    <button onClick={() => moveExercise(idx, 1)} className="text-muted-foreground hover:text-foreground"><ChevronDown size={14} /></button>
                  </div>
                  {ex.gifUrl && <img src={ex.gifUrl} alt={ex.name} className="w-12 h-12 rounded-lg object-cover" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{ex.name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className={`px-1.5 py-0.5 rounded ${getMuscleColor(ex.bodyPart)}`}>{ex.target || ex.bodyPart}</span>
                      <span>{ex.equipment}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <div className="text-center">
                      <label className="text-muted-foreground block">Sets</label>
                      <input
                        type="number"
                        value={ex.sets}
                        onChange={e => updateExercise(idx, "sets", parseInt(e.target.value) || 1)}
                        className="w-12 bg-secondary/80 rounded-lg px-2 py-1 text-center text-foreground border border-white/10"
                        min={1}
                      />
                    </div>
                    <div className="text-center">
                      <label className="text-muted-foreground block">Reps</label>
                      <input
                        type="number"
                        value={ex.reps}
                        onChange={e => updateExercise(idx, "reps", parseInt(e.target.value) || 1)}
                        className="w-12 bg-secondary/80 rounded-lg px-2 py-1 text-center text-foreground border border-white/10"
                        min={1}
                      />
                    </div>
                    <div className="text-center">
                      <label className="text-muted-foreground block">Rest(s)</label>
                      <input
                        type="number"
                        value={ex.restSeconds}
                        onChange={e => updateExercise(idx, "restSeconds", parseInt(e.target.value) || 30)}
                        className="w-14 bg-secondary/80 rounded-lg px-2 py-1 text-center text-foreground border border-white/10"
                        min={0}
                        step={5}
                      />
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => removeExercise(idx)}>
                    <Trash2 size={14} />
                  </Button>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1 rounded-xl border-white/10">Cancel</Button>
            <Button
              onClick={() => {
                if (!name.trim()) { toast.error("Enter a plan name"); return; }
                if (exercises.length === 0) { toast.error("Add at least one exercise"); return; }
                onSave({ name: name.trim(), exercises, days });
              }}
              className="flex-1 gradient-bg text-primary-foreground rounded-xl"
            >
              {existingPlan ? "Update Plan" : "Save Plan"}
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ============ EXERCISE SEARCH PANEL ============ */

function ExerciseSearchPanel({ onAdd, onClose }: { onAdd: (ex: ExerciseInPlan) => void; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const doSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const data = await searchExercises(query);
      setResults(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Search failed");
    }
    setSearching(false);
  };

  return (
    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
      <div className="glass-card p-4 rounded-xl mt-2 space-y-3">
        <div className="flex gap-2">
          <Input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && doSearch()} placeholder="Search exercises..." className="bg-secondary/50 border-white/10 rounded-xl text-sm" />
          <Button size="sm" onClick={doSearch} className="gradient-bg text-primary-foreground rounded-xl">{searching ? "..." : "Search"}</Button>
          <Button size="sm" variant="ghost" onClick={onClose}><X size={16} /></Button>
        </div>
        <div className="max-h-48 overflow-y-auto space-y-1.5">
          {results.map(r => (
            <button
              key={r.id}
              onClick={() =>
                onAdd({
                  id: r.id,
                  name: r.name,
                  gifUrl: r.gifUrl,
                  bodyPart: r.bodyPart,
                  equipment: r.equipment,
                  target: r.target,
                  sets: 3,
                  reps: 10,
                  restSeconds: 60,
                })
              }
              className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 transition text-left"
            >
              {r.gifUrl && <img src={r.gifUrl} alt="" className="w-10 h-10 rounded-lg object-cover" />}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate capitalize">{r.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{r.target} · {r.equipment}</p>
              </div>
              <Plus size={16} className="text-primary shrink-0" />
            </button>
          ))}
          {results.length === 0 && !searching && query && <p className="text-xs text-muted-foreground text-center py-2">No results</p>}
        </div>
      </div>
    </motion.div>
  );
}

/* ============ CUSTOM EXERCISE FORM ============ */

function CustomExerciseForm({ onAdd, onClose }: { onAdd: (ex: ExerciseInPlan) => void; onClose: () => void }) {
  const [name, setName] = useState("");
  const [bodyPart, setBodyPart] = useState("chest");
  const [equipment, setEquipment] = useState("barbell");
  const [target, setTarget] = useState("");
  const [sets, setSets] = useState(3);
  const [reps, setReps] = useState(10);
  const [rest, setRest] = useState(60);

  const BODY_PARTS = ["chest", "back", "legs", "shoulders", "upper arms", "lower arms", "core", "cardio", "waist", "neck"];
  const EQUIPMENT_LIST = ["barbell", "dumbbell", "cable", "machine", "bodyweight", "kettlebell", "resistance band", "smith machine", "other"];

  return (
    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
      <div className="glass-card p-4 rounded-xl mt-2 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium">Add Custom Exercise</h4>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onClose}><X size={14} /></Button>
        </div>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="Exercise name" className="bg-secondary/50 border-white/10 rounded-xl text-sm" />
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Body Part</label>
            <select value={bodyPart} onChange={e => setBodyPart(e.target.value)} className="w-full bg-secondary/80 border border-white/10 rounded-xl px-3 py-2 text-sm text-foreground">
              {BODY_PARTS.map(bp => <option key={bp} value={bp} className="capitalize">{bp}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Equipment</label>
            <select value={equipment} onChange={e => setEquipment(e.target.value)} className="w-full bg-secondary/80 border border-white/10 rounded-xl px-3 py-2 text-sm text-foreground">
              {EQUIPMENT_LIST.map(eq => <option key={eq} value={eq}>{eq}</option>)}
            </select>
          </div>
        </div>
        <Input value={target} onChange={e => setTarget(e.target.value)} placeholder="Target muscle (optional)" className="bg-secondary/50 border-white/10 rounded-xl text-sm" />
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Sets</label>
            <Input type="number" value={sets} onChange={e => setSets(parseInt(e.target.value) || 1)} min={1} className="bg-secondary/50 border-white/10 rounded-xl text-sm text-center" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Reps</label>
            <Input type="number" value={reps} onChange={e => setReps(parseInt(e.target.value) || 1)} min={1} className="bg-secondary/50 border-white/10 rounded-xl text-sm text-center" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Rest (s)</label>
            <Input type="number" value={rest} onChange={e => setRest(parseInt(e.target.value) || 0)} min={0} step={5} className="bg-secondary/50 border-white/10 rounded-xl text-sm text-center" />
          </div>
        </div>
        <Button
          className="w-full gradient-bg text-primary-foreground rounded-xl text-sm"
          onClick={() => {
            if (!name.trim()) { toast.error("Enter exercise name"); return; }
            onAdd({ id: `custom-${Date.now()}`, name: name.trim(), bodyPart, equipment, target: target || bodyPart, sets, reps, restSeconds: rest });
          }}
        >
          Add Exercise
        </Button>
      </div>
    </motion.div>
  );
}
