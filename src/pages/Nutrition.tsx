import { useState, useEffect, useRef } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { searchRecipes, getRecipeById, searchIngredients } from "@/lib/api";
import {
  Search, Plus, X, Clock, ChevronDown, ChevronUp, Flame,
  Filter, Bookmark, BookmarkCheck, UtensilsCrossed, Loader2,
  Apple, Beef, Wheat, Droplets, CalendarDays, Target, Info,
  ChefHat, Leaf, Zap, BarChart3, TrendingUp, ArrowRight,
  CheckCircle2, Circle, Star,
} from "lucide-react";
import { toast } from "sonner";

/* ────────────────── CONSTANTS ────────────────── */
const TABS = ["Diary", "Recipes", "Meal Plan"] as const;
type Tab = typeof TABS[number];

const MEALS = [
  { id: "breakfast",   label: "Breakfast",     icon: "☀️",  target: 600 },
  { id: "lunch",       label: "Lunch",          icon: "🥗",  target: 700 },
  { id: "dinner",      label: "Dinner",         icon: "🍽️",  target: 700 },
  { id: "snacks",      label: "Snacks",         icon: "🍎",  target: 300 },
  { id: "pre",         label: "Pre-Workout",    icon: "⚡",  target: 200 },
  { id: "post",        label: "Post-Workout",   icon: "💪",  target: 200 },
];

const DIETS = [
  { value: "",           label: "All" },
  { value: "vegetarian", label: "Vegetarian" },
  { value: "vegan",      label: "Vegan" },
  { value: "ketogenic",  label: "Keto" },
  { value: "paleo",      label: "Paleo" },
  { value: "gluten free",label: "Gluten-Free" },
  { value: "whole30",    label: "Whole30" },
];

const MEAL_TYPES = [
  { value: "",           label: "Any meal" },
  { value: "breakfast",  label: "Breakfast" },
  { value: "lunch",      label: "Lunch" },
  { value: "dinner",     label: "Dinner" },
  { value: "snack",      label: "Snack" },
  { value: "dessert",    label: "Dessert" },
];

const CUISINES = ["", "Italian", "Asian", "Mexican", "American", "Mediterranean", "Indian", "Japanese", "Thai", "Greek"];

const MACRO_GOALS = { calories: 2200, protein: 150, carbs: 250, fat: 70, fiber: 30 };

const fadeUp = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } };
const stagger = { visible: { transition: { staggerChildren: 0.06 } } };

/* ────────────────── HELPERS ────────────────── */
function getNutrient(nutrients: any[], name: string) {
  return Math.round(nutrients?.find((n: any) => n.name === name)?.amount || 0);
}

function MacroChip({ icon: Icon, label, value, unit, color }: {
  icon: any; label: string; value: number; unit: string; color: string;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-secondary/60 border border-border/50">
      <Icon size={13} style={{ color }} />
      <span className="text-xs font-bold" style={{ color }}>{value}{unit}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

function MacroBar({ label, value, max, color, icon: Icon }: {
  label: string; value: number; max: number; color: string; icon?: any;
}) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground font-medium">
          {Icon && <Icon size={11} style={{ color }} />}
          {label}
        </div>
        <span className="font-bold tabular-nums">
          <span style={{ color }}>{value}</span>
          <span className="text-muted-foreground font-normal"> / {max}g</span>
        </span>
      </div>
      <div className="h-2 bg-secondary rounded-full overflow-hidden">
        <motion.div className="h-full rounded-full" style={{ backgroundColor: color }}
          initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.9, ease: "easeOut" }} />
      </div>
    </div>
  );
}

