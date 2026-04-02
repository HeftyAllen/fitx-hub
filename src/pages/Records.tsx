import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { motion } from "framer-motion";
import { Trophy, Plus } from "lucide-react";

export default function Records() {
  const [tab, setTab] = useState<"prs" | "pbs">("prs");

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
        <h1 className="text-2xl font-heading font-bold">Personal Records</h1>

        <div className="flex gap-2">
          {(["prs", "pbs"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab === t ? "gradient-bg text-primary-foreground" : "bg-secondary text-muted-foreground"}`}
            >
              {t === "prs" ? "Gym PRs" : "Personal Bests"}
            </button>
          ))}
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5">
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Trophy size={32} className="mb-2" />
            <p className="text-sm">No {tab === "prs" ? "PRs" : "personal bests"} recorded yet</p>
            <button className="mt-3 flex items-center gap-2 text-sm text-primary hover:underline font-medium">
              <Plus size={14} /> Add {tab === "prs" ? "PR" : "PB"}
            </button>
          </div>
        </motion.div>
      </div>
    </AppLayout>
  );
}
