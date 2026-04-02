import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { searchRecipes } from "@/lib/api";
import AppLayout from "@/components/layout/AppLayout";
import { motion } from "framer-motion";
import { Search, Clock, Flame, Bookmark } from "lucide-react";

const DIETS = ["", "vegetarian", "vegan", "ketogenic", "paleo", "gluten free"];

function RecipeCard({ recipe }: { recipe: any }) {
  const [saved, setSaved] = useState(false);
  const nutrition = recipe.nutrition?.nutrients || [];
  const cals = nutrition.find((n: any) => n.name === "Calories")?.amount || 0;
  const protein = nutrition.find((n: any) => n.name === "Protein")?.amount || 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card overflow-hidden group hover:scale-[1.02] transition-transform"
    >
      <div className="aspect-video bg-secondary overflow-hidden relative">
        <img src={recipe.image} alt={recipe.title} className="w-full h-full object-cover" loading="lazy" />
        <button
          onClick={() => setSaved(!saved)}
          className="absolute top-3 right-3 p-2 rounded-full bg-background/80 backdrop-blur-sm hover:scale-110 transition-transform"
        >
          <Bookmark size={14} className={saved ? "fill-primary text-primary" : "text-foreground"} />
        </button>
      </div>
      <div className="p-4 space-y-2">
        <h3 className="font-heading font-bold text-sm line-clamp-2">{recipe.title}</h3>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Clock size={12} /> {recipe.readyInMinutes}m</span>
          <span className="flex items-center gap-1"><Flame size={12} /> {Math.round(cals)} cal</span>
          <span className="flex items-center gap-1">💪 {Math.round(protein)}g</span>
        </div>
      </div>
    </motion.div>
  );
}

export default function Recipes() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("high protein");
  const [diet, setDiet] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["recipes", query, diet],
    queryFn: () => searchRecipes(query, { diet: diet || undefined }),
    staleTime: 60000,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) setQuery(search.trim());
  };

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
        <h1 className="text-2xl font-heading font-bold">Recipes</h1>

        <form onSubmit={handleSearch} className="relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder="Search recipes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 rounded-2xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all"
          />
        </form>

        <div className="flex gap-2 overflow-x-auto pb-2">
          {DIETS.map((d) => (
            <button
              key={d}
              onClick={() => setDiet(d)}
              className={`px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all ${diet === d ? "gradient-bg text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
            >
              {d || "All"}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="glass-card overflow-hidden">
                <div className="aspect-video bg-secondary shimmer" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-secondary rounded shimmer w-3/4" />
                  <div className="h-3 bg-secondary rounded shimmer w-1/2" />
                </div>
              </div>
            ))
            : (data?.results || []).map((r: any) => <RecipeCard key={r.id} recipe={r} />)
          }
        </div>
      </div>
    </AppLayout>
  );
}
