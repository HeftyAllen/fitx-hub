import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ChevronLeft, ChevronRight, Check, X, Play, Pause, SkipForward,
  Plus, Minus, Trophy, Timer, Dumbbell, Flame, Info, Volume2,
  VolumeX, RotateCcw, Zap, Target, ChevronDown, ChevronUp,
  ListOrdered, Clock, Notebook
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { addDoc, collection, Timestamp } from "firebase/firestore";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";

interface SetLog {
  weight: number;
  reps: number;
  completed: boolean;
  note?: string;
}

interface ExerciseLog {
  name: string;
  bodyPart: string;
  target: string;
  equipment: string;
  gifUrl?: string;
  instructions?: string[];
  secondaryMuscles?: string[];
  plannedSets: number;
  plannedReps: number;
  restSeconds: number;
  sets: SetLog[];
}

const encouragements = [
  "Let's go! You got this! 💪",
  "Push through! No pain, no gain!",
  "Beast mode activated! 🔥",
  "One more rep! You're unstoppable!",
  "Crushing it! Keep that energy!",
  "You're stronger than you think!",
  "This is your moment! Own it!",
  "Champions don't quit! 🏆",
  "Feel the burn! That's growth!",
];

function speakText(text: string) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.05;
  utterance.pitch = 1.1;
  utterance.volume = 0.9;
  window.speechSynthesis.speak(utterance);
}

