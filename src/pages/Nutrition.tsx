import { useState, useEffect, useRef, useMemo } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  searchRecipes, getRecipeById,
  generateMealPlan, canGenerateMealPlan,
  getDailyUsage,
  getRecentFoods, pushRecentFood,
  type RecentFood,
} from "@/lib/spoonacular";
import {
  searchFoods, autocompleteFoods, getFood, lookupBarcode as fsLookupBarcode,
  scaleServing, type FsFood, type FsServing, type FsSearchHit,
} from "@/lib/fatsecret";
import { addGrocery } from "@/lib/grocery";
import {
  Search, Plus, X, Clock, ChevronDown, ChevronUp, Flame,
  Filter, Bookmark, BookmarkCheck, UtensilsCrossed, Loader2,
  Apple, Beef, Wheat, Droplets, CalendarDays, Target, Info,
  ChefHat, Leaf, Zap, BarChart3, TrendingUp, ArrowRight,
  CheckCircle2, ScanBarcode, History, Copy, Sparkles, RefreshCw,
  Lock, AlertCircle, Camera, ShoppingCart, Tag,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import {
  doc, setDoc, getDoc, collection, getDocs, addDoc, deleteDoc, Timestamp,
} from "firebase/firestore";
import { format, subDays, addDays, startOfWeek } from "date-fns";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { computeTargets, distributeMealTargets } from "@/lib/nutrition";
import { Link } from "react-router-dom";

/* ────────────────── CONSTANTS ────────────────── */
const TABS = ["Diary", "Recipes", "Meal Plan", "Barcode Scan"] as const;
type Tab = typeof TABS[number];

// Meal target is computed dynamically from the user's calorie goal.
const MEALS = [
  { id: "breakfast", label: "Breakfast", icon: "☀️", color: "#f59e0b" },
  { id: "lunch",     label: "Lunch",     icon: "🥗", color: "#10b981" },
  { id: "dinner",    label: "Dinner",    icon: "🍽️", color: "#8b5cf6" },
  { id: "snacks",    label: "Snacks",    icon: "🍎", color: "#06b6d4" },
];

const DIETS = [
  { value: "",            label: "All" },
  { value: "vegetarian",  label: "Vegetarian" },
  { value: "vegan",       label: "Vegan" },
  { value: "ketogenic",   label: "Keto" },
  { value: "paleo",       label: "Paleo" },
  { value: "gluten free", label: "Gluten-Free" },
  { value: "whole30",     label: "Whole30" },
  { value: "pescetarian", label: "Pescetarian" },
  { value: "primal",      label: "Primal" },
  { value: "low fodmap",  label: "Low FODMAP" },
];

const CUISINES = [
  "", "italian", "mexican", "chinese", "indian", "japanese", "thai", "mediterranean",
  "american", "french", "greek", "korean", "middle eastern", "spanish", "vietnamese", "caribbean",
];

const MEAL_TYPES = [
  { value: "",          label: "Any meal" },
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch",     label: "Lunch" },
  { value: "main course", label: "Main" },
  { value: "side dish", label: "Side" },
  { value: "snack",     label: "Snack" },
  { value: "dessert",   label: "Dessert" },
  { value: "appetizer", label: "Appetizer" },
  { value: "salad",     label: "Salad" },
  { value: "soup",      label: "Soup" },
];

const DEFAULT_MACRO_GOALS = { calories: 2200, protein: 150, carbs: 250, fat: 70, fiber: 30 };
// Mutable per-user goals — overwritten by Nutrition() from the user's profile on mount.
let MACRO_GOALS = { ...DEFAULT_MACRO_GOALS };
const WATER_GOAL  = 8;

const fadeUp  = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } };
const stagger = { visible: { transition: { staggerChildren: 0.05 } } };

/* ────────────────── SHARED TYPES ────────────────── */
interface LoggedFood {
  id: string;
  name: string;
  meal: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  amount?: number;
  unit?: string;
  image?: string;
}

interface DayLog {
  date: string;                    // yyyy-MM-dd
  foods: LoggedFood[];
  water: number;                   // glasses
}

/* ────────────────── HELPERS ────────────────── */
function getNutrient(nutrients: any[], name: string) {
  return Math.round(nutrients?.find((n: any) => n.name === name)?.amount || 0);
}

function MacroBar({ label, value, max, color, icon: Icon }: {
  label: string; value: number; max: number; color: string; icon?: any;
}) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-1.5 text-muted-foreground font-medium">
          {Icon && <Icon size={10} style={{ color }} />}
          {label}
        </div>
        <span className="font-bold tabular-nums text-[11px]">
          <span style={{ color }}>{value}</span>
          <span className="text-muted-foreground font-normal"> / {max}g</span>
        </span>
      </div>
      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
        <motion.div className="h-full rounded-full" style={{ backgroundColor: color }}
          initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.7, ease: "easeOut" }} />
      </div>
    </div>
  );
}

function CalorieRing({ consumed, goal }: { consumed: number; goal: number }) {
  const pct = Math.min(consumed / goal, 1);
  const r = 48; const circ = 2 * Math.PI * r;
  const offset = circ - pct * circ;
  return (
    <div className="relative w-32 h-32 flex items-center justify-center flex-shrink-0 mx-auto">
      <svg width="128" height="128" viewBox="0 0 128 128" className="-rotate-90 absolute inset-0">
        <circle cx="64" cy="64" r={r} fill="none" stroke="hsl(var(--secondary))" strokeWidth="8" />
        <circle cx="64" cy="64" r={r} fill="none" stroke="url(#cGrad)" strokeWidth="8"
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.9s ease" }} />
        <defs>
          <linearGradient id="cGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="#2563eb" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>
        </defs>
      </svg>
      <div className="text-center z-10">
        <p className="text-2xl font-black leading-none">{consumed}</p>
        <p className="text-[10px] text-muted-foreground font-medium mt-0.5">of {goal}</p>
        <p className="text-[10px] text-muted-foreground">cal</p>
      </div>
    </div>
  );
}

