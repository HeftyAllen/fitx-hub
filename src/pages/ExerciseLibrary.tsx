import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { searchExercises, getExercisesByBodyPart } from "@/lib/api";
import AppLayout from "@/components/layout/AppLayout";
import { motion } from "framer-motion";
import { Search, Heart } from "lucide-react";

const BODY_PARTS = ["back", "cardio", "chest", "lower arms", "lower legs", "neck", "shoulders", "upper arms", "upper legs", "waist"];

function ExerciseCard({ exercise }: { exercise: any }) {
  const [liked, setLiked] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card overflow-hidden group hover:scale-[1.02] transition-transform"
    >
      <div className="aspect-square bg-secondary overflow-hidden">
        <img src={exercise.gifUrl} alt={exercise.name} className="w-full h-full object-cover" loading="lazy" />
      </div>
      <div className="p-4 space-y-2">
        <h3 className="font-heading font-bold text-sm uppercase truncate">{exercise.name}</h3>
        <div className="flex flex-wrap gap-1.5">
          <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-xs">{exercise.target}</span>
          <span className="px-2 py-0.5 rounded-full bg-accent/20 text-accent text-xs">{exercise.equipment}</span>
        </div>
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-muted-foreground capitalize">{exercise.bodyPart}</span>
          <button onClick={() => setLiked(!liked)} className="p-1 hover:scale-110 transition-transform">
            <Heart size={16} className={liked ? "fill-destructive text-destructive" : "text-muted-foreground"} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function SkeletonCard() {
  return (
    <div className="glass-card overflow-hidden">
      <div className="aspect-square bg-secondary shimmer" />
      <div className="p-4 space-y-2">
        <div className="h-4 bg-secondary rounded shimmer w-3/4" />
        <div className="h-3 bg-secondary rounded shimmer w-1/2" />
      </div>
    </div>
  );
}

export default function ExerciseLibrary() {
  const [search, setSearch] = useState("");
  const [bodyPart, setBodyPart] = useState("");
  const [query, setQuery] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["exercises", query, bodyPart],
    queryFn: () => bodyPart ? getExercisesByBodyPart(bodyPart) : query ? searchExercises(query) : searchExercises("chest"),
    staleTime: 60000,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setBodyPart("");
    setQuery(search);
  };

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
        <h1 className="text-2xl font-heading font-bold">Exercise Library</h1>

        <form onSubmit={handleSearch} className="relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder="Search exercises..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 rounded-2xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all"
          />
        </form>

        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {BODY_PARTS.map((bp) => (
            <button
              key={bp}
              onClick={() => { setBodyPart(bp); setQuery(""); setSearch(""); }}
              className={`px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all ${bodyPart === bp ? "gradient-bg text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
            >
              {bp}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {isLoading
            ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
            : (data || []).map((ex: any) => <ExerciseCard key={ex.id} exercise={ex} />)
          }
        </div>

        {!isLoading && data?.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p>No exercises found. Try a different search term.</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
