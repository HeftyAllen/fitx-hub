import AppLayout from "@/components/layout/AppLayout";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MEALS = ["Breakfast", "Lunch", "Dinner", "Snack"];

export default function MealPlanner() {
  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-heading font-bold">Meal Planner</h1>
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl gradient-bg text-primary-foreground text-sm font-medium hover:scale-[0.98] active:scale-[0.96] transition-transform">
            <Sparkles size={16} /> Generate Plan
          </button>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="overflow-x-auto">
          <div className="min-w-[700px] grid grid-cols-8 gap-2">
            <div />
            {DAYS.map((d) => (
              <div key={d} className="text-center text-sm font-heading font-bold text-muted-foreground py-2">{d}</div>
            ))}
            {MEALS.map((meal) => (
              <>
                <div key={meal} className="flex items-center text-xs font-medium text-muted-foreground">{meal}</div>
                {DAYS.map((day) => (
                  <button
                    key={`${meal}-${day}`}
                    className="glass-card p-3 min-h-[60px] flex items-center justify-center text-xs text-muted-foreground hover:bg-secondary/50 transition-colors rounded-xl"
                  >
                    + Add
                  </button>
                ))}
              </>
            ))}
          </div>
        </motion.div>
      </div>
    </AppLayout>
  );
}
