import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { motion } from "framer-motion";
import { Plus, ChevronDown, ChevronUp, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { searchIngredients } from "@/lib/api";

const MEALS = ["Breakfast", "Lunch", "Dinner", "Snacks"];

function MacroBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value}g / {max}g</span>
      </div>
      <div className="h-2 bg-secondary rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min((value / max) * 100, 100)}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

function MealSection({ meal }: { meal: string }) {
  const [open, setOpen] = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const [query, setQuery] = useState("");

  const { data } = useQuery({
    queryKey: ["ingredients", query],
    queryFn: () => searchIngredients(query),
    enabled: query.length > 2,
    staleTime: 30000,
  });

  return (
    <div className="glass-card overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <h3 className="font-heading font-bold text-sm">{meal}</h3>
          <span className="text-xs text-muted-foreground">0 cal</span>
        </div>
        {open ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3">
          <div className="text-center py-4 text-muted-foreground text-sm">No foods logged yet</div>
          {showSearch ? (
            <div className="space-y-2">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  placeholder="Search food..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  autoFocus
                />
              </div>
              {data?.results?.map((item: any) => (
                <button key={item.id} className="w-full text-left p-2 rounded-xl hover:bg-secondary transition-colors text-sm">
                  {item.name}
                </button>
              ))}
              <button onClick={() => setShowSearch(false)} className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
            </div>
          ) : (
            <button onClick={() => setShowSearch(true)} className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors">
              <Plus size={14} /> Add Food
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function Nutrition() {
  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
        <h1 className="text-2xl font-heading font-bold">Nutrition</h1>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-5 space-y-4"
        >
          <h3 className="text-sm font-heading font-bold uppercase tracking-wider text-muted-foreground">Daily Macros</h3>
          <div className="text-center">
            <span className="text-3xl font-heading font-bold">0</span>
            <span className="text-muted-foreground text-sm"> / 2,200 cal</span>
          </div>
          <div className="space-y-3">
            <MacroBar label="Protein" value={0} max={150} color="#2563EB" />
            <MacroBar label="Carbs" value={0} max={250} color="#FACC15" />
            <MacroBar label="Fats" value={0} max={70} color="#F97316" />
          </div>
        </motion.div>

        <div className="space-y-3">
          {MEALS.map((meal) => (
            <MealSection key={meal} meal={meal} />
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
