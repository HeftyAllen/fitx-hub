import { useState, useEffect } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Dumbbell, Play, Trash2, Copy, Edit2, Search, X, ChevronDown, ChevronUp,
  Clock, Target, Heart, Info, Filter, Layers, Calendar as CalIcon, LayoutGrid, List,
  Zap, GripVertical, BookOpen
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, Timestamp } from "firebase/firestore";
import { searchExercises, getExercisesByBodyPart, getExercisesByEquipment } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
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
const BODY_PARTS = ["back", "cardio", "chest", "lower arms", "lower legs", "neck", "shoulders", "upper arms", "upper legs", "waist"];
const EQUIPMENT = ["barbell", "dumbbell", "cable", "body weight", "machine", "kettlebell", "band", "smith machine"];

const MUSCLE_COLORS: Record<string, string> = {
  chest: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  back: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  legs: "bg-green-500/20 text-green-400 border-green-500/30",
  shoulders: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  arms: "bg-pink-500/20 text-pink-400 border-pink-500/30",
  core: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  cardio: "bg-red-500/20 text-red-400 border-red-500/30",
  waist: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  neck: "bg-teal-500/20 text-teal-400 border-teal-500/30",
  default: "bg-primary/20 text-primary border-primary/30",
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
  const [activeTab, setActiveTab] = useState<"plans" | "library">("plans");

  useEffect(() => { if (user) fetchPlans(); }, [user]);

  const fetchPlans = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "users", user.uid, "workoutPlans"));
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as WorkoutPlan));
      data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setPlans(data);
    } catch (e) { console.error(e); }
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
      ...rest, name: `${rest.name} (Copy)`, createdAt: Timestamp.now(),
    });
    setPlans(p => [{ ...rest, id: ref.id, name: `${rest.name} (Copy)`, createdAt: Timestamp.now() }, ...p]);
    toast.success("Plan duplicated");
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-heading font-bold gradient-text">Workout Planner</h1>
            <p className="text-xs text-muted-foreground mt-1">Build, manage and start your workout plans</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => { setEditingPlan(null); setShowCreate(true); }}
              className="gradient-bg text-primary-foreground rounded-xl glow-pulse gap-2"
            >
              <Plus size={16} /> New Plan
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-secondary/40 rounded-2xl w-fit border border-white/[0.05]">
          {[
            { id: "plans" as const, label: "My Plans", icon: LayoutGrid },
            { id: "library" as const, label: "Exercise Library", icon: BookOpen },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? "gradient-bg text-primary-foreground shadow-lg"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <tab.icon size={15} /> {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          {activeTab === "plans" ? (
            <motion.div key="plans" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <PlansTab
                plans={plans}
                loading={loading}
                onEdit={(p) => { setEditingPlan(p); setShowCreate(true); }}
                onDelete={deletePlan}
                onDuplicate={duplicatePlan}
                onStart={(p) => navigate("/workout-session", { state: { plan: p } })}
                onCreate={() => setShowCreate(true)}
              />
            </motion.div>
          ) : (
            <motion.div key="library" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <ExerciseLibraryTab plans={plans} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Create/Edit Modal */}
        <AnimatePresence>
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
                  const ref = await addDoc(collection(db, "users", user.uid, "workoutPlans"), { ...plan, createdAt: Timestamp.now() });
                  setPlans(p => [{ ...plan, id: ref.id, createdAt: Timestamp.now() } as WorkoutPlan, ...p]);
                  toast.success("Plan created!");
                }
                setShowCreate(false);
                setEditingPlan(null);
              }}
            />
          )}
        </AnimatePresence>
      </div>
    </AppLayout>
  );
}

/* ============ PLANS TAB ============ */