// ============ EXERCISE DETAIL MODAL ============
function ExerciseDetailModal({ exercise, open, onClose }: { exercise: ExerciseLog | null; open: boolean; onClose: () => void }) {
  if (!exercise) return null;
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="glass-card border-white/10 max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="capitalize text-lg">{exercise.name}</DialogTitle>
          <DialogDescription className="flex flex-wrap gap-2 mt-1">
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary capitalize">{exercise.target}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-accent/20 text-accent capitalize">{exercise.bodyPart}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground capitalize">{exercise.equipment}</span>
          </DialogDescription>
        </DialogHeader>
        {exercise.gifUrl && (
          <div className="rounded-xl overflow-hidden border border-white/10 bg-secondary/50">
            <img src={exercise.gifUrl} alt={exercise.name} className="w-full" />
          </div>
        )}
        {exercise.secondaryMuscles && exercise.secondaryMuscles.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-2 text-muted-foreground">Secondary Muscles</h4>
            <div className="flex flex-wrap gap-1.5">
              {exercise.secondaryMuscles.map((m, i) => (
                <span key={i} className="text-xs px-2 py-1 rounded-lg bg-warning/10 text-warning capitalize">{m}</span>
              ))}
            </div>
          </div>
        )}
        {exercise.instructions && exercise.instructions.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-2 text-muted-foreground">Instructions</h4>
            <ol className="space-y-2">
              {exercise.instructions.map((step, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full gradient-bg text-primary-foreground flex items-center justify-center text-xs font-bold">{i + 1}</span>
                  <span className="text-foreground/80 leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
        <div className="grid grid-cols-3 gap-2 mt-2">
          <div className="glass-card p-3 rounded-xl text-center">
            <p className="text-lg font-bold text-primary">{exercise.plannedSets}</p>
            <p className="text-xs text-muted-foreground">Sets</p>
          </div>
          <div className="glass-card p-3 rounded-xl text-center">
            <p className="text-lg font-bold text-accent">{exercise.plannedReps}</p>
            <p className="text-xs text-muted-foreground">Reps</p>
          </div>
          <div className="glass-card p-3 rounded-xl text-center">
            <p className="text-lg font-bold text-warning">{exercise.restSeconds}s</p>
            <p className="text-xs text-muted-foreground">Rest</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============ PARTICLE BURST EFFECT ============
function ParticleBurst({ trigger }: { trigger: number }) {
  const [particles, setParticles] = useState<{ id: number; x: number; y: number; color: string }[]>([]);
  useEffect(() => {
    if (trigger === 0) return;
    const newParticles = Array.from({ length: 12 }, (_, i) => ({
      id: Date.now() + i,
      x: (Math.random() - 0.5) * 200,
      y: (Math.random() - 0.5) * 200,
      color: ["#2563EB", "#06B6D4", "#84CC16", "#FACC15"][Math.floor(Math.random() * 4)],
    }));
    setParticles(newParticles);
    const timeout = setTimeout(() => setParticles([]), 800);
    return () => clearTimeout(timeout);
  }, [trigger]);
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {particles.map(p => (
        <motion.div key={p.id}
          initial={{ x: "50%", y: "50%", scale: 1, opacity: 1 }}
          animate={{ x: `calc(50% + ${p.x}px)`, y: `calc(50% + ${p.y}px)`, scale: 0, opacity: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="absolute w-2 h-2 rounded-full" style={{ backgroundColor: p.color }}
        />
      ))}
    </div>
  );
}

// ============ MAIN COMPONENT ============
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
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [detailExercise, setDetailExercise] = useState<ExerciseLog | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [particleTrigger, setParticleTrigger] = useState(0);
  const [showWeight, setShowWeight] = useState(false);
  const [setNotes, setSetNotes] = useState<Record<string, string>>({});

  const timerRef = useRef<number | null>(null);
  const restRef = useRef<number | null>(null);

  useEffect(() => {
    if (!plan?.exercises?.length) { navigate("/workout-planner"); return; }
    setExercises(
      plan.exercises.map((ex: any) => ({
        name: ex.name,
        bodyPart: ex.bodyPart || "unknown",
        target: ex.target || "general",
        equipment: ex.equipment || "bodyweight",
        gifUrl: ex.gifUrl,
        instructions: ex.instructions || [],
        secondaryMuscles: ex.secondaryMuscles || [],
        plannedSets: ex.sets || 3,
        plannedReps: ex.reps || 10,
        restSeconds: ex.restSeconds || 60,
        sets: Array.from({ length: ex.sets || 3 }, () => ({
          weight: 0, reps: ex.reps || 10, completed: false,
        })),
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
    if (restTime <= 0) { setIsResting(false); if (voiceEnabled) speakText("Rest over. Let's go!"); return; }
    restRef.current = window.setInterval(() => {
      setRestTime(t => {
        if (t <= 4 && t > 1 && voiceEnabled) speakText(String(t - 1));
        if (t <= 1) { setIsResting(false); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => { if (restRef.current) clearInterval(restRef.current); };
  }, [isResting, restTime, voiceEnabled]);

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
    setParticleTrigger(p => p + 1);
    if (voiceEnabled) {
      const msg = encouragements[Math.floor(Math.random() * encouragements.length)];
      speakText(msg);
    }
    const restSecs = currentExercise.restSeconds;
    if (restSecs > 0) { setRestTime(restSecs); setRestTotal(restSecs); setIsResting(true); }
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
      copy[currentIdx] = { ...copy[currentIdx], sets: copy[currentIdx].sets.slice(0, -1) };
      return copy;
    });
  };

  const finishWorkout = async () => {
    setCompleted(true);
    if (voiceEnabled) speakText("Workout complete! Amazing work champion!");
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
          name: ex.name, bodyPart: ex.bodyPart,
          sets: ex.sets.filter(s => s.completed),
        })),
        duration: elapsedSeconds,
        totalVolume,
        notes: setNotes,
      });
    } catch (e) { console.error(e); }
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
  const calorieEstimate = Math.round(elapsedSeconds / 60 * 7.5);
  const progressPercent = totalSets > 0 ? (totalSetsCompleted / totalSets) * 100 : 0;

  if (!plan?.exercises?.length) return null;

  if (completed) {
    return (
      <CompletionScreen
        duration={elapsedSeconds} totalVolume={totalVolume} totalSets={totalSetsCompleted}
        exerciseCount={exercises.length} planName={plan?.name} calories={calorieEstimate}
        formatTime={formatTime} onDone={() => navigate("/workout-planner")}
        notes={setNotes}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col relative">
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-[0.04]" style={{ background: "radial-gradient(circle, #2563EB, transparent 70%)" }} />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full opacity-[0.04]" style={{ background: "radial-gradient(circle, #06B6D4, transparent 70%)" }} />
      </div>

      {/* Top bar */}
      <div className="relative z-10 gradient-bg px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button size="icon" variant="ghost" className="text-primary-foreground/80 hover:text-primary-foreground h-8 w-8" onClick={() => navigate("/workout-planner")}>
              <X size={18} />
            </Button>
            <div>
              <h1 className="text-sm font-bold text-primary-foreground">{plan?.name || "Workout"}</h1>
              <p className="text-xs text-primary-foreground/70">{currentIdx + 1}/{exercises.length} exercises</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-lg font-mono font-bold text-primary-foreground">{formatTime(elapsedSeconds)}</p>
            <Button size="icon" variant="ghost" className="text-primary-foreground/80 h-8 w-8" onClick={() => setIsPaused(!isPaused)}>
              {isPaused ? <Play size={16} /> : <Pause size={16} />}
            </Button>
            <Button size="icon" variant="ghost" className="text-primary-foreground/80 h-8 w-8" onClick={() => { setElapsedSeconds(0); toast.info("Timer reset"); }}>
              <RotateCcw size={14} />
            </Button>
            <Button size="icon" variant="ghost"
              className={`h-8 w-8 ${voiceEnabled ? "text-primary-foreground" : "text-primary-foreground/40"}`}
              onClick={() => { setVoiceEnabled(!voiceEnabled); toast.info(voiceEnabled ? "Voice coach off" : "Voice coach on 🎙️"); }}>
              {voiceEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
            </Button>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-secondary relative z-10">
        <motion.div className="h-full gradient-bg" animate={{ width: `${progressPercent}%` }} transition={{ type: "spring", stiffness: 100 }} />
      </div>

      {/* Rest Timer Overlay */}
      <AnimatePresence>
        {isResting && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-lg">
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }} className="text-center">
              <motion.div animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.1, 0.3] }} transition={{ duration: 2, repeat: Infinity }}
                className="absolute inset-0 m-auto w-56 h-56 rounded-full" style={{ background: "radial-gradient(circle, rgba(37,99,235,0.3), transparent 70%)" }} />
              <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground mb-6 font-semibold">Rest Time</p>
              <div className="relative w-48 h-48 mx-auto mb-8">
                <svg className="w-48 h-48 -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="45" fill="none" stroke="hsl(var(--secondary))" strokeWidth="3" />
                  <circle cx="50" cy="50" r="45" fill="none" stroke="url(#restGrad2)" strokeWidth="4" strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 45}`}
                    strokeDashoffset={`${2 * Math.PI * 45 * (1 - (restTotal > 0 ? restTime / restTotal : 0))}`}
                    className="transition-all duration-1000" />
                  <defs><linearGradient id="restGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#2563EB" /><stop offset="100%" stopColor="#06B6D4" />
                  </linearGradient></defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <motion.span key={restTime} initial={{ scale: 1.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                    className="text-5xl font-mono font-bold text-foreground">{restTime}</motion.span>
                  <span className="text-xs text-muted-foreground mt-1">seconds</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-6">
                Next: <span className="text-foreground font-medium capitalize">
                  {currentIdx < exercises.length - 1 ? exercises[currentIdx + 1]?.name : "Finish! 🏁"}
                </span>
              </p>
              <div className="flex gap-3 justify-center">
                <Button variant="outline" onClick={() => setRestTime(t => t + 15)} className="rounded-xl border-white/10 text-sm">+15s</Button>
                <Button variant="outline" onClick={() => setRestTime(t => t + 30)} className="rounded-xl border-white/10 text-sm">+30s</Button>
                <Button onClick={() => { setIsResting(false); setRestTime(0); }} className="gradient-bg text-primary-foreground rounded-xl px-6 text-sm">
                  <SkipForward size={14} className="mr-1" /> Skip
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pause Overlay */}
      <AnimatePresence>
        {isPaused && !isResting && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="text-center">
              <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 2, repeat: Infinity }}
                className="w-24 h-24 rounded-full border-2 border-primary/50 flex items-center justify-center mx-auto mb-6">
                <Pause size={40} className="text-primary" />
              </motion.div>
              <h2 className="text-2xl font-heading font-bold mb-2">Workout Paused</h2>
              <p className="text-muted-foreground mb-6">{formatTime(elapsedSeconds)} elapsed</p>
              <Button onClick={() => setIsPaused(false)} className="gradient-bg text-primary-foreground rounded-xl px-8 glow-pulse">
                <Play size={16} className="mr-2" /> Resume
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content - DESKTOP: side-by-side layout */}
      <div className="flex-1 overflow-y-auto relative z-10">
        {currentExercise && (
          <AnimatePresence mode="wait">
            <motion.div key={currentIdx}
              initial={{ opacity: 0, x: 60 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -60 }}
              transition={{ type: "spring", damping: 20 }}
              className="max-w-6xl mx-auto p-4 md:p-6">

              {/* Desktop: 2-column layout */}
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-5">

                {/* LEFT: Exercise visual + queue */}
                <div className="space-y-4">
                  {/* Exercise card with GIF */}
                  <div className="glass-card rounded-2xl overflow-hidden relative">
                    <ParticleBurst trigger={particleTrigger} />
                    {currentExercise.gifUrl && (
                      <div className="relative">
                        <img src={currentExercise.gifUrl} alt={currentExercise.name} className="w-full aspect-[4/3] object-contain bg-secondary/30" />
                        <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
                      </div>
                    )}
                    <div className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h2 className="text-lg font-heading font-bold capitalize">{currentExercise.name}</h2>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary capitalize">{currentExercise.target}</span>
                            <span className="text-xs text-muted-foreground capitalize">{currentExercise.equipment}</span>
                          </div>
                        </div>
                        <Button size="icon" variant="ghost" className="h-9 w-9 rounded-xl hover:bg-primary/10"
                          onClick={() => { setDetailExercise(currentExercise); setShowDetail(true); }}>
                          <Info size={18} className="text-primary" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Exercise Queue - desktop sidebar list */}
                  <div className="glass-card rounded-2xl p-3 space-y-1 hidden lg:block">
                    <p className="text-xs font-heading font-bold uppercase tracking-wider text-muted-foreground px-2 mb-2 flex items-center gap-2">
                      <ListOrdered size={14} className="text-primary" /> Exercise Queue
                    </p>
                    <div className="space-y-1 max-h-[300px] overflow-y-auto">
                      {exercises.map((ex, idx) => {
                        const done = ex.sets.filter(s => s.completed).length;
                        const allDone = done === ex.sets.length;
                        return (
                          <button key={idx} onClick={() => setCurrentIdx(idx)}
                            className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center gap-3 transition-all text-sm ${
                              idx === currentIdx ? "bg-primary/20 border border-primary/30"
                              : allDone ? "bg-success/10 border border-success/20"
                              : "hover:bg-white/5 border border-transparent"
                            }`}>
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                              allDone ? "bg-success/20 text-success" : idx === currentIdx ? "gradient-bg text-primary-foreground" : "bg-secondary text-muted-foreground"
                            }`}>{allDone ? <Check size={14} /> : idx + 1}</div>
                            <div className="flex-1 min-w-0">
                              <p className={`capitalize truncate ${idx === currentIdx ? "text-primary font-semibold" : ""}`}>{ex.name}</p>
                              <p className="text-xs text-muted-foreground">{done}/{ex.sets.length} sets</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Stats row - desktop only */}
                  <div className="hidden lg:grid grid-cols-3 gap-2">
                    {[
                      { icon: Target, label: "Sets", value: `${totalSetsCompleted}/${totalSets}`, color: "text-primary" },
                      { icon: Zap, label: "Calories", value: `~${calorieEstimate}`, color: "text-warning" },
                      { icon: Timer, label: "Time", value: `${Math.floor(elapsedSeconds / 60)}m`, color: "text-success" },
                    ].map((stat, i) => (
                      <div key={i} className="glass-card p-3 rounded-xl text-center">
                        <stat.icon size={14} className={`mx-auto mb-1 ${stat.color}`} />
                        <p className="text-sm font-bold">{stat.value}</p>
                        <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* RIGHT: Set logging */}
                <div className="space-y-4">
                  {/* Mobile-only queue toggle */}
                  <div className="lg:hidden glass-card rounded-2xl overflow-hidden">
                    <details className="group">
                      <summary className="px-4 py-3 flex items-center justify-between text-sm font-semibold cursor-pointer hover:bg-white/5 transition-colors list-none">
                        <div className="flex items-center gap-2">
                          <ListOrdered size={16} className="text-primary" />
                          <span>Exercise Queue ({exercises.length})</span>
                        </div>
                        <ChevronDown size={16} className="group-open:rotate-180 transition-transform" />
                      </summary>
                      <div className="px-3 pb-3 space-y-1 max-h-48 overflow-y-auto">
                        {exercises.map((ex, idx) => {
                          const done = ex.sets.filter(s => s.completed).length;
                          const allDone = done === ex.sets.length;
                          return (
                            <button key={idx} onClick={() => setCurrentIdx(idx)}
                              className={`w-full text-left px-3 py-2 rounded-xl flex items-center gap-3 transition-all text-sm ${
                                idx === currentIdx ? "bg-primary/20 border border-primary/30"
                                : allDone ? "bg-success/10 border border-success/20"
                                : "hover:bg-white/5 border border-transparent"
                              }`}>
                              <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                                allDone ? "bg-success/20 text-success" : idx === currentIdx ? "gradient-bg text-primary-foreground" : "bg-secondary text-muted-foreground"
                              }`}>{allDone ? <Check size={12} /> : idx + 1}</div>
                              <p className={`capitalize truncate flex-1 ${idx === currentIdx ? "text-primary font-semibold" : ""}`}>{ex.name}</p>
                              <span className="text-xs text-muted-foreground">{done}/{ex.sets.length}</span>
                            </button>
                          );
                        })}
                      </div>
                    </details>
                  </div>

                  {/* Toggle weight tracking */}
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-heading font-bold uppercase tracking-wider text-muted-foreground">
                      Log Your Sets
                    </h3>
                    <button onClick={() => setShowWeight(!showWeight)}
                      className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all ${showWeight ? "gradient-bg text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
                      <Dumbbell size={12} className="inline mr-1" /> {showWeight ? "Hide Weight" : "Track Weight"}
                    </button>
                  </div>

                  {/* Set headers */}
                  <div className="flex items-center text-xs text-muted-foreground px-3 gap-3">
                    <span className="w-10">SET</span>
                    <span className="flex-1 text-center">REPS</span>
                    {showWeight && <span className="w-28 text-center">WEIGHT</span>}
                    <span className="w-12"></span>
                  </div>

                  {/* Sets */}
                  <div className="space-y-2">
                    {currentExercise.sets.map((set, setIdx) => (
                      <motion.div key={setIdx}
                        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: setIdx * 0.05 }}
                        className={`glass-card p-3 rounded-xl flex items-center gap-3 transition-all ${
                          set.completed ? "border-success/30 bg-success/5 shadow-[0_0_15px_rgba(132,204,22,0.1)]" : ""
                        }`}>
                        <span className={`text-sm font-bold w-10 text-center ${set.completed ? "text-success" : "text-muted-foreground"}`}>
                          {set.completed ? <Check size={16} className="text-success mx-auto" /> : setIdx + 1}
                        </span>

                        {/* Reps */}
                        <div className="flex-1 flex items-center justify-center gap-1.5">
                          <button onClick={() => updateSetField(setIdx, "reps", Math.max(1, set.reps - 1))}
                            className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-white/5 transition-colors" disabled={set.completed}>
                            <Minus size={14} />
                          </button>
                          <input type="number" value={set.reps}
                            onChange={e => updateSetField(setIdx, "reps", parseInt(e.target.value) || 1)}
                            className="w-16 bg-secondary/80 rounded-xl px-2 py-2 text-center text-base font-bold text-foreground border border-white/10 focus:border-primary/50 focus:outline-none transition-colors"
                            disabled={set.completed} />
                          <button onClick={() => updateSetField(setIdx, "reps", set.reps + 1)}
                            className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-white/5 transition-colors" disabled={set.completed}>
                            <Plus size={14} />
                          </button>
                        </div>

                        {/* Optional weight */}
                        {showWeight && (
                          <div className="w-28 flex items-center justify-center gap-1">
                            <button onClick={() => updateSetField(setIdx, "weight", Math.max(0, set.weight - 2.5))}
                              className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-white/5" disabled={set.completed}>
                              <Minus size={12} />
                            </button>
                            <input type="number" value={set.weight}
                              onChange={e => updateSetField(setIdx, "weight", parseFloat(e.target.value) || 0)}
                              className="w-14 bg-secondary/80 rounded-lg px-1 py-1.5 text-center text-sm text-foreground border border-white/10 focus:border-primary/50 focus:outline-none"
                              disabled={set.completed} />
                            <button onClick={() => updateSetField(setIdx, "weight", set.weight + 2.5)}
                              className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-white/5" disabled={set.completed}>
                              <Plus size={12} />
                            </button>
                          </div>
                        )}

                        {/* Complete button */}
                        {set.completed ? (
                          <div className="w-12 h-12 rounded-xl bg-success/20 flex items-center justify-center">
                            <Check size={20} className="text-success" />
                          </div>
                        ) : (
                          <Button size="icon" onClick={() => logSet(setIdx)}
                            className="w-12 h-12 gradient-bg text-primary-foreground rounded-xl hover:scale-95 active:scale-90 transition-transform">
                            <Check size={20} />
                          </Button>
                        )}
                      </motion.div>
                    ))}
                  </div>

                  {/* Set actions */}
                  <div className="flex gap-2 flex-wrap">
                    <Button variant="outline" size="sm" onClick={addExtraSet} className="rounded-xl border-white/10 text-xs gap-1">
                      <Plus size={14} /> Add Set
                    </Button>
                    {currentExercise.sets.length > 1 && (
                      <Button variant="outline" size="sm" onClick={removeLastSet} className="rounded-xl border-white/10 text-xs gap-1">
                        <Minus size={14} /> Remove
                      </Button>
                    )}
                    <Button variant="outline" size="sm"
                      onClick={() => { setRestTime(currentExercise.restSeconds); setRestTotal(currentExercise.restSeconds); setIsResting(true); }}
                      className="rounded-xl border-white/10 text-xs gap-1">
                      <Clock size={14} /> Rest ({currentExercise.restSeconds}s)
                    </Button>
                  </div>

                  {/* Notes for this exercise */}
                  <div className="glass-card rounded-xl p-3">
                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-2">
                      <Notebook size={12} /> Session Notes
                    </label>
                    <textarea
                      value={setNotes[currentExercise.name] || ""}
                      onChange={e => setSetNotes(prev => ({ ...prev, [currentExercise.name]: e.target.value }))}
                      placeholder="How did this feel? PR? Form notes..."
                      className="w-full bg-secondary/50 rounded-xl px-3 py-2 text-sm text-foreground border border-white/10 focus:border-primary/50 focus:outline-none resize-none h-20 placeholder:text-muted-foreground/50"
                    />
                  </div>

                  {/* Mobile stats */}
                  <div className="lg:hidden grid grid-cols-3 gap-2">
                    {[
                      { icon: Target, label: "Sets", value: `${totalSetsCompleted}/${totalSets}`, color: "text-primary" },
                      { icon: Zap, label: "Calories", value: `~${calorieEstimate}`, color: "text-warning" },
                      { icon: Timer, label: "Time", value: `${Math.floor(elapsedSeconds / 60)}m`, color: "text-success" },
                    ].map((stat, i) => (
                      <div key={i} className="glass-card p-2.5 rounded-xl text-center">
                        <stat.icon size={14} className={`mx-auto mb-1 ${stat.color}`} />
                        <p className="text-sm font-bold">{stat.value}</p>
                        <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {/* Bottom nav */}
      <div className="relative z-10 border-t border-white/[0.08] p-4 bg-card/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Button variant="outline" onClick={() => setCurrentIdx(i => Math.max(0, i - 1))} disabled={currentIdx === 0}
            className="rounded-xl border-white/10 gap-1">
            <ChevronLeft size={16} /> Prev
          </Button>
          <div className="flex items-center gap-2">
            {exercises.map((_, idx) => (
              <button key={idx} onClick={() => setCurrentIdx(idx)}
                className={`w-2 h-2 rounded-full transition-all ${
                  idx === currentIdx ? "w-6 gradient-bg"
                  : exercises[idx].sets.every(s => s.completed) ? "bg-success" : "bg-secondary hover:bg-muted-foreground/30"
                }`} />
            ))}
          </div>
          {currentIdx === exercises.length - 1 ? (
            <Button onClick={finishWorkout} className="gradient-bg text-primary-foreground rounded-xl gap-2 glow-pulse">
              <Trophy size={16} /> Finish
            </Button>
          ) : (
            <Button onClick={() => setCurrentIdx(i => Math.min(exercises.length - 1, i + 1))}
              className="gradient-bg text-primary-foreground rounded-xl gap-1">
              Next <ChevronRight size={16} />
            </Button>
          )}
        </div>
      </div>

      <ExerciseDetailModal exercise={detailExercise} open={showDetail} onClose={() => setShowDetail(false)} />
    </div>
  );
}

// ============ COMPLETION SCREEN ============
function CompletionScreen({
  duration, totalVolume, totalSets, exerciseCount, planName, calories, formatTime, onDone, notes,
}: {
  duration: number; totalVolume: number; totalSets: number; exerciseCount: number;
  planName: string; calories: number; formatTime: (s: number) => string;
  onDone: () => void; notes: Record<string, string>;
}) {
  const [confettiPieces, setConfettiPieces] = useState<{ id: number; x: number; color: string; delay: number; size: number; shape: string }[]>([]);

  useEffect(() => {
    setConfettiPieces(Array.from({ length: 80 }, (_, i) => ({
      id: i, x: Math.random() * 100,
      color: ["#2563EB", "#06B6D4", "#84CC16", "#FACC15", "#F43F5E", "#8B5CF6", "#EC4899"][Math.floor(Math.random() * 7)],
      delay: Math.random() * 1, size: Math.random() * 10 + 4,
      shape: Math.random() > 0.5 ? "circle" : "rect",
    })));
  }, []);

  const noteEntries = Object.entries(notes).filter(([_, v]) => v.trim());

  const stats = [
    { icon: Timer, label: "Duration", value: formatTime(duration), color: "text-primary" },
    { icon: Check, label: "Sets Done", value: String(totalSets), color: "text-success" },
    { icon: Flame, label: "Exercises", value: String(exerciseCount), color: "text-warning" },
    { icon: Zap, label: "Calories", value: `~${calories}`, color: "text-destructive" },
  ];
  if (totalVolume > 0) stats.splice(1, 0, { icon: Dumbbell, label: "Volume", value: `${totalVolume.toLocaleString()} kg`, color: "text-accent" });

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {confettiPieces.map(p => (
        <motion.div key={p.id}
          initial={{ y: -20, opacity: 1, rotate: 0 }}
          animate={{ y: "110vh", opacity: 0, rotate: 720 + Math.random() * 360 }}
          transition={{ duration: 2.5 + Math.random() * 1.5, delay: p.delay, ease: "easeIn" }}
          className="absolute top-0 pointer-events-none"
          style={{ left: `${p.x}%`, width: p.size, height: p.shape === "circle" ? p.size : p.size * 0.4, backgroundColor: p.color, borderRadius: p.shape === "circle" ? "50%" : "2px" }}
        />
      ))}
      <motion.div animate={{ scale: [1, 1.3, 1], opacity: [0.1, 0.2, 0.1] }} transition={{ duration: 3, repeat: Infinity }}
        className="absolute w-[500px] h-[500px] rounded-full" style={{ background: "radial-gradient(circle, rgba(37,99,235,0.3), transparent 70%)" }} />

      <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", damping: 12, delay: 0.3 }}
        className="glass-card p-8 rounded-3xl max-w-md w-full text-center relative z-10">
        <motion.div initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", damping: 8, delay: 0.5 }}
          className="w-24 h-24 rounded-full gradient-bg mx-auto mb-6 flex items-center justify-center shadow-[0_0_40px_rgba(37,99,235,0.4)]">
          <Trophy size={40} className="text-primary-foreground" />
        </motion.div>
        <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}
          className="text-2xl font-heading font-bold mb-1">Workout Complete! 🎉</motion.h1>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
          className="text-muted-foreground text-sm mb-6">{planName}</motion.p>

        <div className={`grid ${stats.length > 4 ? "grid-cols-3" : "grid-cols-2"} gap-2.5 mb-6`}>
          {stats.map((stat, i) => (
            <motion.div key={i} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.9 + i * 0.1 }} className="glass-card p-3 rounded-xl">
              <stat.icon size={16} className={`mx-auto mb-1.5 ${stat.color}`} />
              <p className="text-lg font-bold">{stat.value}</p>
              <p className="text-[10px] text-muted-foreground">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        {noteEntries.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.3 }}
            className="text-left mb-6">
            <p className="text-xs font-heading font-bold uppercase tracking-wider text-muted-foreground mb-2">Session Notes</p>
            {noteEntries.map(([name, note], i) => (
              <div key={i} className="glass-card p-2.5 rounded-lg mb-1.5">
                <p className="text-xs font-medium capitalize text-primary">{name}</p>
                <p className="text-xs text-muted-foreground">{note}</p>
              </div>
            ))}
          </motion.div>
        )}

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.5 }}>
          <Button onClick={onDone} className="w-full gradient-bg text-primary-foreground rounded-xl text-base py-3 glow-pulse">
            Done 🏠
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
}
