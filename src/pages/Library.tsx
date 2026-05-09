import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import {
  collection, doc, onSnapshot, query, orderBy, where,
  setDoc, getDoc, serverTimestamp,
} from "firebase/firestore";
import { motion } from "framer-motion";
import { Dumbbell, UtensilsCrossed, Check, Library as LibraryIcon, Plus } from "lucide-react";
import { toast } from "sonner";
import { logActivity } from "@/lib/activity";

type LibType = "workouts" | "mealPlans";

interface LibraryPlan {
  id: string;
  title: string;
  description?: string;
  type: LibType;
  status: "draft" | "published";
  days?: any[];
  meta?: any;
}

export default function Library() {
  const { user } = useAuth();
  const [tab, setTab] = useState<LibType>("workouts");
  const [plans, setPlans] = useState<LibraryPlan[]>([]);
  const [optedIn, setOptedIn] = useState<Set<string>>(new Set());

  useEffect(() => {
    const q = query(
      collection(db, "library", tab),
      where("status", "==", "published"),
      orderBy("createdAt", "desc"),
    );
    const unsub = onSnapshot(q, (snap) => {
      setPlans(snap.docs.map(d => ({ id: d.id, type: tab, ...(d.data() as any) })));
    }, () => setPlans([]));
    return unsub;
  }, [tab]);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(
      collection(db, "users", user.uid, "libraryOptIns"),
      (snap) => setOptedIn(new Set(snap.docs.map(d => d.id))),
    );
    return unsub;
  }, [user]);

  async function optIn(plan: LibraryPlan) {
    if (!user) return;
    try {
      // 1) record opt-in
      await setDoc(doc(db, "users", user.uid, "libraryOptIns", plan.id), {
        planId: plan.id, type: plan.type, title: plan.title,
        acceptedAt: serverTimestamp(),
      });

      // 2) clone into user's own collection so existing planner pages "just work"
      const targetCollection = plan.type === "workouts" ? "workoutPlans" : "mealPlans";
      await setDoc(doc(db, "users", user.uid, targetCollection, plan.id), {
        title: plan.title,
        description: plan.description ?? null,
        days: plan.days ?? [],
        source: "library",
        sourceId: plan.id,
        createdAt: serverTimestamp(),
      }, { merge: true });

      logActivity("library.plan.optIn", { planId: plan.id, type: plan.type });
      toast.success(`Added "${plan.title}" to your plans`);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Could not add plan");
    }
  }

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto px-4 pt-20 pb-16 space-y-6">
        <header className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center">
            <LibraryIcon className="text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-heading font-bold">Library</h1>
            <p className="text-sm text-muted-foreground">Coach-curated plans you can add to your account.</p>
          </div>
        </header>

        <div className="flex gap-2">
          {([
            { v: "workouts" as LibType,  label: "Workouts",   icon: Dumbbell },
            { v: "mealPlans" as LibType, label: "Meal Plans", icon: UtensilsCrossed },
          ]).map(t => (
            <button key={t.v} onClick={() => setTab(t.v)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                tab === t.v ? "gradient-bg text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}>
              <t.icon size={14} /> {t.label}
            </button>
          ))}
        </div>

        {plans.length === 0 ? (
          <div className="glass-card p-12 text-center text-muted-foreground text-sm">
            Nothing published yet. Check back soon.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {plans.map(p => {
              const accepted = optedIn.has(p.id);
              return (
                <motion.div key={p.id} layout
                  className="glass-card p-5 flex flex-col gap-3 hover:border-primary/30 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold leading-snug">{p.title}</h3>
                      {p.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-3">{p.description}</p>}
                    </div>
                    <span className="text-[10px] px-2 py-1 rounded-full bg-primary/10 text-primary font-bold uppercase">
                      {p.type === "workouts" ? "Workout" : "Meal"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between mt-auto">
                    <span className="text-xs text-muted-foreground">{p.days?.length || 0} day{(p.days?.length || 0) === 1 ? "" : "s"}</span>
                    {accepted ? (
                      <span className="flex items-center gap-1 text-xs font-bold text-green-400">
                        <Check size={14} /> Added
                      </span>
                    ) : (
                      <button onClick={() => optIn(p)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl gradient-bg text-primary-foreground text-xs font-bold hover:opacity-90 transition">
                        <Plus size={13} /> Add to my plans
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
