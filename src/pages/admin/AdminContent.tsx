import { useEffect, useMemo, useState } from "react";
import {
  collection, doc, onSnapshot, serverTimestamp, setDoc, deleteDoc, query, orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Trash2, Plus, Eye, EyeOff, Dumbbell, UtensilsCrossed, Search,
  Loader2, Send, X, Save, Flame, Activity,
} from "lucide-react";
import { logActivity } from "@/lib/activity";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { searchRecipes } from "@/lib/spoonacular";
import { searchExercises, getExercisesByBodyPart } from "@/lib/api";

type LibType = "workouts" | "mealPlans";

interface Item { name: string; meta?: string; detail?: string }
interface Day { title: string; items: Item[] }

interface LibraryPlan {
  id: string;
  title: string;
  description?: string;
  status: "draft" | "published";
  days?: string[];
  imageUrl?: string;
  source?: string;
  createdAt?: any;
}

const BODY_PARTS = ["all", "chest", "back", "shoulders", "upper arms", "upper legs", "waist", "cardio"];
const DIETS = ["", "high protein", "vegetarian", "vegan", "keto", "low carb"];

/* Offline catalogues so the builder always works even if a provider quota is hit */
const EX_FALLBACK: Item[] = [
  { name: "Bench press", meta: "Chest" },
  { name: "Bent-over row", meta: "Back" },
  { name: "Overhead press", meta: "Shoulders" },
  { name: "Romanian deadlift", meta: "Hamstrings" },
  { name: "Lat pulldown", meta: "Back" },
  { name: "Goblet squat", meta: "Quads" },
];
const MEAL_FALLBACK: Item[] = [
  { name: "Grilled chicken salad", meta: "420 kcal" },
  { name: "Greek yogurt parfait", meta: "280 kcal" },
  { name: "Salmon and quinoa bowl", meta: "510 kcal" },
  { name: "Veggie stir-fry", meta: "390 kcal" },
  { name: "Overnight oats", meta: "340 kcal" },
  { name: "Turkey chili", meta: "460 kcal" },
];

function dayToString(d: Day, i: number) {
  const head = d.title?.trim() || `Day ${i + 1}`;
  const body = d.items.map(it => (it.meta ? `${it.name} (${it.meta})` : it.name)).join(", ");
  return body ? `Day ${i + 1} — ${head}: ${body}` : `Day ${i + 1} — ${head}`;
}

