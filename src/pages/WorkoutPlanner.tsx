import AppLayout from "@/components/layout/AppLayout";
import { motion } from "framer-motion";
import { Plus, Dumbbell } from "lucide-react";
import { Link } from "react-router-dom";

export default function WorkoutPlanner() {
  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-heading font-bold">Workout Planner</h1>
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl gradient-bg text-primary-foreground text-sm font-medium hover:scale-[0.98] active:scale-[0.96] transition-transform">
            <Plus size={16} /> New Plan
          </button>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-8">
          <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
            <Dumbbell size={40} className="mb-3" />
            <h3 className="font-heading font-bold text-lg mb-1">No Workout Plans Yet</h3>
            <p className="text-sm mb-4">Create your first workout plan to get started</p>
            <Link to="/exercise-library" className="text-sm text-primary hover:underline font-medium">
              Browse Exercise Library →
            </Link>
          </div>
        </motion.div>
      </div>
    </AppLayout>
  );
}
