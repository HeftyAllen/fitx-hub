import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Check, X, Play, Pause, SkipForward, Plus, Minus, Trophy, Timer, Dumbbell, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { addDoc, collection, Timestamp } from "firebase/firestore";
import { toast } from "sonner";

interface SetLog {
  weight: number;
  reps: number;
  completed: boolean;
}

interface ExerciseLog {
  name: string;
  bodyPart: string;
  target: string;
  equipment: string;
  gifUrl?: string;
  plannedSets: number;
  plannedReps: number;
  restSeconds: number;
  sets: SetLog[];
}

export default function WorkoutSession() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const plan = location.state?.plan;

  const [exercises, setExercises] = useState<ExerciseLog[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isResting, setIsResting] = useState(false);
  const [restTime, setRestTime] = useState(0);
  const [restTotal, setRestTotal] = useState(0);
  const [completed, setCompleted] = useState(false);
  const timerRef = useRef<number | null>(null);
  const restRef = useRef<number | null>(null);

  useEffect(() => {
    if (!plan?.exercises?.length) {
      navigate("/workout-planner");
      return;
    }
    setExercises(
      plan.exercises.map((ex: any) => ({
        name: ex.name,
        bodyPart: ex.bodyPart,
        target: ex.target,
        equipment: ex.equipment,
        gifUrl: ex.gifUrl,
        plannedSets: ex.sets,
        plannedReps: ex.reps,
        restSeconds: ex.restSeconds || 60,
        sets: Array.from({ length: ex.sets }, () => ({ weight: 0, reps: ex.reps, completed: false })),
      }))
    );
  }, [plan]);

  // Elapsed timer
  useEffect(() => {
    if (completed || isPaused) return;
    timerRef.current = window.setInterval(() => setElapsedSeconds(s => s + 1), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [completed, isPaused]);

  // Rest countdown
  useEffect(() => {
    if (!isResting) return;
    if (restTime <= 0) { setIsResting(false); return; }
    restRef.current = window.setInterval(() => {
      setRestTime(t => {
        if (t <= 1) { setIsResting(false); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => { if (restRef.current) clearInterval(restRef.current); };
  }, [isResting, restTime]);

  const currentExercise = exercises[currentIdx];

  const logSet = (setIdx: number) => {
    setExercises(prev => {
      const copy = [...prev];
      copy[currentIdx] = {
        ...copy[currentIdx],
        sets: copy[currentIdx].sets.map((s, i) => i === setIdx ? { ...s, completed: true } : s),
      };
      return copy;
    });
    // Start rest timer
    const restSecs = currentExercise.restSeconds;
    if (restSecs > 0) {
      setRestTime(restSecs);
      setRestTotal(restSecs);
      setIsResting(true);
    }
    toast.success("Set logged! ✓", { duration: 1500 });
  };

  const updateSetField = (setIdx: number, field: "weight" | "reps", value: number) => {
    setExercises(prev => {
      const copy = [...prev];
      copy[currentIdx] = {
        ...copy[currentIdx],
        sets: copy[currentIdx].sets.map((s, i) => i === setIdx ? { ...s, [field]: value } : s),
      };
      return copy;
    });
  };

  const addExtraSet = () => {
    setExercises(prev => {
      const copy = [...prev];
      const lastSet = copy[currentIdx].sets[copy[currentIdx].sets.length - 1];
      copy[currentIdx] = {
        ...copy[currentIdx],
        sets: [...copy[currentIdx].sets, { weight: lastSet?.weight || 0, reps: lastSet?.reps || 10, completed: false }],
      };
      return copy;
    });
  };

  const removeLastSet = () => {
    setExercises(prev => {
      const copy = [...prev];
      if (copy[currentIdx].sets.length <= 1) return prev;
      copy[currentIdx] = {
        ...copy[currentIdx],
        sets: copy[currentIdx].sets.slice(0, -1),
      };
      return copy;
    });
  };

  const finishWorkout = async () => {
    setCompleted(true);
    if (!user) return;
    const totalVolume = exercises.reduce((sum, ex) =>
      sum + ex.sets.filter(s => s.completed).reduce((s, set) => s + set.weight * set.reps, 0), 0
    );
    try {
      await addDoc(collection(db, "users", user.uid, "workoutLogs"), {
        date: Timestamp.now(),
        planId: plan?.id || null,
        planName: plan?.name || "Quick Workout",
        exercises: exercises.map(ex => ({
          name: ex.name,
          bodyPart: ex.bodyPart,
          sets: ex.sets.filter(s => s.completed),
        })),
        duration: elapsedSeconds,
        totalVolume,
      });
    } catch (e) {
      console.error(e);
    }
  };

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const totalSetsCompleted = exercises.reduce((sum, ex) => sum + ex.sets.filter(s => s.completed).length, 0);
  const totalSets = exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
  const totalVolume = exercises.reduce((sum, ex) =>
    sum + ex.sets.filter(s => s.completed).reduce((s, set) => s + set.weight * set.reps, 0), 0
  );

  if (!plan?.exercises?.length) return null;

  if (completed) {
    return <CompletionScreen
      duration={elapsedSeconds}
      totalVolume={totalVolume}
      totalSets={totalSetsCompleted}
      exerciseCount={exercises.length}
      planName={plan?.name}
      formatTime={formatTime}
      onDone={() => navigate("/workout-planner")}
    />;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <div className="gradient-bg p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button size="icon" variant="ghost" className="text-primary-foreground/80 hover:text-primary-foreground h-8 w-8" onClick={() => navigate("/workout-planner")}>
            <X size={18} />
          </Button>
          <div>
            <h1 className="text-sm font-bold text-primary-foreground">{plan?.name || "Workout"}</h1>
            <p className="text-xs text-primary-foreground/70">{currentIdx + 1}/{exercises.length} exercises</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-lg font-mono font-bold text-primary-foreground">{formatTime(elapsedSeconds)}</p>
          </div>
          <Button size="icon" variant="ghost" className="text-primary-foreground/80 h-8 w-8" onClick={() => setIsPaused(!isPaused)}>
            {isPaused ? <Play size={16} /> : <Pause size={16} />}
          </Button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-secondary">
        <motion.div className="h-full gradient-bg" animate={{ width: `${(totalSetsCompleted / totalSets) * 100}%` }} />
      </div>

      {/* Rest Timer Overlay */}
      <AnimatePresence>
        {isResting && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md"
          >
            <div className="text-center">
              <p className="text-sm uppercase tracking-widest text-muted-foreground mb-4">Rest Time</p>
              <div className="relative w-40 h-40 mx-auto mb-6">
                <svg className="w-40 h-40 -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="45" fill="none" stroke="hsl(var(--secondary))" strokeWidth="4" />
                  <circle
                    cx="50" cy="50" r="45" fill="none"
                    stroke="url(#restGrad)" strokeWidth="4" strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 45}`}
                    strokeDashoffset={`${2 * Math.PI * 45 * (1 - restTime / restTotal)}`}
                    className="transition-all duration-1000"
                  />
                  <defs>
                    <linearGradient id="restGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#2563EB" />
                      <stop offset="100%" stopColor="#06B6D4" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-4xl font-mono font-bold text-foreground">{restTime}s</span>
                </div>
              </div>
              <div className="flex gap-3 justify-center">
                <Button variant="outline" onClick={() => setRestTime(t => t + 30)} className="rounded-xl border-white/10">+30s</Button>
                <Button onClick={() => { setIsResting(false); setRestTime(0); }} className="gradient-bg text-primary-foreground rounded-xl">Skip Rest</Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {currentExercise && (
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIdx}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="max-w-lg mx-auto space-y-4"
            >
              {/* Exercise header */}
              <div className="text-center">
                {currentExercise.gifUrl && (
                  <div className="w-full max-w-xs mx-auto rounded-2xl overflow-hidden mb-4 border border-white/[0.08]">
                    <img src={currentExercise.gifUrl} alt={currentExercise.name} className="w-full" />
                  </div>
                )}
                <h2 className="text-xl font-heading font-bold capitalize">{currentExercise.name}</h2>
                <div className="flex items-center justify-center gap-2 mt-1">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary capitalize">{currentExercise.target}</span>
                  <span className="text-xs text-muted-foreground capitalize">{currentExercise.equipment}</span>
                </div>
              </div>

              {/* Sets */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                  <span>SET</span>
                  <div className="flex gap-8">
                    <span className="w-16 text-center">WEIGHT</span>
                    <span className="w-16 text-center">REPS</span>
                    <span className="w-12"></span>
                  </div>
                </div>
                {currentExercise.sets.map((set, setIdx) => (
                  <motion.div
                    key={setIdx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: setIdx * 0.05 }}
                    className={`glass-card p-3 rounded-xl flex items-center justify-between transition-all ${set.completed ? "border-green-500/30 bg-green-500/5" : ""}`}
                  >
                    <span className={`text-sm font-bold w-6 ${set.completed ? "text-green-400" : "text-muted-foreground"}`}>{setIdx + 1}</span>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1">
                        <button onClick={() => updateSetField(setIdx, "weight", Math.max(0, set.weight - 2.5))} className="text-muted-foreground hover:text-foreground p-1"><Minus size={12} /></button>
                        <input
                          type="number"
                          value={set.weight}
                          onChange={e => updateSetField(setIdx, "weight", parseFloat(e.target.value) || 0)}
                          className="w-16 bg-secondary/80 rounded-lg px-2 py-1.5 text-center text-sm text-foreground border border-white/10"
                          disabled={set.completed}
                        />
                        <button onClick={() => updateSetField(setIdx, "weight", set.weight + 2.5)} className="text-muted-foreground hover:text-foreground p-1"><Plus size={12} /></button>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => updateSetField(setIdx, "reps", Math.max(1, set.reps - 1))} className="text-muted-foreground hover:text-foreground p-1"><Minus size={12} /></button>
                        <input
                          type="number"
                          value={set.reps}
                          onChange={e => updateSetField(setIdx, "reps", parseInt(e.target.value) || 1)}
                          className="w-16 bg-secondary/80 rounded-lg px-2 py-1.5 text-center text-sm text-foreground border border-white/10"
                          disabled={set.completed}
                        />
                        <button onClick={() => updateSetField(setIdx, "reps", set.reps + 1)} className="text-muted-foreground hover:text-foreground p-1"><Plus size={12} /></button>
                      </div>
                      {set.completed ? (
                        <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                          <Check size={18} className="text-green-400" />
                        </div>
                      ) : (
                        <Button
                          size="icon"
                          onClick={() => logSet(setIdx)}
                          className="w-10 h-10 gradient-bg text-primary-foreground rounded-xl hover:scale-[0.95] active:scale-[0.9] transition-transform"
                        >
                          <Check size={18} />
                        </Button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Add/Remove set */}
              <div className="flex gap-2 justify-center">
                <Button variant="outline" size="sm" onClick={addExtraSet} className="rounded-xl border-white/10 text-xs gap-1">
                  <Plus size={14} /> Add Set
                </Button>
                {currentExercise.sets.length > 1 && (
                  <Button variant="outline" size="sm" onClick={removeLastSet} className="rounded-xl border-white/10 text-xs gap-1">
                    <Minus size={14} /> Remove Set
                  </Button>
                )}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2">
                <div className="glass-card p-3 rounded-xl text-center">
                  <Dumbbell size={14} className="mx-auto mb-1 text-primary" />
                  <p className="text-lg font-bold">{totalSetsCompleted}/{totalSets}</p>
                  <p className="text-xs text-muted-foreground">Sets</p>
                </div>
                <div className="glass-card p-3 rounded-xl text-center">
                  <Flame size={14} className="mx-auto mb-1 text-accent" />
                  <p className="text-lg font-bold">{totalVolume.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Volume</p>
                </div>
                <div className="glass-card p-3 rounded-xl text-center">
                  <Timer size={14} className="mx-auto mb-1 text-warning" />
                  <p className="text-lg font-bold">{Math.floor(elapsedSeconds / 60)}</p>
                  <p className="text-xs text-muted-foreground">Minutes</p>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {/* Bottom nav */}
      <div className="border-t border-white/[0.08] p-4 flex items-center justify-between bg-card/80 backdrop-blur-xl">
        <Button
          variant="outline"
          onClick={() => setCurrentIdx(i => Math.max(0, i - 1))}
          disabled={currentIdx === 0}
          className="rounded-xl border-white/10 gap-1"
        >
          <ChevronLeft size={16} /> Previous
        </Button>
        {currentIdx === exercises.length - 1 ? (
          <Button onClick={finishWorkout} className="gradient-bg text-primary-foreground rounded-xl gap-2 glow-pulse">
            <Trophy size={16} /> Finish Workout
          </Button>
        ) : (
          <Button
            onClick={() => setCurrentIdx(i => Math.min(exercises.length - 1, i + 1))}
            className="gradient-bg text-primary-foreground rounded-xl gap-1"
          >
            Next <ChevronRight size={16} />
          </Button>
        )}
      </div>
    </div>
  );
}

/* ============ COMPLETION SCREEN ============ */

function CompletionScreen({
  duration,
  totalVolume,
  totalSets,
  exerciseCount,
  planName,
  formatTime,
  onDone,
}: {
  duration: number;
  totalVolume: number;
  totalSets: number;
  exerciseCount: number;
  planName: string;
  formatTime: (s: number) => string;
  onDone: () => void;
}) {
  const [confettiPieces, setConfettiPieces] = useState<{ id: number; x: number; color: string; delay: number; size: number }[]>([]);

  useEffect(() => {
    const pieces = Array.from({ length: 60 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      color: ["#2563EB", "#06B6D4", "#84CC16", "#FACC15", "#F43F5E", "#8B5CF6"][Math.floor(Math.random() * 6)],
      delay: Math.random() * 0.5,
      size: Math.random() * 8 + 4,
    }));
    setConfettiPieces(pieces);
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Confetti */}
      {confettiPieces.map(p => (
        <motion.div
          key={p.id}
          initial={{ y: -20, x: `${p.x}vw`, opacity: 1, rotate: 0 }}
          animate={{ y: "110vh", opacity: 0, rotate: 720 }}
          transition={{ duration: 2.5 + Math.random(), delay: p.delay, ease: "easeIn" }}
          className="absolute top-0 pointer-events-none"
          style={{ left: `${p.x}%`, width: p.size, height: p.size, backgroundColor: p.color, borderRadius: Math.random() > 0.5 ? "50%" : "2px" }}
        />
      ))}

      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", damping: 15, delay: 0.3 }}
        className="glass-card p-8 rounded-3xl max-w-md w-full text-center relative z-10"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", damping: 10, delay: 0.5 }}
          className="w-20 h-20 rounded-full gradient-bg mx-auto mb-6 flex items-center justify-center"
        >
          <Trophy size={36} className="text-primary-foreground" />
        </motion.div>

        <h1 className="text-2xl font-heading font-bold mb-2">Workout Complete! 🎉</h1>
        <p className="text-muted-foreground text-sm mb-6">{planName}</p>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="glass-card p-4 rounded-xl">
            <Timer size={18} className="mx-auto mb-2 text-primary" />
            <p className="text-xl font-bold">{formatTime(duration)}</p>
            <p className="text-xs text-muted-foreground">Duration</p>
          </div>
          <div className="glass-card p-4 rounded-xl">
            <Dumbbell size={18} className="mx-auto mb-2 text-accent" />
            <p className="text-xl font-bold">{totalVolume.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Volume (kg)</p>
          </div>
          <div className="glass-card p-4 rounded-xl">
            <Check size={18} className="mx-auto mb-2 text-green-400" />
            <p className="text-xl font-bold">{totalSets}</p>
            <p className="text-xs text-muted-foreground">Sets Done</p>
          </div>
          <div className="glass-card p-4 rounded-xl">
            <Flame size={18} className="mx-auto mb-2 text-warning" />
            <p className="text-xl font-bold">{exerciseCount}</p>
            <p className="text-xs text-muted-foreground">Exercises</p>
          </div>
        </div>

        <Button onClick={onDone} className="w-full gradient-bg text-primary-foreground rounded-xl text-base py-3 glow-pulse">
          Done
        </Button>
      </motion.div>
    </div>
  );
}
