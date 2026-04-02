import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { searchExercises, getExercisesByBodyPart, getExercisesByEquipment } from "@/lib/api";
import AppLayout from "@/components/layout/AppLayout";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Heart, X, Plus, Filter, ChevronDown, Dumbbell, Target, Layers, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const BODY_PARTS = ["back", "cardio", "chest", "lower arms", "lower legs", "neck", "shoulders", "upper arms", "upper legs", "waist"];
const EQUIPMENT = ["barbell", "dumbbell", "cable", "body weight", "machine", "kettlebell", "band", "smith machine", "leverage machine"];

const MUSCLE_COLORS: Record<string, string> = {
  chest: "bg-blue-500/20 text-blue-400 border-blue-500/20",
  back: "bg-purple-500/20 text-purple-400 border-purple-500/20",
  legs: "bg-green-500/20 text-green-400 border-green-500/20",
  shoulders: "bg-orange-500/20 text-orange-400 border-orange-500/20",
  arms: "bg-pink-500/20 text-pink-400 border-pink-500/20",
  cardio: "bg-red-500/20 text-red-400 border-red-500/20",
  waist: "bg-yellow-500/20 text-yellow-400 border-yellow-500/20",
  neck: "bg-teal-500/20 text-teal-400 border-teal-500/20",
};

function getMuscleColor(bodyPart: string) {
  const key = Object.keys(MUSCLE_COLORS).find(k => bodyPart.toLowerCase().includes(k));
  return MUSCLE_COLORS[key || "chest"] || "bg-primary/20 text-primary border-primary/20";
}