function PlansTab({ plans, loading, onEdit, onDelete, onDuplicate, onStart, onCreate }: {
  plans: WorkoutPlan[];
  loading: boolean;
  onEdit: (p: WorkoutPlan) => void;
  onDelete: (id: string) => void;
  onDuplicate: (p: WorkoutPlan) => void;
  onStart: (p: WorkoutPlan) => void;
  onCreate: () => void;
}) {
  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="glass-card p-6 h-44 shimmer rounded-2xl" />
        ))}
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-12 rounded-2xl">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 rounded-3xl gradient-bg flex items-center justify-center mb-6 shadow-lg shadow-primary/20">
            <Dumbbell size={36} className="text-primary-foreground" />
          </div>
          <h3 className="font-heading font-bold text-xl mb-2 text-foreground">No Workout Plans Yet</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-sm">
            Create your first plan by adding exercises, setting reps & sets, and scheduling workout days.
          </p>
          <Button onClick={onCreate} className="gradient-bg text-primary-foreground rounded-xl gap-2 px-6 py-3 glow-pulse">
            <Plus size={16} /> Create Your First Plan
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {plans.map((plan, idx) => (
        <motion.div
          key={plan.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.05 }}
          className="glass-card rounded-2xl overflow-hidden group hover:border-white/[0.15] transition-all"
        >
          {/* Plan header with gradient accent */}
          <div className="h-1.5 gradient-bg" />
          <div className="p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <h3 className="font-heading font-bold text-lg text-foreground truncate">{plan.name}</h3>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Dumbbell size={12} /> {plan.exercises?.length || 0} exercises</span>
                  <span className="flex items-center gap-1">
                    <Clock size={12} /> ~{Math.round((plan.exercises?.reduce((s, e) => s + e.sets * 1.5 + (e.restSeconds * e.sets / 60), 0) || 0))} min
                  </span>
                </div>
              </div>
              <Button
                onClick={() => onStart(plan)}
                className="gradient-bg text-primary-foreground rounded-xl gap-1.5 text-xs px-4 shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-shadow"
              >
                <Play size={14} /> Start
              </Button>
            </div>

            {/* Scheduled days */}
            {plan.days && plan.days.length > 0 && (
              <div className="flex gap-1.5">
                {DAYS.map(d => (
                  <span
                    key={d}
                    className={`text-[10px] px-2.5 py-1 rounded-lg font-medium transition-all ${
                      plan.days?.includes(d)
                        ? "gradient-bg text-primary-foreground"
                        : "bg-secondary/60 text-muted-foreground/50"
                    }`}
                  >
                    {d}
                  </span>
                ))}
              </div>
            )}

            {/* Exercise preview */}
            <div className="flex flex-wrap gap-1.5">
              {plan.exercises?.slice(0, 5).map((ex, i) => (
                <span key={i} className={`text-[10px] px-2 py-1 rounded-lg border ${getMuscleColor(ex.bodyPart)}`}>
                  {ex.name.length > 18 ? ex.name.slice(0, 18) + "…" : ex.name}
                </span>
              ))}
              {(plan.exercises?.length || 0) > 5 && (
                <span className="text-[10px] px-2 py-1 rounded-lg bg-secondary/60 text-muted-foreground">
                  +{plan.exercises.length - 5} more
                </span>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 pt-1 border-t border-white/[0.05]">
              <Button size="sm" variant="ghost" className="text-xs text-muted-foreground hover:text-foreground gap-1 h-8" onClick={() => onEdit(plan)}>
                <Edit2 size={12} /> Edit
              </Button>
              <Button size="sm" variant="ghost" className="text-xs text-muted-foreground hover:text-foreground gap-1 h-8" onClick={() => onDuplicate(plan)}>
                <Copy size={12} /> Duplicate
              </Button>
              <div className="flex-1" />
              <Button size="sm" variant="ghost" className="text-xs text-muted-foreground hover:text-destructive gap-1 h-8" onClick={() => onDelete(plan.id)}>
                <Trash2 size={12} /> Delete
              </Button>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

/* ============ EXERCISE LIBRARY TAB ============ */

function ExerciseLibraryTab({ plans }: { plans: WorkoutPlan[] }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [bodyPart, setBodyPart] = useState("");
  const [equipmentFilter, setEquipmentFilter] = useState("");
  const [query, setQuery] = useState("chest");
  const [showFilters, setShowFilters] = useState(false);
  const [detailExercise, setDetailExercise] = useState<any>(null);
  const [addToPlanExercise, setAddToPlanExercise] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["exercises-planner", query, bodyPart, equipmentFilter],
    queryFn: () => {
      if (equipmentFilter) return getExercisesByEquipment(equipmentFilter);
      if (bodyPart) return getExercisesByBodyPart(bodyPart);
      return searchExercises(query || "chest");
    },
    staleTime: 60000,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setBodyPart("");
    setEquipmentFilter("");
    setQuery(search);
  };

  const quickStart = (exercise: any) => {
    const miniPlan = {
      id: `quick-${Date.now()}`,
      name: `Quick: ${exercise.name}`,
      exercises: [{
        id: exercise.id, name: exercise.name, gifUrl: exercise.gifUrl,
        bodyPart: exercise.bodyPart, equipment: exercise.equipment,
        target: exercise.target, sets: 3, reps: 10, restSeconds: 60,
      }],
    };
    navigate("/workout-session", { state: { plan: miniPlan } });
    toast.success("Starting quick workout!");
  };

  return (
    <div className="space-y-4">
      {/* Search & Filter */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder="Search exercises..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 rounded-2xl bg-secondary/60 border border-white/[0.08] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-sm"
          />
        </div>
        <Button type="submit" className="gradient-bg text-primary-foreground rounded-2xl px-5">Search</Button>
        <Button type="button" variant="outline" onClick={() => setShowFilters(!showFilters)} className="rounded-2xl border-white/[0.08] gap-1">
          <Filter size={14} />
          <ChevronDown size={12} className={`transition-transform ${showFilters ? "rotate-180" : ""}`} />
        </Button>
      </form>

      {/* Filters */}
      <AnimatePresence>
        {showFilters && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="glass-card p-4 rounded-2xl">
              <label className="text-xs font-heading font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Equipment</label>
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => setEquipmentFilter("")}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${!equipmentFilter ? "gradient-bg text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
                  All
                </button>
                {EQUIPMENT.map(eq => (
                  <button key={eq} onClick={() => { setEquipmentFilter(eq); setBodyPart(""); setQuery(""); }}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all capitalize ${equipmentFilter === eq ? "gradient-bg text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
                    {eq}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Body part chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        <button onClick={() => { setBodyPart(""); setEquipmentFilter(""); setQuery("chest"); }}
          className={`px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all ${!bodyPart && !equipmentFilter ? "gradient-bg text-primary-foreground" : "bg-secondary/60 text-muted-foreground hover:text-foreground border border-white/[0.05]"}`}>
          All
        </button>
        {BODY_PARTS.map(bp => (
          <button key={bp} onClick={() => { setBodyPart(bp); setEquipmentFilter(""); setQuery(""); setSearch(""); }}
            className={`px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all capitalize ${bodyPart === bp ? "gradient-bg text-primary-foreground" : "bg-secondary/60 text-muted-foreground hover:text-foreground border border-white/[0.05]"}`}>
            {bp}
          </button>
        ))}
      </div>

      {!isLoading && data && <p className="text-xs text-muted-foreground">{data.length} exercises found</p>}

      {/* Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {isLoading
          ? Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="glass-card overflow-hidden rounded-2xl">
              <div className="aspect-square bg-secondary shimmer" />
              <div className="p-3.5 space-y-2">
                <div className="h-3 bg-secondary rounded shimmer w-3/4" />
                <div className="h-2.5 bg-secondary rounded shimmer w-1/2" />
              </div>
            </div>
          ))
          : (data || []).map((ex: any) => (
            <motion.div
              key={ex.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card overflow-hidden group hover:scale-[1.02] hover:border-white/[0.15] transition-all duration-300 rounded-2xl"
            >
              <div className="aspect-square bg-secondary overflow-hidden relative">
                <img src={ex.gifUrl} alt={ex.name} className="w-full h-full object-cover" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-3 gap-2">
                  <Button size="sm" onClick={() => quickStart(ex)}
                    className="gradient-bg text-primary-foreground rounded-xl text-xs gap-1 flex-1">
                    <Zap size={12} /> Quick Start
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setAddToPlanExercise(ex)}
                    className="rounded-xl text-xs border-white/20 bg-black/40 backdrop-blur-sm text-foreground hover:bg-white/10">
                    <Plus size={12} />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setDetailExercise(ex)}
                    className="rounded-xl text-xs border-white/20 bg-black/40 backdrop-blur-sm text-foreground hover:bg-white/10">
                    <Info size={12} />
                  </Button>
                </div>
              </div>
              <div className="p-3.5 space-y-2">
                <h3 className="font-heading font-bold text-xs uppercase truncate">{ex.name}</h3>
                <div className="flex flex-wrap gap-1.5">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${getMuscleColor(ex.bodyPart)}`}>{ex.target}</span>
                  <span className="px-2 py-0.5 rounded-full bg-secondary text-muted-foreground text-[10px] border border-white/[0.05]">{ex.equipment}</span>
                </div>
              </div>
            </motion.div>
          ))}
      </div>

      {!isLoading && data?.length === 0 && (
        <div className="text-center py-12">
          <Dumbbell size={40} className="mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">No exercises found. Try a different search.</p>
        </div>
      )}

      {/* Detail Modal */}
      <AnimatePresence>
        {detailExercise && (
          <ExerciseDetailModal
            exercise={detailExercise}
            onClose={() => setDetailExercise(null)}
            onQuickStart={quickStart}
            onAddToPlan={() => { setAddToPlanExercise(detailExercise); setDetailExercise(null); }}
          />
        )}
      </AnimatePresence>

      {/* Add to Plan Modal */}
      <AnimatePresence>
        {addToPlanExercise && (
          <AddToPlanModal
            exercise={addToPlanExercise}
            plans={plans}
            onClose={() => setAddToPlanExercise(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ============ EXERCISE DETAIL MODAL ============ */

function ExerciseDetailModal({ exercise, onClose, onQuickStart, onAddToPlan }: {
  exercise: any; onClose: () => void; onQuickStart: (ex: any) => void; onAddToPlan: () => void;
}) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
        className="glass-card w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl" onClick={e => e.stopPropagation()}>
        <div className="relative">
          <img src={exercise.gifUrl} alt={exercise.name} className="w-full aspect-square object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
          <Button size="icon" variant="ghost" className="absolute top-3 right-3 bg-black/40 backdrop-blur-sm text-foreground hover:bg-black/60 rounded-xl" onClick={onClose}>
            <X size={18} />
          </Button>
        </div>
        <div className="p-6 space-y-4 -mt-12 relative z-10">
          <div>
            <h2 className="text-xl font-heading font-bold capitalize">{exercise.name}</h2>
            <div className="flex flex-wrap gap-2 mt-2">
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${getMuscleColor(exercise.bodyPart)}`}>
                <Target size={10} className="inline mr-1" />{exercise.target}
              </span>
              <span className="px-2.5 py-1 rounded-full bg-secondary text-muted-foreground text-xs border border-white/[0.05]">
                <Dumbbell size={10} className="inline mr-1" />{exercise.equipment}
              </span>
              <span className="px-2.5 py-1 rounded-full bg-secondary text-muted-foreground text-xs border border-white/[0.05]">
                <Layers size={10} className="inline mr-1" />{exercise.bodyPart}
              </span>
            </div>
          </div>

          {exercise.secondaryMuscles?.length > 0 && (
            <div>
              <h4 className="text-xs font-heading font-bold uppercase tracking-wider text-muted-foreground mb-2">Secondary Muscles</h4>
              <div className="flex flex-wrap gap-1.5">
                {exercise.secondaryMuscles.map((m: string, i: number) => (
                  <span key={i} className="px-2 py-0.5 rounded-full bg-secondary/80 text-muted-foreground text-xs capitalize">{m}</span>
                ))}
              </div>
            </div>
          )}

          {exercise.instructions?.length > 0 && (
            <div>
              <h4 className="text-xs font-heading font-bold uppercase tracking-wider text-muted-foreground mb-2">Instructions</h4>
              <ol className="space-y-2">
                {exercise.instructions.map((inst: string, i: number) => (
                  <li key={i} className="flex gap-3 text-sm text-muted-foreground">
                    <span className="font-bold text-primary shrink-0">{i + 1}.</span>
                    <span>{inst}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button onClick={() => { onQuickStart(exercise); onClose(); }}
              className="flex-1 gradient-bg text-primary-foreground rounded-xl gap-2">
              <Zap size={16} /> Quick Start
            </Button>
            <Button onClick={onAddToPlan} variant="outline"
              className="flex-1 rounded-xl border-white/10 gap-2">
              <Plus size={16} /> Add to Plan
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ============ ADD TO PLAN MODAL ============ */

function AddToPlanModal({ exercise, plans, onClose }: { exercise: any; plans: WorkoutPlan[]; onClose: () => void }) {
  const { user } = useAuth();
  const [sets, setSets] = useState(3);
  const [reps, setReps] = useState(10);
  const [rest, setRest] = useState(60);

  const addToPlan = async (plan: WorkoutPlan) => {
    if (!user) return;
    const newExercise: ExerciseInPlan = {
      id: exercise.id, name: exercise.name, gifUrl: exercise.gifUrl,
      bodyPart: exercise.bodyPart, equipment: exercise.equipment,
      target: exercise.target, sets, reps, restSeconds: rest,
    };
    const updatedExercises = [...(plan.exercises || []), newExercise];
    await updateDoc(doc(db, "users", user.uid, "workoutPlans", plan.id), { exercises: updatedExercises });
    toast.success(`Added to "${plan.name}"`);
    onClose();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        className="glass-card w-full max-w-md p-6 rounded-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading font-bold text-lg">Add to Plan</h3>
          <Button size="icon" variant="ghost" onClick={onClose}><X size={18} /></Button>
        </div>

        <div className="flex items-center gap-3 mb-4 p-3 glass-card rounded-xl">
          {exercise.gifUrl && <img src={exercise.gifUrl} alt="" className="w-12 h-12 rounded-lg object-cover" />}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium capitalize truncate">{exercise.name}</p>
            <p className="text-xs text-muted-foreground capitalize">{exercise.target} · {exercise.equipment}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-5">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Sets</label>
            <Input type="number" value={sets} onChange={e => setSets(parseInt(e.target.value) || 1)} min={1}
              className="bg-secondary/50 border-white/10 rounded-xl text-sm text-center" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Reps</label>
            <Input type="number" value={reps} onChange={e => setReps(parseInt(e.target.value) || 1)} min={1}
              className="bg-secondary/50 border-white/10 rounded-xl text-sm text-center" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Rest (s)</label>
            <Input type="number" value={rest} onChange={e => setRest(parseInt(e.target.value) || 0)} min={0} step={5}
              className="bg-secondary/50 border-white/10 rounded-xl text-sm text-center" />
          </div>
        </div>

        {plans.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground text-sm">
            <p>No plans yet. Create a plan first.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            <p className="text-xs text-muted-foreground mb-2">Select a plan:</p>
            {plans.map(plan => (
              <button key={plan.id} onClick={() => addToPlan(plan)}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-secondary/40 hover:bg-secondary/80 transition-colors text-left">
                <div>
                  <p className="text-sm font-medium">{plan.name}</p>
                  <p className="text-xs text-muted-foreground">{plan.exercises?.length || 0} exercises</p>
                </div>
                <Plus size={16} className="text-primary" />
              </button>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

/* ============ CREATE / EDIT PLAN MODAL ============ */

function CreatePlanModal({ existingPlan, onClose, onSave }: {
  existingPlan: WorkoutPlan | null;
  onClose: () => void;
  onSave: (plan: { name: string; exercises: ExerciseInPlan[]; days: string[] }) => void;
}) {
  const [name, setName] = useState(existingPlan?.name || "");
  const [exercises, setExercises] = useState<ExerciseInPlan[]>(existingPlan?.exercises || []);
  const [days, setDays] = useState<string[]>(existingPlan?.days || []);
  const [showSearch, setShowSearch] = useState(false);
  const [showCustom, setShowCustom] = useState(false);

  const addExercise = (ex: ExerciseInPlan) => { setExercises(prev => [...prev, ex]); setShowSearch(false); };
  const removeExercise = (idx: number) => { setExercises(prev => prev.filter((_, i) => i !== idx)); };
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

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        className="glass-card w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6 rounded-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-heading font-bold">{existingPlan ? "Edit Plan" : "Create Workout Plan"}</h2>
          <Button size="icon" variant="ghost" onClick={onClose}><X size={18} /></Button>
        </div>

        <div className="space-y-5">
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Plan Name</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Push Day, Leg Day..."
              className="bg-secondary/50 border-white/10 rounded-xl" />
          </div>

          <div>
            <label className="text-sm text-muted-foreground mb-2 block">Schedule Days</label>
            <div className="flex gap-2">
              {DAYS.map(d => (
                <button key={d} onClick={() => setDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])}
                  className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all ${days.includes(d) ? "gradient-bg text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
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
                  <Search size={14} /> Browse
                </Button>
              </div>
            </div>

            <AnimatePresence>
              {showSearch && <ExerciseSearchPanel onAdd={addExercise} onClose={() => setShowSearch(false)} />}
              {showCustom && <CustomExerciseForm onAdd={(ex) => { addExercise(ex); setShowCustom(false); }} onClose={() => setShowCustom(false)} />}
            </AnimatePresence>

            <div className="space-y-2 mt-3">
              {exercises.map((ex, idx) => (
                <motion.div key={idx} layout initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                  className="glass-card p-3 rounded-xl flex items-center gap-3">
                  <div className="flex flex-col gap-0.5">
                    <button onClick={() => moveExercise(idx, -1)} className="text-muted-foreground hover:text-foreground"><ChevronUp size={14} /></button>
                    <button onClick={() => moveExercise(idx, 1)} className="text-muted-foreground hover:text-foreground"><ChevronDown size={14} /></button>
                  </div>
                  {ex.gifUrl && <img src={ex.gifUrl} alt={ex.name} className="w-12 h-12 rounded-lg object-cover" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{ex.name}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${getMuscleColor(ex.bodyPart)}`}>{ex.target || ex.bodyPart}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    {[
                      { label: "Sets", field: "sets", val: ex.sets, min: 1, w: "w-12" },
                      { label: "Reps", field: "reps", val: ex.reps, min: 1, w: "w-12" },
                      { label: "Rest", field: "restSeconds", val: ex.restSeconds, min: 0, w: "w-14" },
                    ].map(f => (
                      <div key={f.field} className="text-center">
                        <label className="text-muted-foreground block">{f.label}</label>
                        <input type="number" value={f.val}
                          onChange={e => updateExercise(idx, f.field, parseInt(e.target.value) || f.min)}
                          className={`${f.w} bg-secondary/80 rounded-lg px-2 py-1 text-center text-foreground border border-white/10`}
                          min={f.min} />
                      </div>
                    ))}
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
            <Button onClick={() => {
              if (!name.trim()) { toast.error("Enter a plan name"); return; }
              if (exercises.length === 0) { toast.error("Add at least one exercise"); return; }
              onSave({ name: name.trim(), exercises, days });
            }} className="flex-1 gradient-bg text-primary-foreground rounded-xl">
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
    } catch { toast.error("Search failed"); }
    setSearching(false);
  };

  return (
    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
      <div className="glass-card p-4 rounded-xl mt-2 space-y-3">
        <div className="flex gap-2">
          <Input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && doSearch()}
            placeholder="Search exercises..." className="bg-secondary/50 border-white/10 rounded-xl text-sm" />
          <Button size="sm" onClick={doSearch} className="gradient-bg text-primary-foreground rounded-xl">{searching ? "..." : "Search"}</Button>
          <Button size="sm" variant="ghost" onClick={onClose}><X size={16} /></Button>
        </div>
        <div className="max-h-48 overflow-y-auto space-y-1.5">
          {results.map(r => (
            <button key={r.id} onClick={() => onAdd({
              id: r.id, name: r.name, gifUrl: r.gifUrl, bodyPart: r.bodyPart,
              equipment: r.equipment, target: r.target, sets: 3, reps: 10, restSeconds: 60,
            })} className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 transition text-left">
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
            <select value={bodyPart} onChange={e => setBodyPart(e.target.value)}
              className="w-full bg-secondary/80 border border-white/10 rounded-xl px-3 py-2 text-sm text-foreground">
              {BODY_PARTS.map(bp => <option key={bp} value={bp}>{bp}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Equipment</label>
            <select value={equipment} onChange={e => setEquipment(e.target.value)}
              className="w-full bg-secondary/80 border border-white/10 rounded-xl px-3 py-2 text-sm text-foreground">
              {EQUIPMENT.map(eq => <option key={eq} value={eq}>{eq}</option>)}
            </select>
          </div>
        </div>
        <Input value={target} onChange={e => setTarget(e.target.value)} placeholder="Target muscle (optional)" className="bg-secondary/50 border-white/10 rounded-xl text-sm" />
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Sets", val: sets, set: setSets },
            { label: "Reps", val: reps, set: setReps },
            { label: "Rest (s)", val: rest, set: setRest },
          ].map(f => (
            <div key={f.label}>
              <label className="text-xs text-muted-foreground mb-1 block">{f.label}</label>
              <Input type="number" value={f.val} onChange={e => f.set(parseInt(e.target.value) || 0)} min={0}
                className="bg-secondary/50 border-white/10 rounded-xl text-sm text-center" />
            </div>
          ))}
        </div>
        <Button className="w-full gradient-bg text-primary-foreground rounded-xl text-sm"
          onClick={() => {
            if (!name.trim()) { toast.error("Enter exercise name"); return; }
            onAdd({ id: `custom-${Date.now()}`, name: name.trim(), bodyPart, equipment, target: target || bodyPart, sets, reps, restSeconds: rest });
          }}>
          Add Exercise
        </Button>
      </div>
    </motion.div>
  );
}