function CalorieRing({ consumed, goal }: { consumed: number; goal: number }) {
  const pct = Math.min(consumed / goal, 1);
  const r = 52; const circ = 2 * Math.PI * r;
  const offset = circ - pct * circ;
  return (
    <div className="relative w-36 h-36 flex items-center justify-center flex-shrink-0">
      <svg width="144" height="144" viewBox="0 0 144 144" className="-rotate-90 absolute inset-0">
        <circle cx="72" cy="72" r={r} fill="none" stroke="hsl(var(--secondary))" strokeWidth="10" />
        <circle cx="72" cy="72" r={r} fill="none" stroke="url(#cGrad)" strokeWidth="10"
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.9s ease" }} />
        <defs>
          <linearGradient id="cGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#2563eb" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>
        </defs>
      </svg>
      <div className="text-center z-10">
        <p className="text-2xl font-black leading-none gradient-text">{consumed}</p>
        <p className="text-[10px] text-muted-foreground font-medium mt-0.5">of {goal} cal</p>
        <p className="text-[10px] text-cyan-500 font-bold mt-0.5">{goal - consumed > 0 ? `${goal - consumed} left` : "Goal hit!"}</p>
      </div>
    </div>
  );
}

/* ────────────────── RECIPE CARD ────────────────── */
function RecipeCard({ recipe, onSelect, onSave, saved }: {
  recipe: any; onSelect: (r: any) => void; onSave: (r: any) => void; saved: boolean;
}) {
  const nutrients = recipe.nutrition?.nutrients || [];
  const cals = getNutrient(nutrients, "Calories");
  const protein = getNutrient(nutrients, "Protein");
  const carbs = getNutrient(nutrients, "Carbohydrates");
  const fat = getNutrient(nutrients, "Fat");

  return (
    <motion.div variants={fadeUp}
      className="glass-card overflow-hidden group cursor-pointer hover:border-primary/30 transition-all duration-300 flex flex-col"
      onClick={() => onSelect(recipe)}>
      <div className="relative aspect-[4/3] bg-secondary overflow-hidden flex-shrink-0">
        {recipe.image
          ? <img src={recipe.image} alt={recipe.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
          : <div className="w-full h-full flex items-center justify-center"><ChefHat size={32} className="text-muted-foreground/30" /></div>
        }
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        <button onClick={e => { e.stopPropagation(); onSave(recipe); }}
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center hover:scale-110 transition-transform">
          {saved
            ? <BookmarkCheck size={15} className="text-primary fill-primary" />
            : <Bookmark size={15} className="text-white" />}
        </button>
        {recipe.readyInMinutes && (
          <div className="absolute bottom-3 left-3 flex items-center gap-1 px-2 py-1 rounded-full bg-black/50 backdrop-blur-sm text-white text-xs font-medium">
            <Clock size={11} /> {recipe.readyInMinutes}m
          </div>
        )}
        {cals > 0 && (
          <div className="absolute bottom-3 right-3 flex items-center gap-1 px-2 py-1 rounded-full bg-black/50 backdrop-blur-sm text-white text-xs font-bold">
            <Flame size={11} className="text-amber-400" /> {cals}
          </div>
        )}
      </div>
      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-bold text-sm leading-snug line-clamp-2 mb-3 flex-1">{recipe.title}</h3>
        {cals > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <MacroChip icon={Beef} label="P" value={protein} unit="g" color="#2563eb" />
            <MacroChip icon={Wheat} label="C" value={carbs} unit="g" color="#f59e0b" />
            <MacroChip icon={Droplets} label="F" value={fat} unit="g" color="#8b5cf6" />
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ────────────────── RECIPE DETAIL MODAL ────────────────── */
function RecipeDetailModal({ recipe: initialRecipe, onClose, onLogMeal }: {
  recipe: any; onClose: () => void; onLogMeal: (r: any) => void;
}) {
  const { data: full, isLoading } = useQuery({
    queryKey: ["recipe", initialRecipe.id],
    queryFn: () => getRecipeById(initialRecipe.id),
    staleTime: 300000,
  });

  const recipe = full || initialRecipe;
  const nutrients = recipe.nutrition?.nutrients || [];
  const cals = getNutrient(nutrients, "Calories");
  const protein = getNutrient(nutrients, "Protein");
  const carbs = getNutrient(nutrients, "Carbohydrates");
  const fat = getNutrient(nutrients, "Fat");
  const fiber = getNutrient(nutrients, "Fiber");

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-xl"
      onClick={onClose}>
      <motion.div initial={{ y: "100%", opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="relative w-full sm:max-w-2xl max-h-[92vh] sm:max-h-[88vh] bg-card rounded-t-3xl sm:rounded-3xl border border-border overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}>

        {/* Header image */}
        <div className="relative h-48 sm:h-56 flex-shrink-0 bg-secondary">
          {recipe.image
            ? <img src={recipe.image} alt={recipe.title} className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center"><ChefHat size={40} className="text-muted-foreground/30" /></div>}
          <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
          <button onClick={onClose}
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60 transition-colors">
            <X size={18} />
          </button>
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
              <Loader2 size={24} className="animate-spin text-white" />
            </div>
          )}
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-5 space-y-5">
            <div>
              <h2 className="text-xl font-black leading-snug mb-2">{recipe.title}</h2>
              <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
                {recipe.readyInMinutes && (
                  <span className="flex items-center gap-1"><Clock size={12} /> {recipe.readyInMinutes} min</span>
                )}
                {recipe.servings && (
                  <span className="flex items-center gap-1"><UtensilsCrossed size={12} /> {recipe.servings} servings</span>
                )}
                {recipe.diets?.slice(0, 3).map((d: string) => (
                  <span key={d} className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold capitalize">{d}</span>
                ))}
              </div>
            </div>

            {/* Macro grid */}
            {cals > 0 && (
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: "Calories", value: cals, unit: "", color: "#2563eb" },
                  { label: "Protein", value: protein, unit: "g", color: "#2563eb" },
                  { label: "Carbs", value: carbs, unit: "g", color: "#f59e0b" },
                  { label: "Fat", value: fat, unit: "g", color: "#8b5cf6" },
                ].map(m => (
                  <div key={m.label} className="text-center py-3 rounded-xl bg-secondary/50 border border-border/50">
                    <p className="text-lg font-black" style={{ color: m.color }}>{m.value}{m.unit}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{m.label}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Ingredients */}
            {recipe.extendedIngredients?.length > 0 && (
              <div>
                <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
                  <Leaf size={15} className="text-green-400" /> Ingredients
                  <span className="text-xs font-normal text-muted-foreground">({recipe.extendedIngredients.length} items)</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {recipe.extendedIngredients.map((ing: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/40 text-xs">
                      <CheckCircle2 size={12} className="text-primary/60 flex-shrink-0" />
                      <span className="text-muted-foreground">{ing.original}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Instructions */}
            {recipe.analyzedInstructions?.[0]?.steps?.length > 0 && (
              <div>
                <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
                  <ChefHat size={15} className="text-amber-400" /> Instructions
                </h3>
                <div className="space-y-3">
                  {recipe.analyzedInstructions[0].steps.map((step: any) => (
                    <div key={step.number} className="flex gap-3">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0 mt-0.5">
                        {step.number}
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">{step.step}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="h-4" />
          </div>
        </div>

        {/* Footer action */}
        <div className="p-4 border-t border-border flex gap-3 flex-shrink-0 bg-card/80 backdrop-blur-sm">
          <button onClick={onClose}
            className="flex-1 py-3 rounded-2xl bg-secondary text-foreground text-sm font-semibold hover:bg-secondary/80 transition-colors">
            Close
          </button>
          <button onClick={() => { onLogMeal(recipe); onClose(); }}
            className="flex-1 py-3 rounded-2xl gradient-bg text-primary-foreground text-sm font-bold shadow-lg shadow-primary/20 hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
            <Plus size={16} /> Log This Meal
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ────────────────── FOOD SEARCH PANEL ────────────────── */
function FoodSearchPanel({ meal, onClose, onAdd }: {
  meal: string; onClose: () => void; onAdd: (item: any) => void;
}) {
  const [query, setQuery] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(query), 400);
    return () => clearTimeout(t);
  }, [query]);

  const { data, isLoading } = useQuery({
    queryKey: ["ingredients", debouncedQ],
    queryFn: () => searchIngredients(debouncedQ),
    enabled: debouncedQ.length > 1,
    staleTime: 30000,
  });

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}
      className="absolute inset-x-0 top-full mt-2 z-20 bg-card border border-border rounded-2xl shadow-2xl shadow-black/40 overflow-hidden">
      <div className="p-3 border-b border-border">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input ref={inputRef} type="text" placeholder={`Search food for ${meal}...`} value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-secondary text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/50" />
        </div>
      </div>
      <div className="max-h-56 overflow-y-auto">
        {isLoading && <div className="flex items-center justify-center py-6"><Loader2 size={18} className="animate-spin text-primary" /></div>}
        {!debouncedQ && !isLoading && (
          <div className="py-8 text-center text-muted-foreground text-xs">Start typing to search food...</div>
        )}
        {data?.results?.map((item: any) => (
          <button key={item.id} onClick={() => { onAdd({ ...item, meal }); onClose(); }}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/60 transition-colors text-left">
            <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
              {item.image
                ? <img src={`https://spoonacular.com/cdn/ingredients_100x100/${item.image}`} alt={item.name} className="w-full h-full object-cover rounded-lg" />
                : <Apple size={14} className="text-muted-foreground" />}
            </div>
            <span className="text-sm font-medium capitalize">{item.name}</span>
            <Plus size={13} className="text-primary ml-auto flex-shrink-0" />
          </button>
        ))}
        {debouncedQ && !isLoading && !data?.results?.length && (
          <div className="py-8 text-center text-muted-foreground text-xs">No results found</div>
        )}
      </div>
    </motion.div>
  );
}

/* ────────────────── MEAL SECTION ────────────────── */
function MealSection({ meal, loggedItems, onAdd }: {
  meal: typeof MEALS[number];
  loggedItems: any[];
  onAdd: (mealId: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const totalCals = loggedItems.reduce((s, i) => s + (i.calories || 0), 0);
  const pct = Math.min((totalCals / meal.target) * 100, 100);

  return (
    <div className="glass-card overflow-hidden">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-secondary/30 transition-colors">
        <span className="text-lg">{meal.icon}</span>
        <div className="flex-1 text-left">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm">{meal.label}</span>
            {totalCals > 0 && (
              <span className="text-xs font-bold text-primary">{totalCals} cal</span>
            )}
          </div>
          {totalCals > 0 && (
            <div className="mt-1 h-1 bg-secondary rounded-full overflow-hidden w-24">
              <div className="h-full bg-gradient-to-r from-blue-600 to-cyan-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {totalCals === 0 && <span className="text-xs text-muted-foreground">target {meal.target} cal</span>}
          {open ? <ChevronUp size={15} className="text-muted-foreground" /> : <ChevronDown size={15} className="text-muted-foreground" />}
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
            className="overflow-hidden">
            <div className="px-4 pb-4 space-y-1.5">
              {loggedItems.length === 0 ? (
                <p className="text-xs text-muted-foreground py-3 text-center">Nothing logged yet</p>
              ) : (
                loggedItems.map((item, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2 rounded-xl bg-secondary/40 text-xs">
                    <span className="font-medium capitalize">{item.name}</span>
                    <div className="flex items-center gap-3 text-muted-foreground">
                      {item.amount && <span>{item.amount}{item.unit}</span>}
                      {item.calories && <span className="font-bold text-foreground">{item.calories} cal</span>}
                    </div>
                  </div>
                ))
              )}
              <button onClick={() => onAdd(meal.id)}
                className="flex items-center gap-2 text-xs font-semibold text-primary hover:text-primary/80 transition-colors mt-2 py-1">
                <Plus size={14} /> Add food to {meal.label}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ────────────────── RECIPE SEARCH TAB ────────────────── */
function RecipesTab() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("high protein meal");
  const [diet, setDiet] = useState("");
  const [mealType, setMealType] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());
  const [selected, setSelected] = useState<any | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["recipes", query, diet, mealType],
    queryFn: () => searchRecipes(query, {
      diet: diet || undefined,
      type: mealType || undefined,
    }),
    staleTime: 60000,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) setQuery(search.trim());
  };

  const toggleSave = (recipe: any) => {
    setSavedIds(prev => {
      const next = new Set(prev);
      if (next.has(recipe.id)) { next.delete(recipe.id); toast.success("Removed from saved"); }
      else { next.add(recipe.id); toast.success("Recipe saved!"); }
      return next;
    });
  };

  const handleLogMeal = (recipe: any) => {
    toast.success(`"${recipe.title}" logged to Lunch`);
  };

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <form onSubmit={handleSearch} className="relative">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input placeholder="Search recipes, ingredients, cuisine..."
          value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pl-11 pr-24 py-3.5 rounded-2xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm transition-all" />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          <button type="button" onClick={() => setShowFilters(!showFilters)}
            className={`p-2 rounded-xl transition-all ${showFilters ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"}`}>
            <Filter size={15} />
          </button>
          <button type="submit"
            className="px-4 py-2 rounded-xl gradient-bg text-primary-foreground text-xs font-bold shadow-md shadow-primary/20">
            Search
          </button>
        </div>
      </form>

      {/* Filters */}
      <AnimatePresence>
        {showFilters && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden">
            <div className="p-4 rounded-2xl bg-secondary/50 border border-border space-y-3">
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Diet</p>
                <div className="flex gap-1.5 flex-wrap">
                  {DIETS.map(d => (
                    <button key={d.value} onClick={() => setDiet(d.value)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${diet === d.value ? "gradient-bg text-primary-foreground shadow-md shadow-primary/20" : "bg-secondary text-muted-foreground hover:text-foreground border border-border"}`}>
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Meal Type</p>
                <div className="flex gap-1.5 flex-wrap">
                  {MEAL_TYPES.map(t => (
                    <button key={t.value} onClick={() => setMealType(t.value)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${mealType === t.value ? "gradient-bg text-primary-foreground shadow-md shadow-primary/20" : "bg-secondary text-muted-foreground hover:text-foreground border border-border"}`}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Diet quick-pills (always visible) */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {DIETS.map(d => (
          <button key={d.value} onClick={() => setDiet(d.value)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${diet === d.value ? "gradient-bg text-primary-foreground shadow-md shadow-primary/20" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
            {d.label}
          </button>
        ))}
      </div>

      {/* Results grid */}
      {isLoading ? (
        <motion.div variants={stagger} initial="hidden" animate="visible"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <motion.div key={i} variants={fadeUp} className="glass-card overflow-hidden">
              <div className="aspect-[4/3] bg-secondary animate-pulse" />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-secondary rounded animate-pulse w-3/4" />
                <div className="h-3 bg-secondary rounded animate-pulse w-1/2" />
              </div>
            </motion.div>
          ))}
        </motion.div>
      ) : (
        <>
          {data?.results?.length > 0 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{data.results.length} recipes found</p>
            </div>
          )}
          <motion.div variants={stagger} initial="hidden" animate="visible"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(data?.results || []).map((r: any) => (
              <RecipeCard key={r.id} recipe={r}
                onSelect={setSelected}
                onSave={toggleSave}
                saved={savedIds.has(r.id)} />
            ))}
          </motion.div>
          {data?.results?.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <ChefHat size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">No recipes found</p>
              <p className="text-xs mt-1">Try different keywords or filters</p>
            </div>
          )}
        </>
      )}

      {/* Recipe detail modal */}
      <AnimatePresence>
        {selected && (
          <RecipeDetailModal recipe={selected} onClose={() => setSelected(null)} onLogMeal={handleLogMeal} />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ────────────────── DIARY TAB ────────────────── */
function DiaryTab() {
  const goals = MACRO_GOALS;
  const [loggedItems, setLoggedItems] = useState<Record<string, any[]>>({});
  const [activeFoodSearch, setActiveFoodSearch] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const consumed = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  Object.values(loggedItems).flat().forEach(i => {
    consumed.calories += i.calories || 0;
    consumed.protein += i.protein || 0;
    consumed.carbs += i.carbs || 0;
    consumed.fat += i.fat || 0;
  });

  const handleAdd = (item: any) => {
    setLoggedItems(prev => ({
      ...prev,
      [item.meal]: [...(prev[item.meal] || []), { name: item.name, calories: 0, meal: item.meal }],
    }));
    toast.success(`${item.name} added to ${item.meal}`);
  };

  // Close search on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setActiveFoodSearch(null);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">

      {/* Left: Meal sections */}
      <div className="space-y-4">
        {/* Date + water header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <CalendarDays size={15} className="text-primary" />
            {today}
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-bold">
            <Droplets size={13} /> 0 / 8 glasses
          </div>
        </div>

        {/* Meal sections */}
        <div ref={ref} className="space-y-3">
          {MEALS.map(meal => (
            <div key={meal.id} className="relative">
              <MealSection meal={meal} loggedItems={loggedItems[meal.id] || []}
                onAdd={id => setActiveFoodSearch(activeFoodSearch === id ? null : id)} />
              <AnimatePresence>
                {activeFoodSearch === meal.id && (
                  <FoodSearchPanel meal={meal.label}
                    onClose={() => setActiveFoodSearch(null)}
                    onAdd={handleAdd} />
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>

      {/* Right: Macro summary (sticky on desktop) */}
      <div className="space-y-4 lg:sticky lg:top-20">
        {/* Calorie ring card */}
        <div className="glass-card p-5">
          <div className="flex items-center gap-4">
            <CalorieRing consumed={consumed.calories} goal={goals.calories} />
            <div className="flex-1 space-y-2.5">
              <MacroBar label="Protein" value={consumed.protein} max={goals.protein} color="#2563eb" icon={Beef} />
              <MacroBar label="Carbs" value={consumed.carbs} max={goals.carbs} color="#f59e0b" icon={Wheat} />
              <MacroBar label="Fat" value={consumed.fat} max={goals.fat} color="#8b5cf6" icon={Droplets} />
              <MacroBar label="Fiber" value={consumed.fiber} max={goals.fiber} color="#10b981" />
            </div>
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Calories Left", value: Math.max(goals.calories - consumed.calories, 0), unit: "kcal", icon: Flame, color: "#2563eb" },
            { label: "Protein Goal", value: `${Math.round((consumed.protein / goals.protein) * 100)}`, unit: "%", icon: TrendingUp, color: "#10b981" },
          ].map(s => (
            <div key={s.label} className="glass-card p-4">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-2" style={{ background: `${s.color}20` }}>
                <s.icon size={15} style={{ color: s.color }} />
              </div>
              <p className="text-xl font-black">{s.value}<span className="text-xs font-normal text-muted-foreground ml-1">{s.unit}</span></p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Nutrition insights */}
        <div className="glass-card p-4 space-y-3">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Today's Insight</p>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
              <Zap size={15} className="text-amber-500" />
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {consumed.calories === 0
                ? "Start logging food to see personalised insights about your nutrition."
                : consumed.protein < goals.protein * 0.5
                ? "You're under your protein target. Add a lean meat or protein shake to boost it."
                : "Great start! Keep tracking to hit your daily targets."}
            </p>
          </div>
        </div>

        {/* Link to full nutrition goals */}
        <button className="w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-secondary/50 border border-border hover:border-primary/30 transition-all text-sm font-semibold group">
          <div className="flex items-center gap-2">
            <Target size={15} className="text-primary" />
            Adjust Nutrition Goals
          </div>
          <ArrowRight size={14} className="text-muted-foreground group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </div>
  );
}

/* ────────────────── MEAL PLAN TAB ────────────────── */
function MealPlanTab() {
  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const [activeDay, setActiveDay] = useState(0);

  return (
    <div className="space-y-5">
      {/* Day selector */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {DAYS.map((d, i) => (
          <button key={d} onClick={() => setActiveDay(i)}
            className={`flex-shrink-0 flex flex-col items-center gap-1 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all ${activeDay === i ? "gradient-bg text-primary-foreground shadow-lg shadow-primary/20" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
            <span>{d}</span>
          </button>
        ))}
      </div>

      {/* Empty state */}
      <div className="glass-card p-10 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
          <ChefHat size={28} className="text-primary/60" />
        </div>
        <h3 className="font-bold text-base mb-2">No meal plan for {DAYS[activeDay]}</h3>
        <p className="text-sm text-muted-foreground mb-5 max-w-xs">
          Generate a personalised weekly meal plan based on your calorie goals and diet preferences.
        </p>
        <button onClick={() => toast.info("Meal plan generation coming soon!")}
          className="flex items-center gap-2 px-6 py-3 rounded-2xl gradient-bg text-primary-foreground text-sm font-bold shadow-lg shadow-primary/20">
          <Zap size={16} /> Generate Meal Plan
        </button>
        <p className="text-xs text-muted-foreground mt-3">Powered by Spoonacular AI</p>
      </div>
    </div>
  );
}

/* ────────────────── MAIN PAGE ────────────────── */
export default function Nutrition() {
  const [activeTab, setActiveTab] = useState<Tab>("Diary");

  const TAB_ICONS: Record<Tab, any> = {
    "Diary": UtensilsCrossed,
    "Recipes": ChefHat,
    "Meal Plan": CalendarDays,
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 pb-24 space-y-6">

        {/* ── PAGE HEADER ── */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="relative rounded-3xl overflow-hidden p-6 md:p-8"
          style={{ background: "linear-gradient(135deg, rgba(37,99,235,0.18) 0%, rgba(6,182,212,0.10) 100%)" }}>
          <div className="absolute inset-0 border border-primary/20 rounded-3xl pointer-events-none" />
          <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full opacity-10 blur-3xl bg-cyan-500" />
          <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full opacity-10 blur-3xl bg-primary" />
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-xs text-primary/80 font-bold uppercase tracking-widest mb-1">Fuel Your Performance</p>
              <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-1">Nutrition</h1>
              <p className="text-muted-foreground text-sm">Track meals, discover recipes and nail your macros daily.</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-2xl font-black gradient-text">2,200</p>
                <p className="text-xs text-muted-foreground">daily calorie goal</p>
              </div>
              <div className="w-px h-10 bg-border" />
              <div className="text-right">
                <p className="text-2xl font-black text-cyan-400">150g</p>
                <p className="text-xs text-muted-foreground">protein goal</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── TABS ── */}
        <div className="flex items-center gap-1 p-1 bg-secondary rounded-2xl w-full sm:w-auto sm:inline-flex">
          {TABS.map(tab => {
            const Icon = TAB_ICONS[tab];
            return (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  activeTab === tab
                    ? "gradient-bg text-primary-foreground shadow-lg shadow-primary/20"
                    : "text-muted-foreground hover:text-foreground"
                }`}>
                <Icon size={15} />
                <span className="hidden sm:inline">{tab}</span>
                <span className="sm:hidden">{tab.split(" ")[0]}</span>
              </button>
            );
          })}
        </div>

        {/* ── TAB CONTENT ── */}
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
            {activeTab === "Diary"     && <DiaryTab />}
            {activeTab === "Recipes"   && <RecipesTab />}
            {activeTab === "Meal Plan" && <MealPlanTab />}
          </motion.div>
        </AnimatePresence>

      </div>
    </AppLayout>
  );
}
