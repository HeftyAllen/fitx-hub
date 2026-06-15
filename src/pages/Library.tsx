import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import {
  collection, doc, onSnapshot, query, orderBy, where,
  setDoc, serverTimestamp,
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
  exercises?: any[];
  meta?: any;
}

/** Embeddable section — can be dropped into other pages. */
export function LibrarySection({ defaultTab = "workouts", showTabs = true }: { defaultTab?: LibType; showTabs?: boolean }) {
  const { user } = useAuth();
  const [tab, setTab] = useState<LibType>(defaultTab);
  const [plans, setPlans] = useState<LibraryPlan[]>([]);
  const [optedIn, setOptedIn] = useState<Set<string>>(new Set());

  useEffect(() => {
    const q = query(
      collection(db, `library_${tab}`),
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
      await setDoc(doc(db, "users", user.uid, "libraryOptIns", plan.id), {
        planId: plan.id, type: plan.type, title: plan.title,
        acceptedAt: serverTimestamp(),
      });
      const targetCollection = plan.type === "workouts" ? "workoutPlans" : "mealPlans";
      await setDoc(doc(db, "users", user.uid, targetCollection, plan.id), {
        name: plan.title,
        title: plan.title,
        description: plan.description ?? null,
        days: plan.days ?? [],
        exercises: plan.exercises ?? [],
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
    <div className="space-y-5">
      {showTabs && (
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
      )}

      {plans.length === 0 ? (
        <div className="glass-card p-12 text-center text-muted-foreground text-sm">
          Nothing published yet. Your coach hasn't shared any plans — check back soon.
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
                  <span className="text-xs text-muted-foreground">
                    {p.type === "workouts"
                      ? `${p.exercises?.length || 0} exercise${(p.exercises?.length || 0) === 1 ? "" : "s"}`
                      : `${p.days?.length || 0} day${(p.days?.length || 0) === 1 ? "" : "s"}`}
                  </span>
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
  );
}

export default function Library() {
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
        <LibrarySection />
      </div>
    </AppLayout>
  );
}