function ExerciseCard({ exercise, onQuickAdd, onDetail }: { exercise: any; onQuickAdd: (ex: any) => void; onDetail: (ex: any) => void }) {
  const [liked, setLiked] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card overflow-hidden group hover:scale-[1.02] hover:border-white/[0.15] transition-all duration-300 rounded-2xl"
    >
      <div className="aspect-square bg-secondary overflow-hidden relative">
        <img src={exercise.gifUrl} alt={exercise.name} className="w-full h-full object-cover" loading="lazy" />
        {/* Overlay actions */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-3 gap-2">
          <Button
            size="sm"
            onClick={(e) => { e.stopPropagation(); onQuickAdd(exercise); }}
            className="gradient-bg text-primary-foreground rounded-xl text-xs gap-1 flex-1"
          >
            <Plus size={12} /> Quick Add
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => { e.stopPropagation(); onDetail(exercise); }}
            className="rounded-xl text-xs border-white/20 bg-black/40 backdrop-blur-sm text-foreground hover:bg-white/10"
          >
            <Info size={12} />
          </Button>
        </div>
      </div>
      <div className="p-3.5 space-y-2">
        <h3 className="font-heading font-bold text-xs uppercase truncate">{exercise.name}</h3>
        <div className="flex flex-wrap gap-1.5">
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${getMuscleColor(exercise.bodyPart)}`}>{exercise.target}</span>
          <span className="px-2 py-0.5 rounded-full bg-secondary text-muted-foreground text-[10px] border border-white/[0.05]">{exercise.equipment}</span>
        </div>
        <div className="flex items-center justify-between pt-1">
          <span className="text-[10px] text-muted-foreground capitalize">{exercise.bodyPart}</span>
          <button onClick={(e) => { e.stopPropagation(); setLiked(!liked); }} className="p-1 hover:scale-110 transition-transform">
            <Heart size={14} className={liked ? "fill-destructive text-destructive" : "text-muted-foreground"} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function SkeletonCard() {
  return (
    <div className="glass-card overflow-hidden rounded-2xl">
      <div className="aspect-square bg-secondary shimmer" />
      <div className="p-3.5 space-y-2">
        <div className="h-3 bg-secondary rounded shimmer w-3/4" />
        <div className="h-2.5 bg-secondary rounded shimmer w-1/2" />
      </div>
    </div>
  );
}

function ExerciseDetailModal({ exercise, onClose, onQuickAdd }: { exercise: any; onClose: () => void; onQuickAdd: (ex: any) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="glass-card w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* GIF */}
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

          {exercise.secondaryMuscles && exercise.secondaryMuscles.length > 0 && (
            <div>
              <h4 className="text-xs font-heading font-bold uppercase tracking-wider text-muted-foreground mb-2">Secondary Muscles</h4>
              <div className="flex flex-wrap gap-1.5">
                {exercise.secondaryMuscles.map((m: string, i: number) => (
                  <span key={i} className="px-2 py-0.5 rounded-full bg-secondary/80 text-muted-foreground text-xs capitalize">{m}</span>
                ))}
              </div>
            </div>
          )}

          {exercise.instructions && exercise.instructions.length > 0 && (
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

          <Button
            onClick={() => { onQuickAdd(exercise); onClose(); }}
            className="w-full gradient-bg text-primary-foreground rounded-xl gap-2 py-3"
          >
            <Plus size={16} /> Add to Workout Session
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function ExerciseLibrary() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [bodyPart, setBodyPart] = useState("");
  const [equipmentFilter, setEquipmentFilter] = useState("");
  const [query, setQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [detailExercise, setDetailExercise] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["exercises", query, bodyPart, equipmentFilter],
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

  const quickAddToSession = (exercise: any) => {
    // Build a mini plan with just this exercise and navigate to session
    const miniPlan = {
      id: `quick-${Date.now()}`,
      name: `Quick: ${exercise.name}`,
      exercises: [{
        id: exercise.id,
        name: exercise.name,
        gifUrl: exercise.gifUrl,
        bodyPart: exercise.bodyPart,
        equipment: exercise.equipment,
        target: exercise.target,
        sets: 3,
        reps: 10,
        restSeconds: 60,
      }],
    };
    navigate("/workout-session", { state: { plan: miniPlan } });
    toast.success("Starting quick workout!");
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-heading font-bold gradient-text">Exercise Library</h1>
            <p className="text-xs text-muted-foreground mt-1">Browse, filter and add exercises to your workout</p>
          </div>
        </div>

        {/* Search + Filter bar */}
        <div className="space-y-3">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                placeholder="Search exercises..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-11 pr-4 py-3 rounded-2xl bg-secondary/60 border border-white/[0.08] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-sm"
              />
            </div>
            <Button type="submit" className="gradient-bg text-primary-foreground rounded-2xl px-5">Search</Button>
            <Button type="button" variant="outline" onClick={() => setShowFilters(!showFilters)} className="rounded-2xl border-white/[0.08] gap-1">
              <Filter size={14} /> Filters
              <ChevronDown size={12} className={`transition-transform ${showFilters ? "rotate-180" : ""}`} />
            </Button>
          </form>

          {/* Expanded filters */}
          <AnimatePresence>
            {showFilters && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="glass-card p-4 rounded-2xl space-y-3">
                  <div>
                    <label className="text-xs font-heading font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Equipment</label>
                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() => setEquipmentFilter("")}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${!equipmentFilter ? "gradient-bg text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
                      >
                        All
                      </button>
                      {EQUIPMENT.map(eq => (
                        <button
                          key={eq}
                          onClick={() => { setEquipmentFilter(eq); setBodyPart(""); setQuery(""); }}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all capitalize ${equipmentFilter === eq ? "gradient-bg text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
                        >
                          {eq}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Body Part chips */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={() => { setBodyPart(""); setEquipmentFilter(""); setQuery("chest"); }}
            className={`px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all ${!bodyPart && !equipmentFilter ? "gradient-bg text-primary-foreground" : "bg-secondary/60 text-muted-foreground hover:text-foreground border border-white/[0.05]"}`}
          >
            All
          </button>
          {BODY_PARTS.map((bp) => (
            <button
              key={bp}
              onClick={() => { setBodyPart(bp); setEquipmentFilter(""); setQuery(""); setSearch(""); }}
              className={`px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all capitalize ${bodyPart === bp ? "gradient-bg text-primary-foreground" : "bg-secondary/60 text-muted-foreground hover:text-foreground border border-white/[0.05]"}`}
            >
              {bp}
            </button>
          ))}
        </div>

        {/* Results count */}
        {!isLoading && data && (
          <p className="text-xs text-muted-foreground">{data.length} exercises found</p>
        )}

        {/* Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {isLoading
            ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
            : (data || []).map((ex: any) => (
              <ExerciseCard
                key={ex.id}
                exercise={ex}
                onQuickAdd={quickAddToSession}
                onDetail={setDetailExercise}
              />
            ))
          }
        </div>

        {!isLoading && data?.length === 0 && (
          <div className="text-center py-12">
            <Dumbbell size={40} className="mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">No exercises found. Try a different search term.</p>
          </div>
        )}

        {/* Detail Modal */}
        <AnimatePresence>
          {detailExercise && (
            <ExerciseDetailModal
              exercise={detailExercise}
              onClose={() => setDetailExercise(null)}
              onQuickAdd={quickAddToSession}
            />
          )}
        </AnimatePresence>
      </div>
    </AppLayout>
  );
}