/* ────────────────── API USAGE WIDGET ────────────────── */
function ApiUsageBadge() {
  const [tick, setTick] = useState(0);
  useEffect(() => { const t = setInterval(() => setTick(x => x + 1), 30000); return () => clearInterval(t); }, []);
  const { used, limit, resetIn } = getDailyUsage();
  const pct = (used / limit) * 100;
  const danger  = pct >= 85;
  const warning = pct >= 60 && !danger;

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors ${
      danger
        ? "bg-destructive/10 border-destructive/30 text-destructive"
        : warning
        ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
        : "bg-secondary/60 border-border text-muted-foreground"
    }`}>
      <BarChart3 size={12} />
      <span>API: {used}/{limit}</span>
      <span className="text-[10px] opacity-70">resets in {resetIn}</span>
    </div>
  );
}

/* ────────────────── RECIPE CARD ────────────────── */
function RecipeCard({ recipe, onSelect, onSave, saved }: {
  recipe: any; onSelect: (r: any) => void; onSave: (r: any) => void; saved: boolean;
}) {
  const nutrients = recipe.nutrition?.nutrients || [];
  const cals    = getNutrient(nutrients, "Calories");
  const protein = getNutrient(nutrients, "Protein");

  return (
    <motion.div variants={fadeUp}
      className="glass-card overflow-hidden group cursor-pointer hover:border-primary/30 transition-all duration-300 flex flex-col"
      onClick={() => onSelect(recipe)}>
      <div className="relative aspect-[4/3] bg-secondary overflow-hidden flex-shrink-0">
        {recipe.image
          ? <img src={recipe.image} alt={recipe.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
          : <div className="w-full h-full flex items-center justify-center"><ChefHat size={32} className="text-muted-foreground/30" /></div>}
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
        <h3 className="font-bold text-sm leading-snug line-clamp-2 mb-2 flex-1">{recipe.title}</h3>
        {protein > 0 && (
          <p className="text-xs text-muted-foreground">
            <span className="font-bold text-primary">{protein}g</span> protein
          </p>
        )}
      </div>
    </motion.div>
  );
}

/* ────────────────── RECIPE DETAIL MODAL ────────────────── */
function RecipeDetailModal({ recipe: initialRecipe, onClose, onLogMeal }: {
  recipe: any; onClose: () => void; onLogMeal: (r: any, meal: string) => void;
}) {
  const [chosenMeal, setChosenMeal] = useState("lunch");
  const { data: full, isLoading } = useQuery({
    queryKey: ["recipe", initialRecipe.id],
    queryFn: () => getRecipeById(initialRecipe.id),
    staleTime: 24 * 60 * 60 * 1000,
  });

  const recipe = full || initialRecipe;
  const nutrients = recipe.nutrition?.nutrients || [];
  const cals    = getNutrient(nutrients, "Calories");
  const protein = getNutrient(nutrients, "Protein");
  const carbs   = getNutrient(nutrients, "Carbohydrates");
  const fat     = getNutrient(nutrients, "Fat");

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-xl"
      onClick={onClose}>
      <motion.div initial={{ y: "100%", opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="relative w-full sm:max-w-2xl max-h-[92vh] sm:max-h-[88vh] bg-card rounded-t-3xl sm:rounded-3xl border border-border overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}>

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

            {cals > 0 && (
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: "Calories", value: cals,    unit: "",  color: "#2563eb" },
                  { label: "Protein",  value: protein, unit: "g", color: "#06b6d4" },
                  { label: "Carbs",    value: carbs,   unit: "g", color: "#f59e0b" },
                  { label: "Fat",      value: fat,     unit: "g", color: "#8b5cf6" },
                ].map(m => (
                  <div key={m.label} className="text-center py-3 rounded-xl bg-secondary/50 border border-border/50">
                    <p className="text-lg font-black" style={{ color: m.color }}>{m.value}{m.unit}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{m.label}</p>
                  </div>
                ))}
              </div>
            )}

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

        <div className="p-4 border-t border-border flex flex-col sm:flex-row gap-3 flex-shrink-0 bg-card/80 backdrop-blur-sm">
          <select value={chosenMeal} onChange={e => setChosenMeal(e.target.value)}
            className="px-4 py-3 rounded-2xl bg-secondary text-sm font-semibold border border-border focus:outline-none focus:ring-2 focus:ring-primary/50">
            {MEALS.map(m => <option key={m.id} value={m.id}>{m.icon} {m.label}</option>)}
          </select>
          <button onClick={onClose}
            className="flex-1 py-3 rounded-2xl bg-secondary text-foreground text-sm font-semibold hover:bg-secondary/80 transition-colors">
            Close
          </button>
          <button onClick={() => { onLogMeal(recipe, chosenMeal); onClose(); }}
            className="flex-1 py-3 rounded-2xl gradient-bg text-primary-foreground text-sm font-bold shadow-lg shadow-primary/20 hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
            <Plus size={16} /> Log This Meal
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ────────────────── PORTION EDITOR ────────────────── */
function PortionEditor({ item, mealId, uid, onCancel, onConfirm }: {
  item: any; mealId: string; uid: string | null;
  onCancel: () => void; onConfirm: (food: LoggedFood) => void;
}) {
  const [amount, setAmount] = useState<number>(100);
  const [unit, setUnit] = useState<string>("grams");
  const [units, setUnits] = useState<string[]>(["grams", "oz", "cup", "tbsp", "tsp", "serving"]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["ingr-info", item.id, amount, unit],
    queryFn: () => getIngredientInfo(item.id, amount, unit),
    enabled: !!item.id,
    staleTime: 24 * 60 * 60 * 1000,
    retry: false,
  });

  useEffect(() => {
    const possible = (data as any)?.possibleUnits as string[] | undefined;
    if (possible?.length) {
      setUnits(Array.from(new Set([...possible, "grams", "oz", "cup", "serving"])));
    }
  }, [data]);

  const nutrients = (data as any)?.nutrition?.nutrients || [];
  const cals    = getNutrient(nutrients, "Calories");
  const protein = getNutrient(nutrients, "Protein");
  const carbs   = getNutrient(nutrients, "Carbohydrates");
  const fat     = getNutrient(nutrients, "Fat");

  const confirm = () => {
    const food: LoggedFood = {
      id:       String(item.id),
      name:     item.name,
      meal:     mealId,
      image:    item.image ? `https://spoonacular.com/cdn/ingredients_100x100/${item.image}` : undefined,
      amount, unit,
      calories: cals, protein, carbs, fat,
    };
    onConfirm(food);
    pushRecentFood(uid, food);
  };

  return (
    <div className="p-4 space-y-3 border-t border-border bg-secondary/20">
      <div className="flex items-center gap-3">
        {item.image && (
          <img src={`https://spoonacular.com/cdn/ingredients_100x100/${item.image}`} alt="" className="w-10 h-10 rounded-lg object-cover" />
        )}
        <div className="min-w-0">
          <p className="text-sm font-bold capitalize truncate">{item.name}</p>
          <p className="text-[10px] text-muted-foreground">Edit portion to compute calories & macros</p>
        </div>
      </div>
      <div className="grid grid-cols-[1fr_1.3fr] gap-2">
        <input type="number" min={1} value={amount}
          onChange={e => setAmount(Math.max(1, Number(e.target.value) || 1))}
          className="px-3 py-2 rounded-lg bg-card text-sm font-bold focus:outline-none focus:ring-1 focus:ring-primary/50" />
        <select value={unit} onChange={e => setUnit(e.target.value)}
          className="px-3 py-2 rounded-lg bg-card text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary/50">
          {units.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {[
          { label: "Cal",  value: cals,    color: "#2563eb", suffix: "" },
          { label: "P",    value: protein, color: "#06b6d4", suffix: "g" },
          { label: "C",    value: carbs,   color: "#f59e0b", suffix: "g" },
          { label: "F",    value: fat,     color: "#8b5cf6", suffix: "g" },
        ].map(s => (
          <div key={s.label} className="text-center py-1.5 rounded-lg bg-card">
            <p className="text-sm font-black tabular-nums" style={{ color: s.color }}>
              {isLoading ? "…" : `${s.value}${s.suffix}`}
            </p>
            <p className="text-[9px] text-muted-foreground uppercase">{s.label}</p>
          </div>
        ))}
      </div>
      {error && (
        <p className="text-[10px] text-destructive">Couldn't load nutrition for that unit — try grams.</p>
      )}
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 py-2 rounded-lg bg-secondary text-xs font-semibold">Back</button>
        <button onClick={confirm} disabled={isLoading || cals === 0}
          className="flex-1 py-2 rounded-lg gradient-bg text-primary-foreground text-xs font-bold disabled:opacity-50 flex items-center justify-center gap-1.5">
          <Plus size={12} /> Log {cals || 0} cal
        </button>
      </div>
    </div>
  );
}

