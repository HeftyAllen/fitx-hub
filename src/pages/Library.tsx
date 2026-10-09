import { useEffect, useState } from "react";
import FeatureGate, { FeatureNotice } from "@/components/member/FeatureGate";
import { useFeatureAccess } from "@/contexts/FeatureAccessContext";
import AppLayout from "@/components/layout/AppLayout";
import MemberPageHeader from "@/components/member/MemberPageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import {
  collection, doc, onSnapshot, query, orderBy, where,
  setDoc, serverTimestamp, writeBatch,
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
  const { getAccess } = useFeatureAccess();
  const [tab, setTab] = useState<LibType>(defaultTab);
  const [plans, setPlans] = useState<LibraryPlan[]>([]);
  const [optedIn, setOptedIn] = useState<Set<string>>(new Set());

  const feature = tab === "workouts" ? "training" : "mealPlanner";
  const access = getAccess(feature);
  const libraryAccess = getAccess("library");
  const allowed = access.state === "allowed" && !access.loading && !access.error && libraryAccess.state === "allowed" && !libraryAccess.loading && !libraryAccess.error;
  useEffect(() => {
    setPlans([]);
    if (!allowed) return;
    const q = query(
      collection(db, `library_${tab}`),
      where("status", "==", "published"),
      orderBy("createdAt", "desc"),
    );
    const unsub = onSnapshot(q, (snap) => {
      setPlans(snap.docs.map(d => ({ id: d.id, type: tab, ...(d.data() as any) })));
    }, () => setPlans([]));
    return unsub;
  }, [tab, allowed]);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(
      collection(db, "users", user.uid, "libraryOptIns"),
      (snap) => setOptedIn(new Set(snap.docs.map(d => d.id))),
    );
    return unsub;
  }, [user]);

  async function optIn(plan: LibraryPlan) {
    if (!user || !allowed) { toast.error("This plan requires an active feature membership."); return; }
    try {
      const batch = writeBatch(db);
      batch.set(doc(db, "users", user.uid, "libraryOptIns", plan.id), {
        planId: plan.id, type: plan.type, title: plan.title,
        acceptedAt: serverTimestamp(),
      });
      const targetCollection = plan.type === "workouts" ? "workoutPlans" : "mealPlans";
      batch.set(doc(db, "users", user.uid, targetCollection, plan.id), {
        name: plan.title,
        title: plan.title,
        description: plan.description ?? null,
        days: plan.days ?? [],
        exercises: plan.exercises ?? [],
        source: "library",
        sourceId: plan.id,
        createdAt: serverTimestamp(),
      }, { merge: true });
      await batch.commit();
      logActivity("library.plan.optIn", { planId: plan.id, type: plan.type });
      toast.success(`Added "${plan.title}" to your plans`);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Could not add plan");
    }
  }

  return (
    <FeatureGate feature="library" inline><div className="space-y-5">
      {showTabs && (
        <div className="flex gap-2">
          {([
            { v: "workouts" as LibType,  label: "Workouts",   icon: Dumbbell },
            { v: "mealPlans" as LibType, label: "Meal Plans", icon: UtensilsCrossed },
          ]).filter(t => getAccess(t.v === "workouts" ? "training" : "mealPlanner").state !== "disabled").map(t => (
            <button key={t.v} onClick={() => setTab(t.v)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                tab === t.v ? "gradient-bg text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}>
              <t.icon size={14} /> {t.label}
            </button>
          ))}
        </div>
      )}

      {!allowed ? <FeatureNotice feature={feature} /> : plans.length === 0 ? (
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
    </div></FeatureGate>
  );
}

export default function Library() {
  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 pb-16 space-y-6">
        <MemberPageHeader eyebrow="A little expert inspiration" title="Your coach library" description="Workout and meal plans created by coaches. Find a routine and add it to your own account." />

        <LibrarySection />
      </div>
    </AppLayout>
  );
}
