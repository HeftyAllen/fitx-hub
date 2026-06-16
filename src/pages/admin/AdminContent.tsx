import { useEffect, useState } from "react";
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
  Trash2, Plus, Eye, EyeOff, Dumbbell, UtensilsCrossed, Search, Sparkles,
  Image as ImageIcon, Loader2, Send,
} from "lucide-react";
import { logActivity } from "@/lib/activity";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { searchRecipes } from "@/lib/spoonacular";

type LibType = "workouts" | "mealPlans";

interface LibraryPlan {
  id: string;
  title: string;
  description?: string;
  status: "draft" | "published";
  days?: string[];
  imageUrl?: string;
  source?: string;
  createdAt?: any;
  createdBy?: string;
}

export default function AdminContent() {
  const { user } = useAuth();
  const [tab, setTab] = useState<LibType>("workouts");
  const [plans, setPlans] = useState<LibraryPlan[]>([]);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [daysText, setDaysText] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  // Spoonacular import (meal plans only)
  const [spQuery, setSpQuery] = useState("");
  const [spResults, setSpResults] = useState<any[]>([]);
  const [spLoading, setSpLoading] = useState(false);

  useEffect(() => {
    const q = query(collection(db, `library_${tab}`), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setPlans(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
    });
    return unsub;
  }, [tab]);

  const published = plans.filter(p => p.status === "published").length;

  async function createPlan(extra: Partial<LibraryPlan> = {}, statusOverride?: "draft" | "published") {
    const t = (extra.title ?? title).trim();
    if (!t) { toast.error("Title required"); return; }
    const days = (extra.days ?? daysText.split("\n").map(s => s.trim()).filter(Boolean)) as string[];
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    try {
      await setDoc(doc(db, `library_${tab}`, id), {
        title: t,
        description: (extra.description ?? desc).trim() || null,
        days,
        imageUrl: extra.imageUrl ?? imageUrl.trim() || null,
        source: extra.source ?? "custom",
        status: statusOverride ?? "draft",
        createdAt: serverTimestamp(),
        createdBy: user?.uid ?? null,
      });
      logActivity("library.plan.create", { id, type: tab, title: t });
      if (statusOverride === "published") logActivity("library.plan.publish", { id, type: tab });
      if (!extra.title) { setTitle(""); setDesc(""); setDaysText(""); setImageUrl(""); }
      toast.success(statusOverride === "published" ? "Published to all users" : "Draft created");
    } catch (e: any) {
      toast.error(e?.message || "Failed to create");
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

  async function runSpoonacular() {
    if (!spQuery.trim()) return;
    setSpLoading(true);
    try {
      const data = await searchRecipes(spQuery.trim(), {});
      setSpResults(data?.results ?? []);
    } catch (e: any) {
      toast.error(e.message === "DAILY_LIMIT_REACHED" ? "API limit reached" : "Search failed");
    } finally { setSpLoading(false); }
  }

  async function importSpoonacular(r: any, publish: boolean) {
    const cals = r.nutrition?.nutrients?.find((n: any) => n.name === "Calories")?.amount;
    const description = [
      r.readyInMinutes ? `${r.readyInMinutes} min` : null,
      r.servings ? `${r.servings} servings` : null,
      cals ? `${Math.round(cals)} cal` : null,
    ].filter(Boolean).join(" · ");
    const days = (r.analyzedInstructions?.[0]?.steps || [])
      .slice(0, 7)
      .map((s: any, i: number) => `Step ${i + 1}: ${s.step}`);
    await createPlan({
      title: r.title,
      description: description || r.summary?.replace(/<[^>]+>/g, "").slice(0, 200) || "",
      days: days.length ? days : [`Recipe ID ${r.id} — see Spoonacular for full instructions.`],
      imageUrl: r.image,
      source: "spoonacular",
    }, publish ? "published" : "draft");
  }

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">Content Library</h1>
          <p className="text-sm text-muted-foreground">Author, import & publish plans that appear in every user's Library.</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline">{plans.length} total</Badge>
          <Badge>{published} published</Badge>
        </div>
      </header>

      <div className="flex gap-2">
        {([
          { v: "workouts" as LibType, label: "Workout Plans", icon: Dumbbell },
          { v: "mealPlans" as LibType, label: "Meal Plans",   icon: UtensilsCrossed },
        ]).map(t => (
          <button key={t.v} onClick={() => setTab(t.v)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              tab === t.v ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}>
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Manual authoring */}
        <Card className="p-6 space-y-3">
          <div className="font-semibold text-sm flex items-center gap-2"><Plus size={16} /> New {tab === "workouts" ? "workout" : "meal"} plan</div>
          <Input placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} />
          <Textarea placeholder="Short description shown to users" value={desc} onChange={e => setDesc(e.target.value)} rows={2} />
          <Input placeholder="Cover image URL (optional)" value={imageUrl} onChange={e => setImageUrl(e.target.value)} />
          <Textarea
            placeholder={tab === "workouts"
              ? "One day per line\nDay 1 — Push: Bench 4x8, OHP 3x10\nDay 2 — Pull: Rows 4x8"
              : "One day per line\nDay 1 — High protein: oats, chicken bowl, salmon\nDay 2 — Cut: eggs, tuna salad, steak & rice"}
            value={daysText} onChange={e => setDaysText(e.target.value)} rows={5}
          />
          <div className="flex gap-2">
            <Button onClick={() => createPlan()}><Plus size={14} className="mr-1" /> Save draft</Button>
            <Button variant="default" className="bg-primary" onClick={() => createPlan({}, "published")}>
              <Send size={14} className="mr-1" /> Publish now
            </Button>
          </div>
        </Card>

        {/* Spoonacular import — meal plans only */}
        {tab === "mealPlans" ? (
          <Card className="p-6 space-y-3">
            <div className="font-semibold text-sm flex items-center gap-2">
              <Sparkles size={16} className="text-amber-400" /> Import from Spoonacular
            </div>
            <p className="text-xs text-muted-foreground">Search the live recipe API and push any result straight to every user's library.</p>
            <div className="flex gap-2">
              <Input placeholder="e.g. high protein dinner" value={spQuery}
                onChange={e => setSpQuery(e.target.value)}
                onKeyDown={e => e.key === "Enter" && runSpoonacular()} />
              <Button onClick={runSpoonacular} disabled={spLoading}>
                {spLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              </Button>
            </div>
            <div className="max-h-[340px] overflow-y-auto divide-y divide-border -mx-2 px-2">
              {spResults.map(r => (
                <div key={r.id} className="flex gap-3 py-2 items-start">
                  {r.image
                    ? <img src={r.image} alt="" className="w-14 h-14 object-cover rounded-lg flex-shrink-0" />
                    : <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center"><ImageIcon size={16} /></div>}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-snug line-clamp-2">{r.title}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {r.readyInMinutes ? `${r.readyInMinutes}m · ` : ""}{r.servings ? `${r.servings} servings` : ""}
                    </p>
                    <div className="flex gap-1 mt-1.5">
                      <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => importSpoonacular(r, false)}>
                        Save draft
                      </Button>
                      <Button size="sm" className="h-6 text-[10px] px-2" onClick={() => importSpoonacular(r, true)}>
                        Publish
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              {spResults.length === 0 && !spLoading && (
                <p className="text-xs text-muted-foreground text-center py-6">Search above to pull live recipes.</p>
              )}
            </div>
          </Card>
        ) : (
          <Card className="p-6 space-y-3">
            <div className="font-semibold text-sm flex items-center gap-2"><Dumbbell size={16} /> Tips</div>
            <p className="text-xs text-muted-foreground">
              Use one day per line. Format suggestion:<br />
              <code className="text-[10px] bg-muted px-1 rounded">Day N — Focus: Exercise sets×reps, …</code>
            </p>
            <p className="text-xs text-muted-foreground">
              Published plans appear under <strong>Workout → Coach Library</strong> for every signed-in user.
            </p>
          </Card>
        )}
      </div>

      <Card>
        <div className="p-4 border-b border-border text-sm font-semibold flex items-center justify-between">
          <span>{tab === "workouts" ? "Workout" : "Meal"} library ({plans.length})</span>
          <span className="text-xs font-normal text-muted-foreground">Toggle the eye to publish/unpublish.</span>
        </div>
        <ul className="divide-y divide-border">
          {plans.map(p => (
            <li key={p.id} className="p-4 flex items-start gap-3">
              {p.imageUrl
                ? <img src={p.imageUrl} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                : <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    {tab === "workouts" ? <Dumbbell size={16} /> : <UtensilsCrossed size={16} />}
                  </div>}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={p.status === "published" ? "default" : "outline"}>{p.status}</Badge>
                  {p.source === "spoonacular" && <Badge variant="secondary" className="text-[10px]">API</Badge>}
                  <span className="font-medium">{p.title}</span>
                  <span className="text-xs text-muted-foreground">{p.days?.length || 0} day{(p.days?.length || 0) === 1 ? "" : "s"}</span>
                </div>
                {p.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{p.description}</p>}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
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
            <li className="p-6 text-center text-sm text-muted-foreground">No plans yet — create one above or import from Spoonacular.</li>
          )}
        </ul>
      </Card>
    </div>
  );
}
