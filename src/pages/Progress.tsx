import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { motion } from "framer-motion";
import { Camera, Scale, TrendingUp } from "lucide-react";

export default function Progress() {
  const [weight, setWeight] = useState("");

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
        <h1 className="text-2xl font-heading font-bold">Progress</h1>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5 space-y-4">
          <h3 className="text-sm font-heading font-bold uppercase tracking-wider text-muted-foreground">Log Weight</h3>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Scale size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="number"
                placeholder="Weight"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="w-full pl-10 pr-12 py-3 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">kg</span>
            </div>
            <button className="px-6 py-3 rounded-xl gradient-bg text-primary-foreground text-sm font-medium hover:scale-[0.98] active:scale-[0.96] transition-transform">
              Log
            </button>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-5">
          <h3 className="text-sm font-heading font-bold uppercase tracking-wider text-muted-foreground mb-4">Weight History</h3>
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <TrendingUp size={32} className="mb-2" />
            <p className="text-sm">No weight data yet</p>
            <p className="text-xs">Start logging to see your progress chart</p>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card p-5">
          <h3 className="text-sm font-heading font-bold uppercase tracking-wider text-muted-foreground mb-4">Progress Photos</h3>
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Camera size={32} className="mb-2" />
            <p className="text-sm">No photos yet</p>
            <button className="mt-3 flex items-center gap-2 text-xs text-primary hover:underline font-medium">
              <Camera size={14} /> Upload Photo
            </button>
          </div>
        </motion.div>
      </div>
    </AppLayout>
  );
}
