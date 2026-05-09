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
import { Trash2, Plus, Eye, EyeOff, Dumbbell, UtensilsCrossed } from "lucide-react";
import { logActivity } from "@/lib/activity";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

type LibType = "workouts" | "mealPlans";

interface LibraryPlan {
  id: string;
  title: string;
  description?: string;
  status: "draft" | "published";
  days?: string[];
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

  useEffect(() => {
    const q = query(collection(db, "library", tab), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setPlans(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
    }, (err) => {
      console.error("[admin/library]", err);
    });
    return unsub;
  }, [tab]);

  async function createPlan() {
    if (!title.trim()) { toast.error("Title required"); return; }
    const days = daysText.split("\n").map(s => s.trim()).filter(Boolean);
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    try {
      await setDoc(doc(db, "library", tab, id), {
        title: title.trim(),
        description: desc.trim() || null,
        days,
        status: "draft",
        createdAt: serverTimestamp(),
        createdBy: user?.uid ?? null,
      });
      logActivity("library.plan.create", { id, type: tab, title });
      setTitle(""); setDesc(""); setDaysText("");
      toast.success("Draft created");
    } catch (e: any) {
      toast.error(e?.message || "Failed to create");
    }
  }

  async function togglePublish(p: LibraryPlan) {
    const next = p.status === "published" ? "draft" : "published";
    try {
      await setDoc(doc(db, "library", tab, p.id), { status: next, publishedAt: serverTimestamp() }, { merge: true });
      if (next === "published") logActivity("library.plan.publish", { id: p.id, type: tab });
      toast.success(next === "published" ? "Published — visible in Library" : "Unpublished");
    } catch (e: any) {
      toast.error(e?.message || "Failed");
    }
  }

  async function remove(p: LibraryPlan) {
    if (!confirm(`Delete "${p.title}"?`)) return;
    await deleteDoc(doc(db, "library", tab, p.id));
    logActivity("library.plan.delete", { id: p.id, type: tab });
    toast.success("Deleted");
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold">Content Library</h1>
        <p className="text-sm text-muted-foreground">Author plans once — published items appear in every user's Library page.</p>
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

      <Card className="p-6 space-y-3">
        <div className="font-semibold text-sm flex items-center gap-2"><Plus size={16} /> New {tab === "workouts" ? "workout" : "meal"} plan</div>
        <Input placeholder="Title (e.g. Beginner Push/Pull/Legs)" value={title} onChange={e => setTitle(e.target.value)} />
        <Textarea placeholder="Short description shown to users" value={desc} onChange={e => setDesc(e.target.value)} rows={2} />
        <Textarea
          placeholder={tab === "workouts"
            ? "One day per line, e.g.\nDay 1 — Push: Bench 4x8, OHP 3x10\nDay 2 — Pull: Rows 4x8, Pulldowns 3x10"
            : "One day per line, e.g.\nDay 1 — High protein: oats, chicken bowl, salmon, casein\nDay 2 — Cut: eggs, tuna salad, steak & rice"}
          value={daysText} onChange={e => setDaysText(e.target.value)} rows={5}
        />
        <Button onClick={createPlan}><Plus size={14} className="mr-1" /> Save as draft</Button>
      </Card>

      <Card>
        <div className="p-4 border-b border-border text-sm font-semibold flex items-center justify-between">
          <span>{tab === "workouts" ? "Workout" : "Meal"} library ({plans.length})</span>
          <span className="text-xs font-normal text-muted-foreground">Published items show up in every user's Library page.</span>
        </div>
        <ul className="divide-y divide-border">
          {plans.map(p => (
            <li key={p.id} className="p-4 flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={p.status === "published" ? "default" : "outline"}>
                    {p.status}
                  </Badge>
                  <span className="font-medium">{p.title}</span>
                  <span className="text-xs text-muted-foreground">{p.days?.length || 0} day{(p.days?.length || 0) === 1 ? "" : "s"}</span>
                </div>
                {p.description && <p className="text-sm text-muted-foreground mt-1">{p.description}</p>}
              </div>
              <div className="flex items-center gap-1">
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
            <li className="p-6 text-center text-sm text-muted-foreground">No plans yet — create one above.</li>
          )}
        </ul>
      </Card>
    </div>
  );
}