export default function AdminContent() {
  const { user } = useAuth();
  const [tab, setTab] = useState<LibType>("workouts");
  const [plans, setPlans] = useState<LibraryPlan[]>([]);

  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [days, setDays] = useState<Day[]>([{ title: "", items: [] }]);
  const [activeDay, setActiveDay] = useState(0);

  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("");
  const [results, setResults] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, `library_${tab}`), orderBy("createdAt", "desc")),
      snap => setPlans(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))),
    );
    return unsub;
  }, [tab]);

  // reset builder when switching library
  useEffect(() => {
    setDays([{ title: "", items: [] }]); setActiveDay(0);
    setTitle(""); setDesc(""); setQ(""); setFilter("");
    setResults(tab === "workouts" ? EX_FALLBACK : MEAL_FALLBACK);
  }, [tab]);

  const published = plans.filter(p => p.status === "published").length;
  const totalItems = useMemo(() => days.reduce((n, d) => n + d.items.length, 0), [days]);

  async function runSearch() {
    setBusy(true);
    try {
      if (tab === "workouts") {
        const raw = q.trim()
          ? await searchExercises(q.trim())
          : await getExercisesByBodyPart(filter || "chest");
        const list: Item[] = (Array.isArray(raw) ? raw : []).slice(0, 20).map((e: any) => ({
          name: String(e.name ?? "").replace(/\b\w/g, c => c.toUpperCase()),
          meta: e.bodyPart ?? e.target,
          detail: e.equipment,
        })).filter(i => i.name);
        setResults(list.length ? list : EX_FALLBACK);
      } else {
        const data = await searchRecipes(q.trim() || "high protein", filter ? { diet: filter } : {});
        const list: Item[] = (data?.results ?? []).slice(0, 20).map((r: any) => {
          const cals = r.nutrition?.nutrients?.find((n: any) => n.name === "Calories")?.amount;
          return { name: r.title, meta: cals ? `${Math.round(cals)} kcal` : undefined, detail: r.image };
        });
        setResults(list.length ? list : MEAL_FALLBACK);
      }
    } catch (e: any) {
      toast.error(e?.message === "DAILY_LIMIT_REACHED" ? "API limit reached — using offline catalogue" : "Search failed — using offline catalogue");
      setResults(tab === "workouts" ? EX_FALLBACK : MEAL_FALLBACK);
    } finally { setBusy(false); }
  }

  function addItem(it: Item) {
    setDays(prev => prev.map((d, i) => i === activeDay
      ? { ...d, items: [...d.items, tab === "workouts" ? { ...it, detail: it.detail ?? "4x8" } : it] }
      : d));
  }
  function removeItem(dayIdx: number, itemIdx: number) {
    setDays(prev => prev.map((d, i) => i === dayIdx ? { ...d, items: d.items.filter((_, j) => j !== itemIdx) } : d));
  }
  function setItemDetail(dayIdx: number, itemIdx: number, detail: string) {
    setDays(prev => prev.map((d, i) => i === dayIdx
      ? { ...d, items: d.items.map((it, j) => j === itemIdx ? { ...it, detail } : it) } : d));
  }

  async function save(status: "draft" | "published") {
    if (!title.trim()) { toast.error("Give the plan a title"); return; }
    if (!totalItems) { toast.error("Add at least one item from the library"); return; }
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    try {
      await setDoc(doc(db, `library_${tab}`, id), {
        title: title.trim(),
        description: desc.trim() || null,
        days: days.map(dayToString),
        plan: days,
        imageUrl: null,
        source: tab === "workouts" ? "exercisedb" : "spoonacular",
        status,
        createdAt: serverTimestamp(),
        createdBy: user?.uid ?? null,
      });
      logActivity("library.plan.create", { id, type: tab, title: title.trim() });
      if (status === "published") logActivity("library.plan.publish", { id, type: tab });
      setTitle(""); setDesc(""); setDays([{ title: "", items: [] }]); setActiveDay(0);
      toast.success(status === "published" ? "Published to every member" : "Draft saved");
    } catch (e: any) {
      toast.error(e?.message || "Failed to save");
    }
  }

  async function togglePublish(p: LibraryPlan) {
    const next = p.status === "published" ? "draft" : "published";
    await setDoc(doc(db, `library_${tab}`, p.id), { status: next, publishedAt: serverTimestamp() }, { merge: true });
    if (next === "published") logActivity("library.plan.publish", { id: p.id, type: tab });
    toast.success(next === "published" ? "Published — visible in Library" : "Unpublished");
  }

  async function remove(p: LibraryPlan) {
    if (!confirm(`Delete "${p.title}"?`)) return;
    await deleteDoc(doc(db, `library_${tab}`, p.id));
    logActivity("library.plan.delete", { id: p.id, type: tab });
    toast.success("Deleted");
  }

  const isWorkout = tab === "workouts";
  const ItemIcon = isWorkout ? Activity : Flame;

  return (
    <div className="space-y-8">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Content library</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Search {isWorkout ? "ExerciseDB" : "Spoonacular"} and drop results straight into a plan.
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline">{plans.length} total</Badge>
          <Badge>{published} published</Badge>
        </div>
      </header>

      <div className="flex gap-2">
        {([
          { v: "workouts" as LibType, label: "Workout plans", icon: Dumbbell },
          { v: "mealPlans" as LibType, label: "Meal plans", icon: UtensilsCrossed },
        ]).map(t => (
          <button key={t.v} onClick={() => setTab(t.v)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
              tab === t.v ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}>
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {/* BUILDER */}
      <Card className="p-5 md:p-6 space-y-5">
        <div className="flex items-center gap-2 text-lg font-bold">
          <Plus size={18} /> New {isWorkout ? "workout" : "meal"} plan
        </div>

        <div className="space-y-3">
          <Input placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} />
          <Textarea placeholder="Short description shown to users" rows={2}
            value={desc} onChange={e => setDesc(e.target.value)} />
        </div>

        {/* day tabs */}
        {days.length > 1 && (
          <div className="flex gap-1.5 flex-wrap">
            {days.map((d, i) => (
              <button key={i} onClick={() => setActiveDay(i)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  activeDay === i ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}>
                Day {i + 1}
                <span className="ml-1.5 opacity-60">{d.items.length}</span>
              </button>
            ))}
          </div>
        )}

        {days.map((d, di) => (
          <div key={di} className={di === activeDay ? "space-y-2" : "hidden"}>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Day {di + 1}</p>
            <Input
              placeholder={isWorkout ? "Push — chest, shoulders, triceps" : "High protein day"}
              value={d.title}
              onChange={e => setDays(prev => prev.map((x, i) => i === di ? { ...x, title: e.target.value } : x))}
            />
            <div className="divide-y divide-border rounded-xl border border-border">
              {d.items.map((it, ii) => (
                <div key={ii} className="flex items-center gap-2 px-3 py-2">
                  <ItemIcon size={14} className="text-primary shrink-0" />
                  <span className="text-sm font-semibold truncate">{it.name}</span>
                  {it.meta && <span className="text-[11px] text-muted-foreground truncate">{it.meta}</span>}
                  <div className="ml-auto flex items-center gap-1.5">
                    {isWorkout && (
                      <Input className="h-7 w-16 text-center text-xs" value={it.detail ?? ""}
                        onChange={e => setItemDetail(di, ii, e.target.value)} />
                    )}
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeItem(di, ii)}>
                      <X size={13} />
                    </Button>
                  </div>
                </div>
              ))}
              {d.items.length === 0 && (
                <p className="px-3 py-4 text-xs text-muted-foreground text-center">
                  Nothing yet — add {isWorkout ? "exercises" : "meals"} from the search below.
                </p>
              )}

              {/* provider search */}
              <div className="p-3 space-y-2 bg-secondary/30">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input className="pl-9" placeholder={isWorkout ? "Search ExerciseDB…" : "Search Spoonacular…"}
                      value={q} onChange={e => setQ(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && runSearch()} />
                  </div>
                  <select
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={filter} onChange={e => setFilter(e.target.value)}
                  >
                    {(isWorkout ? BODY_PARTS : DIETS).map(o => (
                      <option key={o} value={o === "all" ? "" : o}>
                        {o === "" ? "All diets" : o === "all" ? "All body parts" : o}
                      </option>
                    ))}
                  </select>
                  <Button onClick={runSearch} disabled={busy}>
                    {busy ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                  </Button>
                </div>
                <div className="max-h-[280px] overflow-y-auto divide-y divide-border rounded-lg bg-background">
                  {results.map((r, i) => (
                    <div key={`${r.name}-${i}`} className="flex items-center gap-2 px-3 py-2">
                      <ItemIcon size={13} className="text-muted-foreground shrink-0" />
                      <span className="text-sm font-semibold truncate">{r.name}</span>
                      {r.meta && <span className="text-[11px] text-muted-foreground truncate">{r.meta}</span>}
                      <Button size="sm" variant="outline" className="ml-auto h-7 text-[11px] px-2"
                        onClick={() => addItem(r)}>
                        <Plus size={11} className="mr-1" /> Add
                      </Button>
                    </div>
                  ))}
                  {results.length === 0 && (
                    <p className="px-3 py-4 text-xs text-muted-foreground text-center">No results — try another term.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}

        <div className="flex flex-wrap gap-2 pt-1">
          <Button variant="outline" onClick={() => { setDays(p => [...p, { title: "", items: [] }]); setActiveDay(days.length); }}>
            <Plus size={14} className="mr-1" /> Add day
          </Button>
          <div className="flex-1" />
          <Button variant="outline" onClick={() => save("draft")}><Save size={14} className="mr-1" /> Save draft</Button>
          <Button onClick={() => save("published")}><Send size={14} className="mr-1" /> Publish now</Button>
        </div>
      </Card>

      {/* LIST */}
      <Card>
        <div className="p-4 border-b border-border text-sm font-semibold flex items-center justify-between">
          <span>{isWorkout ? "Workout" : "Meal"} library ({plans.length})</span>
          <span className="text-xs font-normal text-muted-foreground">Toggle the eye to publish or unpublish.</span>
        </div>
        <ul className="divide-y divide-border">
          {plans.map(p => (
            <li key={p.id} className="p-4 flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center shrink-0 text-primary">
                {isWorkout ? <Dumbbell size={16} /> : <UtensilsCrossed size={16} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={p.status === "published" ? "default" : "outline"}>{p.status}</Badge>
                  {p.source && <Badge variant="secondary" className="text-[10px]">{p.source}</Badge>}
                  <span className="font-semibold">{p.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {p.days?.length || 0} day{(p.days?.length || 0) === 1 ? "" : "s"}
                  </span>
                </div>
                {p.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{p.description}</p>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button size="sm" variant="ghost" onClick={() => togglePublish(p)}
                  title={p.status === "published" ? "Unpublish" : "Publish"}>
                  {p.status === "published" ? <EyeOff size={14} /> : <Eye size={14} />}
                </Button>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(p)}>
                  <Trash2 size={14} />
                </Button>
              </div>
            </li>
          ))}
          {plans.length === 0 && (
            <li className="p-6 text-center text-sm text-muted-foreground">No plans yet — build one above.</li>
          )}
        </ul>
      </Card>
    </div>
  );
}