/* ────────────────── FOOD SEARCH PANEL ────────────────── */
function FoodSearchPanel({ meal, mealId, uid, onClose, onAdd }: {
  meal: string; mealId: string; uid: string | null; onClose: () => void; onAdd: (item: LoggedFood) => void;
}) {
  const [query, setQuery] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [pending, setPending] = useState<any | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recent = useMemo(() => getRecentFoods(uid, 8), [uid]);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(query.trim().length >= 3 ? query.trim() : ""), 350);
    return () => clearTimeout(t);
  }, [query]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["ingredients", debouncedQ],
    queryFn:  () => searchIngredients(debouncedQ),
    enabled:  debouncedQ.length >= 3,
    staleTime: 24 * 60 * 60 * 1000,
    retry: false,
  });

  const limitReached = (error as any)?.message === "DAILY_LIMIT_REACHED";

  const addRecent = (r: RecentFood) => {
    onAdd({
      id: String(r.id), name: r.name, meal: mealId, image: r.image,
      calories: r.calories || 0, protein: r.protein || 0,
      carbs: r.carbs || 0, fat: r.fat || 0,
      amount: r.amount, unit: r.unit,
    });
    pushRecentFood(uid, r);
    onClose();
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
      className="absolute inset-x-0 top-full mt-2 z-30 bg-card border border-border rounded-2xl shadow-2xl shadow-black/40 overflow-hidden"
      onMouseDown={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}>
      <div className="p-3 border-b border-border flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input ref={inputRef} type="text" placeholder={`Search food for ${meal}... (3+ chars)`} value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-secondary text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/50" />
        </div>
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-secondary text-muted-foreground"><X size={14} /></button>
      </div>

      {pending ? (
        <PortionEditor
          item={pending}
          mealId={mealId}
          uid={uid}
          onCancel={() => setPending(null)}
          onConfirm={(food) => { onAdd(food); setPending(null); onClose(); }}
        />
      ) : (
      <div className="max-h-72 overflow-y-auto">
        {!debouncedQ && recent.length > 0 && (
          <div className="p-2">
            <p className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <History size={10} /> Recent foods (no API call)
            </p>
            {recent.map(r => (
              <button key={r.id} onClick={() => addRecent(r)}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-secondary/60 transition-colors text-left rounded-xl">
                <div className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {r.image ? <img src={r.image} alt="" className="w-full h-full object-cover" /> : <Apple size={12} className="text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold capitalize truncate">{r.name}</p>
                  {r.calories ? <p className="text-[10px] text-muted-foreground">{r.calories} cal · used {r.uses}×</p> : null}
                </div>
                <Plus size={12} className="text-primary flex-shrink-0" />
              </button>
            ))}
            <div className="border-t border-border/50 my-2" />
          </div>
        )}

        {!debouncedQ && recent.length === 0 && (
          <div className="py-8 text-center text-muted-foreground text-xs">Type 3+ characters to search food...</div>
        )}

        {isLoading && (
          <div className="flex items-center justify-center py-6"><Loader2 size={18} className="animate-spin text-primary" /></div>
        )}

        {limitReached && (
          <div className="px-4 py-6 text-center">
            <Lock size={20} className="mx-auto text-destructive mb-2" />
            <p className="text-xs font-bold text-destructive">Daily API limit reached</p>
            <p className="text-[10px] text-muted-foreground mt-1">Use recent foods or come back tomorrow.</p>
          </div>
        )}

        {data?.results?.map((item: any) => (
          <button key={item.id} onClick={() => setPending(item)}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/60 transition-colors text-left">
            <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0 overflow-hidden">
              {item.image
                ? <img src={`https://spoonacular.com/cdn/ingredients_100x100/${item.image}`} alt={item.name} className="w-full h-full object-cover" />
                : <Apple size={14} className="text-muted-foreground" />}
            </div>
            <span className="text-sm font-medium capitalize flex-1">{item.name}</span>
            <ArrowRight size={12} className="text-primary flex-shrink-0" />
          </button>
        ))}

        {debouncedQ && !isLoading && !limitReached && !data?.results?.length && (
          <div className="py-8 text-center text-muted-foreground text-xs">No results found</div>
        )}
      </div>
      )}
    </motion.div>
  );
}

/* ────────────────── MEAL ROW ────────────────── */
function MealRow({ meal, items, onAdd, onRemove }: {
  meal: typeof MEALS[number];
  items: LoggedFood[];
  onAdd: (mealId: string) => void;
  onRemove: (foodId: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const totalCals = items.reduce((s, i) => s + (i.calories || 0), 0);
  const pct = Math.min((totalCals / meal.target) * 100, 100);

  return (
    <div className="glass-card overflow-hidden">
      {/* Header row */}
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/30 transition-colors">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0"
          style={{ background: `${meal.color}20` }}>
          {meal.icon}
        </div>
        <div className="flex-1 text-left min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold text-sm">{meal.label}</span>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">target {meal.target} cal</span>
              <span className="px-2 py-0.5 rounded-full font-bold tabular-nums"
                style={{ background: `${meal.color}20`, color: meal.color }}>
                {totalCals} / {meal.target}
              </span>
            </div>
          </div>
          <div className="mt-1.5 h-1 bg-secondary rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ background: meal.color, width: `${pct}%` }} />
          </div>
        </div>
        {open ? <ChevronUp size={15} className="text-muted-foreground flex-shrink-0" /> : <ChevronDown size={15} className="text-muted-foreground flex-shrink-0" />}
      </button>

      {/* Items */}
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
            className="overflow-hidden">
            <div className="px-4 pb-4 space-y-1.5">
              {items.length === 0 ? (
                <p className="text-xs text-muted-foreground py-3 text-center">Nothing logged yet</p>
              ) : (
                items.map((item) => (
                  <div key={item.id} className="group flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-secondary/40 text-xs hover:bg-secondary/60 transition-colors">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {item.image && <img src={item.image} alt="" className="w-6 h-6 rounded-md object-cover flex-shrink-0" />}
                      <span className="font-medium capitalize truncate">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground flex-shrink-0">
                      {item.protein > 0 && <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary font-bold">{Math.round(item.protein)}g P</span>}
                      {item.carbs   > 0 && <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 font-bold">{Math.round(item.carbs)}g C</span>}
                      {item.fat     > 0 && <span className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 font-bold">{Math.round(item.fat)}g F</span>}
                      <span className="font-bold text-foreground tabular-nums">{Math.round(item.calories)} cal</span>
                      <button onClick={() => onRemove(item.id)} className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 hover:text-destructive transition-all">
                        <X size={11} />
                      </button>
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

/* ────────────────── DIARY TAB ────────────────── */
function DiaryTab() {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [date, setDate] = useState(new Date());
  const dateStr = format(date, "yyyy-MM-dd");

  const [dayLog, setDayLog] = useState<DayLog>({ date: dateStr, foods: [], water: 0 });
  const [activeFoodSearch, setActiveFoodSearch] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  /* Load from Firestore for the selected date */
  useEffect(() => {
    if (!uid) { setLoading(false); return; }
    setLoading(true);
    getDoc(doc(db, "users", uid, "foodLogs", dateStr)).then(snap => {
      if (snap.exists()) {
        const d = snap.data() as DayLog;
        setDayLog({ date: dateStr, foods: d.foods || [], water: d.water || 0 });
      } else {
        setDayLog({ date: dateStr, foods: [], water: 0 });
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [uid, dateStr]);

  /* Save to Firestore (debounced via direct call after state mutations) */
  const persist = async (next: DayLog) => {
    if (!uid) return;
    try { await setDoc(doc(db, "users", uid, "foodLogs", dateStr), next); }
    catch (e) { console.error(e); }
  };

  const totals = useMemo(() => {
    const t = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
    dayLog.foods.forEach(i => {
      t.calories += i.calories || 0;
      t.protein  += i.protein  || 0;
      t.carbs    += i.carbs    || 0;
      t.fat      += i.fat      || 0;
    });
    return t;
  }, [dayLog]);

  const itemsByMeal = (mealId: string) => dayLog.foods.filter(f => f.meal === mealId);

  const addFood = (item: LoggedFood) => {
    const next: DayLog = { ...dayLog, foods: [...dayLog.foods, { ...item, id: `${item.id}_${Date.now()}` }] };
    setDayLog(next); persist(next);
    toast.success(`${item.name} added`);
  };

  const removeFood = (foodId: string) => {
    const next: DayLog = { ...dayLog, foods: dayLog.foods.filter(f => f.id !== foodId) };
    setDayLog(next); persist(next);
  };

  const setWater = (n: number) => {
    const next = { ...dayLog, water: n };
    setDayLog(next); persist(next);
  };

  const copyYesterday = async () => {
    if (!uid) return;
    const yKey = format(subDays(date, 1), "yyyy-MM-dd");
    const snap = await getDoc(doc(db, "users", uid, "foodLogs", yKey));
    if (!snap.exists()) {
      toast.error("Nothing logged yesterday");
      return;
    }
    const yLog = snap.data() as DayLog;
    if (!yLog.foods?.length) { toast.error("Nothing logged yesterday"); return; }
    const cloned = yLog.foods.map(f => ({ ...f, id: `${f.id}_${Date.now()}_${Math.random().toString(36).slice(2,5)}` }));
    const next: DayLog = { ...dayLog, foods: [...dayLog.foods, ...cloned] };
    setDayLog(next); persist(next);
    toast.success(`Copied ${cloned.length} items from yesterday — zero API calls`);
  };

  // close search panel only on explicit outside click (not on scroll/drag).
  useEffect(() => {
    const h = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!ref.current) return;
      // ignore clicks inside meals area or on scrollbars
      if (ref.current.contains(t)) return;
      // ignore clicks inside any sticky right-column controls — only close on backdrop clicks
      if (t.closest("[data-keep-search-open]")) return;
      setActiveFoodSearch(null);
    };
    document.addEventListener("click", h);
    return () => document.removeEventListener("click", h);
  }, []);

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">

      {/* Left column: diary */}
      <div className="space-y-4 min-w-0">
        {/* Day header */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <button onClick={() => setDate(subDays(date, 1))}
              className="w-8 h-8 rounded-lg bg-secondary hover:bg-secondary/70 flex items-center justify-center text-muted-foreground transition-colors">‹</button>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-secondary text-sm font-bold">
              <CalendarDays size={14} className="text-primary" />
              {format(date, "EEEE, d MMM")}
            </div>
            <button onClick={() => setDate(addDays(date, 1))}
              className="w-8 h-8 rounded-lg bg-secondary hover:bg-secondary/70 flex items-center justify-center text-muted-foreground transition-colors">›</button>
            {format(date, "yyyy-MM-dd") !== format(new Date(), "yyyy-MM-dd") && (
              <button onClick={() => setDate(new Date())}
                className="text-xs text-primary font-semibold hover:underline">today</button>
            )}
          </div>
          <button onClick={copyYesterday}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/20 hover:bg-primary/20 text-xs font-bold text-primary transition-colors">
            <Copy size={12} /> Copy yesterday
          </button>
        </div>

        {/* Meal rows */}
        <div ref={ref} className="space-y-3" data-keep-search-open>
          {MEALS.map(meal => (
            <div key={meal.id} className="relative">
              <MealRow meal={meal} items={itemsByMeal(meal.id)}
                onAdd={id => setActiveFoodSearch(activeFoodSearch === id ? null : id)}
                onRemove={removeFood} />
              <AnimatePresence>
                {activeFoodSearch === meal.id && (
                  <FoodSearchPanel meal={meal.label} mealId={meal.id} uid={uid}
                    onClose={() => setActiveFoodSearch(null)}
                    onAdd={addFood} />
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>

      {/* Right column: macros + insights */}
      <div className="space-y-4 lg:sticky lg:top-20" data-keep-search-open>
        <div className="glass-card p-5">
          <CalorieRing consumed={totals.calories} goal={MACRO_GOALS.calories} />
          <div className="space-y-2 mt-4">
            <MacroBar label="Protein" value={totals.protein} max={MACRO_GOALS.protein} color="#2563eb" icon={Beef} />
            <MacroBar label="Carbs"   value={totals.carbs}   max={MACRO_GOALS.carbs}   color="#f59e0b" icon={Wheat} />
            <MacroBar label="Fat"     value={totals.fat}     max={MACRO_GOALS.fat}     color="#8b5cf6" icon={Droplets} />
            <MacroBar label="Fiber"   value={totals.fiber}   max={MACRO_GOALS.fiber}   color="#10b981" />
          </div>
        </div>

        {/* Hydration — animated wave glasses */}
        <div className="glass-card p-4 space-y-3 overflow-hidden">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Droplets size={12} className="text-cyan-400" /> Hydration
            </p>
            <motion.span
              key={dayLog.water}
              initial={{ scale: 1.3, color: "#22d3ee" }}
              animate={{ scale: 1, color: "#22d3ee" }}
              transition={{ type: "spring", stiffness: 400, damping: 18 }}
              className="text-xs font-bold tabular-nums">
              {dayLog.water} / {WATER_GOAL} glasses
            </motion.span>
          </div>
          <div className="grid grid-cols-8 gap-1.5">
            {Array.from({ length: WATER_GOAL }).map((_, i) => {
              const filled = i < dayLog.water;
              return (
                <motion.button
                  key={i}
                  onClick={() => setWater(i + 1 === dayLog.water ? i : i + 1)}
                  whileTap={{ scale: 0.85 }}
                  whileHover={{ scale: 1.06 }}
                  className="relative h-12 rounded-xl overflow-hidden border bg-secondary/40 border-border/40 group"
                  style={filled ? { borderColor: "rgba(34,211,238,0.5)" } : undefined}>
                  {/* Wave fill */}
                  <motion.div
                    initial={false}
                    animate={{ y: filled ? "0%" : "100%" }}
                    transition={{ type: "spring", stiffness: 120, damping: 18, delay: filled ? i * 0.04 : 0 }}
                    className="absolute inset-x-0 bottom-0 h-full"
                    style={{
                      background: "linear-gradient(180deg, rgba(34,211,238,0.85) 0%, rgba(6,182,212,0.95) 100%)",
                    }}>
                    {/* Animated wave crest */}
                    <motion.div
                      animate={{ x: ["-10%", "10%", "-10%"] }}
                      transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
                      className="absolute -top-1 inset-x-0 h-2 opacity-60"
                      style={{
                        background: "radial-gradient(ellipse at 50% 100%, rgba(255,255,255,0.5) 0%, transparent 70%)",
                      }} />
                  </motion.div>
                  <Droplets
                    size={13}
                    className={`absolute inset-0 m-auto transition-colors ${filled ? "text-white drop-shadow" : "text-muted-foreground/40"}`}
                  />
                </motion.button>
              );
            })}
          </div>
          <div className="flex gap-1.5">
            <button onClick={() => setWater(Math.max(0, dayLog.water - 1))}
              className="flex-1 py-1.5 rounded-lg bg-secondary text-xs font-bold text-muted-foreground hover:text-foreground">−</button>
            <button onClick={() => setWater(Math.min(WATER_GOAL, dayLog.water + 1))}
              className="flex-1 py-1.5 rounded-lg bg-cyan-500/20 text-xs font-bold text-cyan-400 hover:bg-cyan-500/30">+ Glass</button>
          </div>
        </div>


        {/* AI insight (zero API) */}
        <div className="glass-card p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Sparkles size={13} className="text-amber-400" />
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Today's Insight</p>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {totals.calories === 0
              ? "Log your first meal to get personalised feedback on what your body needs today."
              : totals.protein < MACRO_GOALS.protein * 0.5
              ? `You're at ${totals.protein}g protein — try to add a lean meat or shake to hit ${MACRO_GOALS.protein}g.`
              : totals.calories < MACRO_GOALS.calories * 0.4 && new Date().getHours() > 14
              ? `You're under-eating today — only ${totals.calories} cal logged. Add a proper meal soon.`
              : totals.carbs > MACRO_GOALS.carbs * 1.1
              ? `Carbs are ${Math.round((totals.carbs / MACRO_GOALS.carbs) * 100)}% of goal — consider swapping a snack for protein.`
              : `Solid balance so far — ${MACRO_GOALS.calories - totals.calories} cal left to hit your target.`}
          </p>
        </div>

        <AdjustGoalsButton />
      </div>
    </div>
  );
}

/* ────────────────── ADJUST GOALS DIALOG ────────────────── */
function AdjustGoalsButton() {
  const { user, userProfile, refreshProfile } = useAuth();
  const [open, setOpen] = useState(false);
  const [vals, setVals] = useState({
    calorieTarget: MACRO_GOALS.calories,
    protein: MACRO_GOALS.protein,
    carbs: MACRO_GOALS.carbs,
    fat: MACRO_GOALS.fat,
    fiber: MACRO_GOALS.fiber,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setVals({
      calorieTarget: MACRO_GOALS.calories,
      protein: MACRO_GOALS.protein,
      carbs: MACRO_GOALS.carbs,
      fat: MACRO_GOALS.fat,
      fiber: MACRO_GOALS.fiber,
    });
  }, [open]);

  const reset = () => {
    const t = computeTargets((userProfile as any) || {});
    setVals({
      calorieTarget: t.calorieTarget, protein: t.protein,
      carbs: t.carbs, fat: t.fat, fiber: t.fiber,
    });
    toast.success("Reset to recommended targets");
  };

  const save = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await setDoc(doc(db, "users", user.uid, "profile", "data"), vals, { merge: true });
      MACRO_GOALS = { calories: vals.calorieTarget, protein: vals.protein, carbs: vals.carbs, fat: vals.fat, fiber: vals.fiber };
      await refreshProfile();
      toast.success("Goals updated");
      setOpen(false);
    } catch {
      toast.error("Failed to save");
    } finally { setSaving(false); }
  };

  const fields: { key: keyof typeof vals; label: string; unit: string }[] = [
    { key: "calorieTarget", label: "Daily Calories", unit: "cal" },
    { key: "protein", label: "Protein", unit: "g" },
    { key: "carbs",   label: "Carbs",   unit: "g" },
    { key: "fat",     label: "Fat",     unit: "g" },
    { key: "fiber",   label: "Fiber",   unit: "g" },
  ];

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-secondary/50 border border-border hover:border-primary/30 transition-all text-sm font-semibold group">
        <div className="flex items-center gap-2">
          <Target size={15} className="text-primary" />
          Adjust Nutrition Goals
        </div>
        <ArrowRight size={14} className="text-muted-foreground group-hover:translate-x-1 transition-transform" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adjust Nutrition Goals</DialogTitle>
            <DialogDescription>Override the targets calculated from onboarding.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {fields.map(f => (
              <div key={f.key} className="flex items-center gap-3">
                <label className="text-sm font-medium flex-1">{f.label}</label>
                <input type="number" min={0} value={vals[f.key]}
                  onChange={e => setVals(v => ({ ...v, [f.key]: Number(e.target.value) }))}
                  className="w-24 px-3 py-2 rounded-lg bg-secondary text-sm text-right focus:outline-none focus:ring-1 focus:ring-primary/50" />
                <span className="text-xs text-muted-foreground w-6">{f.unit}</span>
              </div>
            ))}
          </div>
          <DialogFooter className="flex-row justify-between gap-2 sm:justify-between">
            <button onClick={reset} className="px-3 py-2 rounded-lg bg-secondary text-xs font-semibold text-muted-foreground hover:text-foreground">
              Reset to recommended
            </button>
            <div className="flex gap-2">
              <button onClick={() => setOpen(false)} className="px-3 py-2 rounded-lg bg-secondary text-sm">Cancel</button>
              <button onClick={save} disabled={saving}
                className="px-4 py-2 rounded-lg gradient-bg text-primary-foreground text-sm font-bold disabled:opacity-60">
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ────────────────── RECIPES TAB ────────────────── */
function RecipesTab({ onLog }: { onLog: (recipe: any, meal: string) => void }) {
  const [search, setSearch]     = useState("");
  const [query, setQuery]       = useState("high protein meal");
  const [diet, setDiet]         = useState("");
  const [mealType, setMealType] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());
  const [selected, setSelected] = useState<any | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["recipes", query, diet, mealType],
    queryFn:  () => searchRecipes(query, { diet: diet || undefined, type: mealType || undefined }),
    staleTime: 24 * 60 * 60 * 1000,
    retry: false,
  });

  const limitReached = (error as any)?.message === "DAILY_LIMIT_REACHED";

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) setQuery(search.trim());
  };

  const toggleSave = (recipe: any) => {
    setSavedIds(prev => {
      const next = new Set(prev);
      if (next.has(recipe.id)) { next.delete(recipe.id); toast.success("Removed from saved"); }
      else { next.add(recipe.id); toast.success("Recipe saved"); }
      return next;
    });
  };

  return (
    <div className="space-y-4">
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

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {DIETS.map(d => (
          <button key={d.value} onClick={() => setDiet(d.value)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${diet === d.value ? "gradient-bg text-primary-foreground shadow-md shadow-primary/20" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
            {d.label}
          </button>
        ))}
      </div>

      {limitReached ? (
        <div className="glass-card p-12 text-center">
          <Lock size={32} className="mx-auto text-destructive mb-3" />
          <h3 className="font-bold text-base mb-2">Daily recipe limit reached</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            You've used all {getDailyUsage().limit} Spoonacular requests for today. Cached searches still work — try a previous query.
          </p>
        </div>
      ) : isLoading ? (
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
            <p className="text-xs text-muted-foreground">{data.results.length} recipes found</p>
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

      <AnimatePresence>
        {selected && (
          <RecipeDetailModal recipe={selected} onClose={() => setSelected(null)} onLogMeal={onLog} />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ────────────────── MEAL PLAN TAB ────────────────── */
const PLAN_DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;

function MealPlanTab({ onLog }: { onLog: (recipe: any, meal: string) => void }) {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [activeDay, setActiveDay] = useState(0);
  const [diet, setDiet] = useState("");
  const [intolerances, setIntolerances] = useState("");
  const [calories, setCalories] = useState(2000);
  const [generating, setGenerating] = useState(false);
  const [plan, setPlan] = useState<any | null>(null);
  const [throttle, setThrottle] = useState(canGenerateMealPlan());

  // Load saved plan from Firestore
  useEffect(() => {
    if (!uid) return;
    getDoc(doc(db, "users", uid, "mealPlans", "current")).then(snap => {
      if (snap.exists()) setPlan(snap.data().plan);
    });
  }, [uid]);

  const generate = async () => {
    if (!uid) return;
    setGenerating(true);
    try {
      const result = await generateMealPlan(calories, { diet: diet || undefined, intolerances: intolerances || undefined, timeFrame: "week" });
      setPlan(result);
      setThrottle(canGenerateMealPlan());
      // Save plan
      await setDoc(doc(db, "users", uid, "mealPlans", "current"), {
        plan: result, generatedAt: Timestamp.now(), calories, diet, intolerances,
      });
      // Sync to calendar entries (mealPlanEntries) — one entry per day
      const week = (result as any).week;
      if (week) {
        const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
        // Clear previous mealPlanEntries
        const prevSnap = await getDocs(collection(db, "users", uid, "mealPlanEntries"));
        await Promise.all(prevSnap.docs.map(d => deleteDoc(d.ref)));
        // Add new ones
        await Promise.all(PLAN_DAYS.map(async (dayName, i) => {
          const day = week[dayName];
          if (!day?.meals?.length) return;
          const dateStr = format(addDays(monday, i), "yyyy-MM-dd");
          await addDoc(collection(db, "users", uid, "mealPlanEntries"), {
            date: dateStr,
            dayName,
            meals: day.meals.map((m: any) => ({ id: m.id, title: m.title, image: m.image, readyInMinutes: m.readyInMinutes })),
            nutrients: day.nutrients || null,
            createdAt: Timestamp.now(),
          });
        }));
      }
      toast.success("Meal plan generated and synced to calendar 🎉");
    } catch (e: any) {
      if (e.message?.startsWith("MEAL_PLAN_THROTTLED:")) {
        toast.error(`Plan generator on cooldown — try again in ${e.message.split(":")[1]}`);
      } else if (e.message === "DAILY_LIMIT_REACHED") {
        toast.error("Daily API limit hit — try tomorrow");
      } else {
        toast.error("Failed to generate plan");
      }
    } finally {
      setGenerating(false);
      setThrottle(canGenerateMealPlan());
    }
  };

  const week = plan?.week;
  const dayName = PLAN_DAYS[activeDay];
  const dayData = week?.[dayName];

  return (
    <div className="space-y-5">
      {/* Generator card */}
      <div className="glass-card p-5 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-bold text-base flex items-center gap-2">
              <Sparkles size={16} className="text-amber-400" /> Generate Weekly Meal Plan
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">Throttled to 1 generation per day to save API credits</p>
          </div>
          <button onClick={generate} disabled={generating || !throttle.ok}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-bg text-primary-foreground text-sm font-bold shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed">
            {generating ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
            {!throttle.ok ? `Wait ${throttle.nextAvailable}` : generating ? "Generating..." : plan ? "Regenerate" : "Generate Plan"}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Daily calories</label>
            <input type="number" value={calories} onChange={e => setCalories(parseInt(e.target.value) || 2000)}
              className="mt-1 w-full px-3 py-2 rounded-xl bg-secondary text-sm font-bold border border-border focus:outline-none focus:ring-1 focus:ring-primary/50" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Diet</label>
            <select value={diet} onChange={e => setDiet(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-xl bg-secondary text-sm font-medium border border-border focus:outline-none focus:ring-1 focus:ring-primary/50">
              {DIETS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Intolerances</label>
            <input value={intolerances} onChange={e => setIntolerances(e.target.value)} placeholder="e.g. dairy, peanut"
              className="mt-1 w-full px-3 py-2 rounded-xl bg-secondary text-sm font-medium border border-border focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground/50" />
          </div>
        </div>
      </div>

      {/* Day selector */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {PLAN_DAYS.map((d, i) => (
          <button key={d} onClick={() => setActiveDay(i)}
            className={`flex-shrink-0 px-4 py-2 rounded-2xl text-xs font-bold capitalize transition-all ${activeDay === i ? "gradient-bg text-primary-foreground shadow-lg shadow-primary/20" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
            {d.slice(0, 3)}
          </button>
        ))}
      </div>

      {/* Day plan */}
      {!plan ? (
        <div className="glass-card p-10 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <ChefHat size={28} className="text-primary/60" />
          </div>
          <h3 className="font-bold text-base mb-2">No meal plan yet</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            Click <strong>Generate Plan</strong> above to get a personalised week of meals based on your goals.
          </p>
        </div>
      ) : !dayData?.meals?.length ? (
        <div className="glass-card p-8 text-center text-muted-foreground text-sm">No meals planned for this day</div>
      ) : (
        <>
          {dayData.nutrients && (
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "Calories", value: Math.round(dayData.nutrients.calories || 0), color: "#2563eb" },
                { label: "Protein",  value: `${Math.round(dayData.nutrients.protein || 0)}g`, color: "#06b6d4" },
                { label: "Carbs",    value: `${Math.round(dayData.nutrients.carbohydrates || 0)}g`, color: "#f59e0b" },
                { label: "Fat",      value: `${Math.round(dayData.nutrients.fat || 0)}g`, color: "#8b5cf6" },
              ].map(s => (
                <div key={s.label} className="glass-card p-3 text-center">
                  <p className="text-lg font-black" style={{ color: s.color }}>{s.value}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {dayData.meals.map((meal: any, idx: number) => (
              <motion.div key={meal.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}
                className="glass-card overflow-hidden">
                <div className="aspect-video bg-secondary overflow-hidden">
                  {meal.image
                    ? <img src={`https://spoonacular.com/recipeImages/${meal.id}-636x393.${meal.imageType || 'jpg'}`} alt={meal.title} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center"><ChefHat size={28} className="text-muted-foreground/30" /></div>}
                </div>
                <div className="p-3 space-y-2">
                  <p className="font-bold text-sm line-clamp-2 leading-snug min-h-[2.5rem]">{meal.title}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock size={11} /> {meal.readyInMinutes}m · {meal.servings} servings
                  </div>
                  <button onClick={() => onLog(meal, idx === 0 ? "breakfast" : idx === 1 ? "lunch" : "dinner")}
                    className="w-full mt-1 py-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold transition-colors">
                    Log to diary
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ────────────────── BARCODE SCAN TAB ────────────────── */
function BarcodeTab({ onLog }: { onLog: (food: LoggedFood) => void }) {
  const [upc, setUpc] = useState("");
  const [scanning, setScanning] = useState(false);
  const [product, setProduct] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<any>(null);

  const stopCamera = () => {
    try { controlsRef.current?.stop?.(); } catch {}
    controlsRef.current = null;
    const stream = videoRef.current?.srcObject as MediaStream | null;
    stream?.getTracks().forEach(t => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    setScanning(false);
  };

  useEffect(() => () => stopCamera(), []);

  const startCamera = async () => {
    setError(null);
    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const reader = new BrowserMultiFormatReader();
      setScanning(true);
      const controls = await reader.decodeFromVideoDevice(undefined, videoRef.current!, (result) => {
        if (result) {
          const code = result.getText();
          setUpc(code);
          toast.success(`Detected: ${code}`);
          stopCamera();
          setTimeout(() => doLookup(code), 100);
        }
      });
      controlsRef.current = controls;
    } catch (e: any) {
      setError(e?.message?.includes("Permission") ? "Camera permission denied" : "Camera unavailable. You can still type a UPC manually.");
      setScanning(false);
    }
  };

  const doLookup = async (code: string) => {
    setError(null);
    setProduct(null);
    try {
      const data = await lookupBarcode(code.trim());
      if (!data || data.status === "failure") { setError("Product not found"); return; }
      setProduct(data);
    } catch (e: any) {
      if (e.message === "DAILY_LIMIT_REACHED") setError("Daily API limit reached");
      else setError("Lookup failed");
    }
  };

  const lookup = () => upc.trim() && doLookup(upc.trim());


  const logProduct = (mealId: string) => {
    if (!product) return;
    const n = product.nutrition?.nutrients || [];
    onLog({
      id: `upc_${product.id || product.upc}_${Date.now()}`,
      name: product.title,
      meal: mealId,
      image: product.image,
      calories: getNutrient(n, "Calories"),
      protein:  getNutrient(n, "Protein"),
      carbs:    getNutrient(n, "Carbohydrates"),
      fat:      getNutrient(n, "Fat"),
    });
    pushRecentFood(null, {
      id: `upc_${product.id || product.upc}`,
      name: product.title,
      image: product.image,
      calories: getNutrient(n, "Calories"),
      protein: getNutrient(n, "Protein"),
      carbs:   getNutrient(n, "Carbohydrates"),
      fat:     getNutrient(n, "Fat"),
    });
    toast.success(`${product.title} logged`);
    setProduct(null);
    setUpc("");
  };

  return (
    <div className="grid lg:grid-cols-2 gap-5 items-start">
      <div className="glass-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <ScanBarcode size={18} className="text-primary" />
          <h3 className="font-bold text-base">Scan a barcode</h3>
        </div>

        <div className="aspect-video bg-secondary rounded-xl overflow-hidden relative flex items-center justify-center">
          {scanning ? (
            <>
              <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
              <div className="absolute inset-x-8 inset-y-12 border-2 border-primary/60 rounded-xl pointer-events-none" />
            </>
          ) : (
            <div className="text-center p-6">
              <Camera size={36} className="mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-xs text-muted-foreground">Camera off — start to scan</p>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          {!scanning ? (
            <button onClick={startCamera}
              className="flex-1 py-2.5 rounded-xl gradient-bg text-primary-foreground text-sm font-bold flex items-center justify-center gap-2">
              <Camera size={14} /> Start Camera
            </button>
          ) : (
            <button onClick={stopCamera}
              className="flex-1 py-2.5 rounded-xl bg-secondary text-foreground text-sm font-bold">Stop</button>
          )}
        </div>

        <div className="flex gap-2">
          <input value={upc} onChange={e => setUpc(e.target.value)} placeholder="Type UPC code (e.g. 028400064057)"
            className="flex-1 px-4 py-2.5 rounded-xl bg-secondary text-sm font-medium border border-border focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground/50" />
          <button onClick={lookup}
            className="px-5 py-2.5 rounded-xl gradient-bg text-primary-foreground text-sm font-bold">Look up</button>
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-xs text-destructive">
            <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Product result */}
      <div className="glass-card p-5 min-h-[300px]">
        {!product ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-10">
            <ScanBarcode size={32} className="text-muted-foreground/30 mb-3" />
            <p className="text-sm font-bold text-muted-foreground">Scan or type a UPC</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Powered by Spoonacular product database</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-3">
              {product.image && <img src={product.image} alt="" className="w-20 h-20 rounded-xl object-cover" />}
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-sm leading-snug">{product.title}</h4>
                {product.brand && <p className="text-xs text-muted-foreground mt-1">{product.brand}</p>}
              </div>
            </div>
            {product.nutrition?.nutrients && (
              <div className="grid grid-cols-4 gap-2">
                {["Calories", "Protein", "Carbohydrates", "Fat"].map((nm, i) => (
                  <div key={nm} className="text-center py-2 rounded-xl bg-secondary/50">
                    <p className="text-base font-black" style={{ color: ["#2563eb", "#06b6d4", "#f59e0b", "#8b5cf6"][i] }}>
                      {getNutrient(product.nutrition.nutrients, nm)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{nm.slice(0, 4)}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              {MEALS.map(m => (
                <button key={m.id} onClick={() => logProduct(m.id)}
                  className="flex items-center justify-center gap-1.5 py-2 rounded-xl bg-secondary hover:bg-primary/20 hover:text-primary text-xs font-bold transition-colors">
                  {m.icon} {m.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ────────────────── MAIN PAGE ────────────────── */
export default function Nutrition() {
  const [activeTab, setActiveTab] = useState<Tab>("Diary");
  const { user, userProfile } = useAuth();
  const uid = user?.uid ?? null;

  // Personalise calorie/macro targets from the onboarding-derived profile.
  // If the profile doesn't have explicit targets yet (e.g. user just finished onboarding
  // without an explicit nutrition step), compute them on the fly from goal/weight/etc.
  const computed = useMemo(() => computeTargets((userProfile as any) || {}), [userProfile]);
  MACRO_GOALS = {
    calories: (userProfile as any)?.calorieTarget || computed.calorieTarget || DEFAULT_MACRO_GOALS.calories,
    protein:  (userProfile as any)?.protein       || computed.protein       || DEFAULT_MACRO_GOALS.protein,
    carbs:    (userProfile as any)?.carbs         || computed.carbs         || DEFAULT_MACRO_GOALS.carbs,
    fat:      (userProfile as any)?.fat           || computed.fat           || DEFAULT_MACRO_GOALS.fat,
    fiber:    (userProfile as any)?.fiber         || computed.fiber         || DEFAULT_MACRO_GOALS.fiber,
  };


  // Today’s totals for header
  const [headerTotals, setHeaderTotals] = useState({ calories: 0, protein: 0 });
  useEffect(() => {
    if (!uid) return;
    const today = format(new Date(), "yyyy-MM-dd");
    getDoc(doc(db, "users", uid, "foodLogs", today)).then(snap => {
      if (snap.exists()) {
        const d = snap.data() as DayLog;
        const t = (d.foods || []).reduce((acc, f) => ({
          calories: acc.calories + (f.calories || 0),
          protein:  acc.protein  + (f.protein  || 0),
        }), { calories: 0, protein: 0 });
        setHeaderTotals(t);
      }
    });
  }, [uid, activeTab]);

  // Streak (consecutive days with foods)
  const [streak, setStreak] = useState(0);
  useEffect(() => {
    if (!uid) return;
    (async () => {
      let s = 0;
      for (let i = 0; i < 30; i++) {
        const dateStr = format(subDays(new Date(), i), "yyyy-MM-dd");
        const snap = await getDoc(doc(db, "users", uid, "foodLogs", dateStr));
        if (snap.exists() && (snap.data() as DayLog).foods?.length) s++;
        else if (i > 0) break;
      }
      setStreak(s);
    })();
  }, [uid]);

  /* Logging from recipes / barcode → today's foodLog */
  const logRecipeToToday = async (recipe: any, mealId: string) => {
    if (!uid) return;
    const dateStr = format(new Date(), "yyyy-MM-dd");
    const ref = doc(db, "users", uid, "foodLogs", dateStr);
    const snap = await getDoc(ref);
    const existing = snap.exists() ? (snap.data() as DayLog) : { date: dateStr, foods: [], water: 0 };

    const n = recipe.nutrition?.nutrients || [];
    const food: LoggedFood = {
      id:       `recipe_${recipe.id}_${Date.now()}`,
      name:     recipe.title,
      meal:     mealId,
      image:    recipe.image,
      calories: getNutrient(n, "Calories"),
      protein:  getNutrient(n, "Protein"),
      carbs:    getNutrient(n, "Carbohydrates"),
      fat:      getNutrient(n, "Fat"),
    };
    const next: DayLog = { ...existing, foods: [...existing.foods, food] };
    await setDoc(ref, next);
    pushRecentFood(uid, food);
    toast.success(`"${recipe.title}" logged to ${MEALS.find(m => m.id === mealId)?.label || mealId}`);
  };

  const logFoodToToday = async (food: LoggedFood) => {
    if (!uid) return;
    const dateStr = format(new Date(), "yyyy-MM-dd");
    const ref = doc(db, "users", uid, "foodLogs", dateStr);
    const snap = await getDoc(ref);
    const existing = snap.exists() ? (snap.data() as DayLog) : { date: dateStr, foods: [], water: 0 };
    const next: DayLog = { ...existing, foods: [...existing.foods, food] };
    await setDoc(ref, next);
  };

  const TAB_ICONS: Record<Tab, any> = {
    "Diary":        UtensilsCrossed,
    "Recipes":      ChefHat,
    "Meal Plan":    CalendarDays,
    "Barcode Scan": ScanBarcode,
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 pb-24 space-y-6">

        {/* ── HEADER (matches mockup) ── */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="relative rounded-3xl overflow-hidden p-6 md:p-7"
          style={{ background: "linear-gradient(135deg, rgba(37,99,235,0.20) 0%, rgba(6,182,212,0.10) 100%)" }}>
          <div className="absolute inset-0 border border-primary/20 rounded-3xl pointer-events-none" />
          <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full opacity-10 blur-3xl bg-cyan-500" />
          <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full opacity-10 blur-3xl bg-primary" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight">Nutrition</h1>
              <p className="text-muted-foreground text-sm mt-1">Track meals, discover recipes and nail your macros daily.</p>
            </div>

            <div className="flex items-center gap-5 sm:gap-7">
              <div className="text-right">
                <p className="text-2xl font-black">{headerTotals.calories || MACRO_GOALS.calories}</p>
                <p className="text-[10px] text-muted-foreground">{headerTotals.calories ? "today / " + MACRO_GOALS.calories.toLocaleString() : "daily calorie goal"}</p>
              </div>
              <div className="w-px h-9 bg-border" />
              <div className="text-right">
                <p className="text-2xl font-black text-cyan-400">{headerTotals.protein}g</p>
                <p className="text-[10px] text-muted-foreground">protein {headerTotals.protein ? "today" : "goal " + MACRO_GOALS.protein + "g"}</p>
              </div>
              <div className="w-px h-9 bg-border hidden sm:block" />
              <div className="text-right hidden sm:block">
                <p className="text-2xl font-black text-amber-400">{streak}</p>
                <p className="text-[10px] text-muted-foreground">day streak</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── TABS + API USAGE ── */}
        <div className="flex items-center gap-3 justify-between">
          <div className="flex-1 min-w-0 -mx-1 px-1 overflow-x-auto scrollbar-hide">
            <div className="inline-flex items-center gap-1 p-1 bg-secondary rounded-2xl">
              {TABS.map(tab => {
                const Icon = TAB_ICONS[tab];
                const isNew = tab === "Barcode Scan";
                return (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    className={`relative flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
                      activeTab === tab
                        ? "gradient-bg text-primary-foreground shadow-lg shadow-primary/20"
                        : "text-muted-foreground hover:text-foreground"
                    }`}>
                    <Icon size={14} />
                    <span>{tab.split(" ")[0]}</span>
                    {isNew && (
                      <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 rounded-full text-[8px] font-black bg-amber-500 text-amber-950 leading-none">new</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="hidden md:block flex-shrink-0"><ApiUsageBadge /></div>
        </div>

        {/* ── TAB CONTENT ── */}
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
            {activeTab === "Diary"        && <DiaryTab />}
            {activeTab === "Recipes"      && <RecipesTab onLog={logRecipeToToday} />}
            {activeTab === "Meal Plan"    && <MealPlanTab onLog={logRecipeToToday} />}
            {activeTab === "Barcode Scan" && <BarcodeTab onLog={logFoodToToday} />}
          </motion.div>
        </AnimatePresence>

      </div>
    </AppLayout>
  );
}
