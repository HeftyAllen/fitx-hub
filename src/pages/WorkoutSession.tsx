import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ChevronLeft, ChevronRight, Check, X, Play, Pause, SkipForward,
  Plus, Minus, Trophy, Timer, Dumbbell, Flame, Info, Volume2,
  VolumeX, RotateCcw, Zap, Target, ChevronDown,
  ListOrdered, Clock, Notebook, ArrowUpRight, ShieldCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { loadWorkoutDraft, saveWorkoutDraft, clearWorkoutDraft } from "@/lib/offline/drafts";
import { queueWorkout } from "@/lib/offline/queue";
import SyncStatus from "@/components/SyncStatus";
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
type PlannedExercise = Partial<Omit<ExerciseLog, "sets" | "plannedSets" | "plannedReps">> & { name: string; sets?: number; reps?: number };
interface WorkoutPlan { id?: string; name: string; exercises: PlannedExercise[] }

const encouragements = [
  "Let's go! You got this! 💪",
  "Good work. Take a breath and reset.",
  "Beast mode activated! 🔥",
  "One more rep! You're unstoppable!",
  "Crushing it! Keep that energy!",
  "You're stronger than you think!",
  "This is your moment! Own it!",
  "Another set in the books! 🏆",
  "Keep your form controlled. You've got this!",
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

function useSessionMotion() {
  const settings = useSiteSettings();
  const reduced = useReducedMotion();
  return { motionEnabled: settings.motion === "full" && !reduced, fadeDuration: settings.motion === "off" ? 0 : 0.2 };
}

// ============ EXERCISE DETAIL MODAL ============
function ExerciseDetailModal({ exercise, open, onClose }: { exercise: ExerciseLog | null; open: boolean; onClose: () => void }) {
  if (!exercise) return null;
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="member-shell max-w-md max-h-[85vh] overflow-y-auto">
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
        {!exercise.instructions?.length && <p className="text-sm text-muted-foreground">No detailed form guide is saved with this exercise. Follow the instructions provided in your training plan.</p>}
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
      color: ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--tone-mint))", "hsl(var(--tone-amber))"][Math.floor(Math.random() * 4)],
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
  const { motionEnabled, fadeDuration } = useSessionMotion();
  const [recovered] = useState(() => user ? loadWorkoutDraft(user.uid) : null);
  const plan = (location.state?.plan ?? recovered?.plan) as WorkoutPlan | undefined;
  const [sessionId] = useState(() => recovered && (!location.state?.plan || recovered.plan.id === location.state.plan.id) ? recovered.sessionId : crypto.randomUUID());

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
  const savedRef = useRef(false);
  const draftWarning = useRef(false);

  useEffect(() => {
    if (!plan?.exercises?.length) { navigate("/workout-planner"); return; }
    if (recovered?.sessionId === sessionId && recovered.exercises.length) {
      setExercises(recovered.exercises as ExerciseLog[]);
      setCurrentIdx(recovered.currentIdx);
      setElapsedSeconds(recovered.elapsedSeconds);
      setSetNotes(recovered.setNotes);
      toast.info("Your saved workout session was restored.");
      return;
    }
    setExercises(
      plan.exercises.map((ex) => ({
        name: ex.name,
        bodyPart: ex.bodyPart || "unknown",
        target: ex.target || "general",
        equipment: ex.equipment || "bodyweight",
        gifUrl: ex.gifUrl,
        instructions: ex.instructions || [],
        secondaryMuscles: ex.secondaryMuscles || [],
        plannedSets: ex.sets || 3,
        plannedReps: ex.reps || 10,
        restSeconds: ex.restSeconds ?? 60,
        sets: Array.from({ length: ex.sets || 3 }, () => ({
          weight: 0, reps: ex.reps || 10, completed: false,
        })),
      }))
    );
  }, [plan, navigate, recovered, sessionId]);

  useEffect(() => {
    if (!user || !plan || !exercises.length || completed || savedRef.current) return;
    try { saveWorkoutDraft(user.uid, { sessionId, plan, exercises, currentIdx, elapsedSeconds, setNotes, savedAt: Date.now() }); }
    catch { if (!draftWarning.current) { draftWarning.current = true; toast.error("Session recovery is unavailable because device storage is full or blocked."); } }
  }, [user, plan, exercises, currentIdx, elapsedSeconds, setNotes, sessionId, completed]);

  // Elapsed timer
  useEffect(() => {
    if (completed || isPaused) return;
    timerRef.current = window.setInterval(() => setElapsedSeconds(s => s + 1), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [completed, isPaused]);

  // Rest countdown
  useEffect(() => {
    if (!isResting || isPaused || completed) return;
    if (restTime <= 0) { setIsResting(false); if (voiceEnabled) speakText("Rest over. Let's go!"); return; }
    restRef.current = window.setInterval(() => {
      setRestTime(t => {
        if (t <= 4 && t > 1 && voiceEnabled) speakText(String(t - 1));
        if (t <= 1) { setIsResting(false); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => { if (restRef.current) clearInterval(restRef.current); };
  }, [isResting, restTime, voiceEnabled, isPaused, completed]);

  useEffect(() => () => { if ("speechSynthesis" in window) window.speechSynthesis.cancel(); }, []);

  const currentExercise = exercises[currentIdx];

  const logSet = (setIdx: number) => {
    if (!currentExercise || currentExercise.sets[setIdx]?.completed) return;
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

  const reopenSet = (setIdx: number) => {
    setExercises(prev => prev.map((ex, idx) => idx === currentIdx
      ? { ...ex, sets: ex.sets.map((set, i) => i === setIdx ? { ...set, completed: false } : set) } : ex));
    setIsResting(false);
    setRestTime(0);
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
    if (!user || savedRef.current) return;
    savedRef.current = true;
    const totalVolume = exercises.reduce((sum, ex) =>
      sum + ex.sets.filter(s => s.completed).reduce((s, set) => s + set.weight * set.reps, 0), 0
    );
    try {
      await queueWorkout(user.uid, sessionId, {
        dateMs: Date.now(),
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
      try { clearWorkoutDraft(user.uid); } catch { /* durable queue is already saved */ }
      setCompleted(true);
      setIsResting(false);
      toast.success(navigator.onLine ? "Workout saved on this device. Syncing to your account." : "Workout saved offline. It will sync when you reconnect.");
      if (voiceEnabled) speakText("Workout complete! Amazing work champion!");
      // Challenge progress is recalculated from server records after the queued log syncs.
    } catch { savedRef.current = false; toast.error("Could not save this workout. Free up device storage and try again; your session is still open."); }
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
  const nextSetIdx = currentExercise?.sets.findIndex(set => !set.completed) ?? -1;
  const nextExercise = exercises.find((ex, idx) => idx >= currentIdx && ex.sets.some(set => !set.completed))
    ?? exercises.find(ex => ex.sets.some(set => !set.completed));
  const exerciseSetsDone = currentExercise?.sets.filter(set => set.completed).length ?? 0;

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
    <div className="member-shell workout-session">
      <header className="workout-topbar">
        <div className="workout-container workout-topbar-inner">
          <div className="flex items-center gap-3 min-w-0">
            <Button aria-label="Save draft and leave workout" size="icon" variant="outline" className="workout-icon-button"
              onClick={() => navigate("/workout-planner")}><ChevronLeft size={19} /></Button>
            <div className="min-w-0">
              <p className="member-eyebrow !mb-1">In your corner · Training</p>
              <h1 className="text-sm sm:text-base font-semibold truncate">{plan.name || "Workout"}</h1>
            </div>
          </div>
          <div className="workout-timer-controls">
            <div className="workout-session-clock"><Timer size={17} aria-hidden="true" /><span aria-label="Elapsed session time">{formatTime(elapsedSeconds)}</span></div>
            <Button aria-label={isPaused ? "Resume session timer" : "Pause session timer"} size="icon" variant="ghost" className="workout-icon-button" onClick={() => setIsPaused(!isPaused)}>
              {isPaused ? <Play size={17} /> : <Pause size={17} />}
            </Button>
            <Button aria-label="Reset session timer" size="icon" variant="ghost" className="workout-icon-button" onClick={() => { setElapsedSeconds(0); toast.info("Timer reset"); }}><RotateCcw size={16} /></Button>
            <Button aria-label={voiceEnabled ? "Turn voice coach off" : "Turn voice coach on"} aria-pressed={voiceEnabled} size="icon" variant="ghost" className="workout-icon-button"
              onClick={() => { if (voiceEnabled && "speechSynthesis" in window) window.speechSynthesis.cancel(); setVoiceEnabled(!voiceEnabled); toast.info(voiceEnabled ? "Voice coach off" : "Voice coach on"); }}>
              {voiceEnabled ? <Volume2 size={17} className="text-primary" /> : <VolumeX size={17} />}
            </Button>
          </div>
        </div>
      </header>

      <main className="workout-container workout-content">
        {currentExercise && <>
          <motion.section key={currentIdx} className="workout-exercise-hero" aria-labelledby="current-exercise-title"
            initial={{ opacity: motionEnabled ? 0 : 1, y: motionEnabled ? 8 : 0 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: fadeDuration }}>
            {motionEnabled && <ParticleBurst trigger={particleTrigger} />}
            <div className="workout-exercise-copy">
              <span className="workout-stage-label"><span className="workout-live-dot" />Exercise {String(currentIdx + 1).padStart(2, "0")} / {String(exercises.length).padStart(2, "0")}</span>
              <h2 id="current-exercise-title" className="workout-exercise-title capitalize">{currentExercise.name}</h2>
              <div className="flex flex-wrap gap-2 mb-5">
                <span className="workout-tag capitalize" data-tone="blue">{currentExercise.target}</span>
                <span className="workout-tag capitalize" data-tone="violet">{currentExercise.equipment}</span>
              </div>
              <div className="workout-exercise-targets">
                <span><Target size={15} />{currentExercise.sets.length} sets</span>
                <span><Dumbbell size={15} />{currentExercise.plannedReps} reps target</span>
                <span><Clock size={15} />{currentExercise.restSeconds}s rest</span>
              </div>
            </div>
            <div className="workout-exercise-visual">
              {currentExercise.gifUrl ? <img src={currentExercise.gifUrl} alt={`Demonstration of ${currentExercise.name}`} className="workout-exercise-demo" />
                : <div className="workout-exercise-art" aria-hidden="true"><div className="workout-art-ring"><Dumbbell size={56} strokeWidth={1.4} /></div><span className="workout-art-chip"><Zap size={16} />One set at a time</span></div>}
              <Button variant="outline" className="workout-guide-button" aria-label={`View form guide for ${currentExercise.name}`}
                onClick={() => { setDetailExercise(currentExercise); setShowDetail(true); }}><Info size={15} />Form guide<ArrowUpRight size={14} /></Button>
            </div>
          </motion.section>

          <div className="workout-focus-grid">
            <section aria-labelledby="workout-sets-title" className="workout-log-panel">
              <div className="workout-section-heading">
                <div><p className="member-eyebrow !mb-1">{nextSetIdx < 0 ? "Exercise complete" : isResting ? "Take a breath" : `Ready for set ${nextSetIdx + 1}`}</p><h2 id="workout-sets-title" className="text-xl font-semibold">Your sets<span className="workout-small-count">{exerciseSetsDone} / {currentExercise.sets.length}</span></h2></div>
                <Button variant="outline" size="sm" aria-pressed={showWeight} onClick={() => setShowWeight(!showWeight)} className="workout-weight-toggle">
                  <Dumbbell size={14} />{showWeight ? "Hide weight" : "Track weight"}
                </Button>
              </div>

              <AnimatePresence>
                {isResting && <motion.aside className="workout-rest-card" aria-label="Rest timer"
                  initial={{ opacity: 0, y: motionEnabled ? -8 : 0 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: fadeDuration }}>
                  <div className="workout-rest-ring">
                    <svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="44" /><circle cx="50" cy="50" r="44" className="workout-rest-ring-value"
                      strokeDasharray={2 * Math.PI * 44} strokeDashoffset={2 * Math.PI * 44 * (1 - Math.min(1, restTotal > 0 ? restTime / restTotal : 0))} /></svg>
                    <strong aria-label="Rest time remaining">{restTime}<small>s</small></strong>
                  </div>
                  <div className="workout-rest-copy"><p className="font-semibold text-sm">Recover & reset</p><p className="text-xs text-muted-foreground mt-1">{nextExercise ? `Next: ${nextExercise.name} · Set ${nextExercise.sets.findIndex(set => !set.completed) + 1}` : "All sets logged. Finish when you're ready."}</p></div>
                  <div className="workout-rest-actions">
                    <Button variant="outline" size="sm" onClick={() => { setRestTime(t => t + 15); setRestTotal(t => t + 15); }}>+15s</Button>
                    <Button variant="outline" size="sm" onClick={() => { setRestTime(t => t + 30); setRestTotal(t => t + 30); }}>+30s</Button>
                    <Button size="sm" className="workout-primary-button" aria-label="Skip rest" onClick={() => { setIsResting(false); setRestTime(0); }}><SkipForward size={14} />Skip</Button>
                  </div>
                </motion.aside>}
              </AnimatePresence>

              <div className="workout-set-list" role="list" aria-label="Exercise sets">
                {currentExercise.sets.map((set, setIdx) => (
                  <motion.div role="listitem" key={`${currentIdx}-${setIdx}`}
                    className={`workout-set-card ${set.completed ? "is-complete" : setIdx === nextSetIdx ? "is-current" : ""} ${showWeight ? "has-weight" : ""}`}
                    initial={{ opacity: motionEnabled ? 0 : 1, y: motionEnabled ? 6 : 0 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: fadeDuration, delay: motionEnabled ? setIdx * 0.03 : 0 }}>
                    <div className="workout-set-number"><span className="text-[10px] uppercase tracking-wider">Set</span><strong>{String(setIdx + 1).padStart(2, "0")}</strong></div>
                    <div className="workout-value-field">
                      <label htmlFor={`set-reps-${setIdx}`}>Reps</label>
                      <div className="workout-stepper">
                        <button type="button" aria-label={`Decrease reps for set ${setIdx + 1}`} onClick={() => updateSetField(setIdx, "reps", Math.max(1, set.reps - 1))} disabled={set.completed}><Minus size={15} /></button>
                        <input id={`set-reps-${setIdx}`} aria-label={`Reps for set ${setIdx + 1}`} inputMode="numeric" type="number" min={1} step={1} value={set.reps}
                          onChange={e => updateSetField(setIdx, "reps", Math.max(1, parseInt(e.target.value) || 1))} disabled={set.completed} />
                        <button type="button" aria-label={`Increase reps for set ${setIdx + 1}`} onClick={() => updateSetField(setIdx, "reps", set.reps + 1)} disabled={set.completed}><Plus size={15} /></button>
                      </div>
                    </div>
                    {showWeight && <div className="workout-value-field">
                      <label htmlFor={`set-weight-${setIdx}`}>Weight <span className="font-normal">(kg)</span></label>
                      <div className="workout-stepper">
                        <button type="button" aria-label={`Decrease weight for set ${setIdx + 1}`} onClick={() => updateSetField(setIdx, "weight", Math.max(0, set.weight - 2.5))} disabled={set.completed}><Minus size={15} /></button>
                        <input id={`set-weight-${setIdx}`} aria-label={`Weight for set ${setIdx + 1}`} inputMode="decimal" type="number" min={0} step="any" value={set.weight}
                          onChange={e => updateSetField(setIdx, "weight", Math.max(0, parseFloat(e.target.value) || 0))} disabled={set.completed} />
                        <button type="button" aria-label={`Increase weight for set ${setIdx + 1}`} onClick={() => updateSetField(setIdx, "weight", set.weight + 2.5)} disabled={set.completed}><Plus size={15} /></button>
                      </div>
                    </div>}
                    <Button aria-label={set.completed ? `Edit completed set ${setIdx + 1}` : `Complete set ${setIdx + 1}`} title={set.completed ? "Reopen this set to correct it" : "Save this set"}
                      onClick={() => set.completed ? reopenSet(setIdx) : logSet(setIdx)} className={`workout-log-button ${set.completed ? "is-logged" : ""}`}>
                      <Check size={17} /><span>{set.completed ? "Logged" : "Log set"}</span>{set.completed && <RotateCcw size={12} className="ml-1" />}
                    </Button>
                  </motion.div>
                ))}
              </div>

              <div className="workout-set-actions">
                <Button variant="outline" size="sm" onClick={addExtraSet}><Plus size={14} />Add set</Button>
                {currentExercise.sets.length > 1 && <Button variant="ghost" size="sm" aria-label="Remove last set" onClick={removeLastSet}><Minus size={14} />Remove last</Button>}
                <Button variant="ghost" size="sm" disabled={currentExercise.restSeconds <= 0} aria-label="Start rest timer"
                  onClick={() => { setRestTime(currentExercise.restSeconds); setRestTotal(currentExercise.restSeconds); setIsResting(true); }}><Clock size={14} />Rest · {currentExercise.restSeconds}s</Button>
              </div>

              {nextSetIdx < 0 && <div className="workout-exercise-done" role="status"><Check size={18} /><div><strong>That's this exercise done.</strong><p>{currentIdx < exercises.length - 1 ? "Move on when you're ready, or add another set." : "Finish your workout when you're ready, or add another set."}</p></div></div>}

              <details className="workout-notes">
                <summary><Notebook size={16} /><span>Exercise notes</span>{setNotes[currentExercise.name]?.trim() && <span className="workout-note-saved">Added</span>}<ChevronDown size={15} /></summary>
                <div className="pt-3">
                  <label htmlFor="workout-exercise-notes" className="text-xs text-muted-foreground block mb-2">How did this exercise feel?</label>
                  <textarea id="workout-exercise-notes" value={setNotes[currentExercise.name] || ""} onChange={e => setSetNotes(prev => ({ ...prev, [currentExercise.name]: e.target.value }))}
                    placeholder="Form cues, a personal best, or something for next time…" rows={3} className="workout-note-input" />
                </div>
              </details>
            </section>

            <aside className="workout-session-sidebar">
              <section className="workout-progress-card" aria-labelledby="workout-progress-title">
                <div className="workout-section-heading"><h2 id="workout-progress-title" className="text-sm font-semibold">Session progress</h2><span className="workout-small-count">{Math.round(progressPercent)}%</span></div>
                <div className="workout-progress-overview">
                  <div className="workout-progress-ring" role="progressbar" aria-label="Sets completed" aria-valuemin={0} aria-valuemax={totalSets} aria-valuenow={totalSetsCompleted}>
                    <svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="43" /><circle cx="50" cy="50" r="43" className="workout-progress-ring-value" strokeDasharray={2 * Math.PI * 43} strokeDashoffset={2 * Math.PI * 43 * (1 - progressPercent / 100)} /></svg>
                    <div><strong>{totalSetsCompleted}<small>/{totalSets}</small></strong><span>sets logged</span></div>
                  </div>
                  <div className="workout-session-stats">
                    <div data-tone="violet"><Dumbbell size={16} /><p><strong>{totalVolume.toLocaleString()} kg</strong><span>Volume logged</span></p></div>
                    <div data-tone="amber"><Flame size={16} /><p><strong>~{calorieEstimate} kcal</strong><span>Estimated energy</span></p></div>
                  </div>
                </div>
                <p className="workout-save-caption"><ShieldCheck size={13} />Your session autosaves on this device.</p>
              </section>

              <section className="workout-lineup-card" aria-labelledby="workout-lineup-title">
                <div className="workout-section-heading"><h2 id="workout-lineup-title" className="text-sm font-semibold flex items-center gap-2"><ListOrdered size={16} className="text-primary" />Session lineup</h2><span className="text-xs text-muted-foreground">{exercises.length}</span></div>
                <nav aria-label="Workout exercises" className="workout-lineup">
                  {exercises.map((ex, idx) => {
                    const done = ex.sets.filter(set => set.completed).length;
                    const allDone = done === ex.sets.length;
                    return <button key={idx} type="button" aria-current={idx === currentIdx ? "step" : undefined} aria-label={`Go to exercise ${idx + 1}: ${ex.name}`} onClick={() => setCurrentIdx(idx)}
                      className={`workout-lineup-item ${idx === currentIdx ? "is-current" : ""} ${allDone ? "is-complete" : ""}`}>
                      <span className="workout-lineup-index">{allDone ? <Check size={15} /> : String(idx + 1).padStart(2, "0")}</span>
                      <span className="min-w-0 flex-1"><strong className="capitalize">{ex.name}</strong><small>{done} / {ex.sets.length} sets logged</small></span>
                      {idx === currentIdx && <ChevronRight size={15} className="shrink-0" />}
                    </button>;
                  })}
                </nav>
              </section>
            </aside>
          </div>
        </>}
      </main>

      <footer className="workout-footer">
        <div className="workout-container workout-footer-inner">
          <Button variant="outline" aria-label="Previous exercise" disabled={currentIdx === 0} onClick={() => setCurrentIdx(i => Math.max(0, i - 1))}><ChevronLeft size={17} /><span>Previous</span></Button>
          <div className="workout-footer-progress"><strong>{totalSetsCompleted} of {totalSets} sets logged</strong><div><span style={{ width: `${progressPercent}%` }} /></div></div>
          {currentIdx === exercises.length - 1
            ? <Button aria-label="Finish workout" onClick={finishWorkout} className="workout-primary-button"><Trophy size={17} />Finish workout</Button>
            : <Button aria-label="Next exercise" onClick={() => setCurrentIdx(i => Math.min(exercises.length - 1, i + 1))} className="workout-primary-button">Next exercise<ChevronRight size={17} /></Button>}
        </div>
      </footer>

      <Dialog open={isPaused} onOpenChange={open => setIsPaused(open)}>
        <DialogContent className="member-shell workout-pause-dialog">
          <div className="workout-pause-icon"><Pause size={30} /></div>
          <DialogHeader><DialogTitle className="text-2xl">Take your time.</DialogTitle><DialogDescription>The session timer{isResting ? " and rest countdown are" : " is"} paused at {formatTime(elapsedSeconds)}.</DialogDescription></DialogHeader>
          <Button className="workout-primary-button mt-3" onClick={() => setIsPaused(false)}><Play size={16} />Resume workout</Button>
        </DialogContent>
      </Dialog>
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
  const { motionEnabled, fadeDuration } = useSessionMotion();
  const [confettiPieces, setConfettiPieces] = useState<{ id: number; x: number; color: string; delay: number; size: number; shape: string }[]>([]);

  useEffect(() => {
    if (!motionEnabled) { setConfettiPieces([]); return; }
    setConfettiPieces(Array.from({ length: 80 }, (_, i) => ({
      id: i, x: Math.random() * 100,
      color: ["#2563EB", "#06B6D4", "#84CC16", "#FACC15", "#F43F5E", "#8B5CF6", "#EC4899"][Math.floor(Math.random() * 7)],
      delay: Math.random() * 1, size: Math.random() * 10 + 4,
      shape: Math.random() > 0.5 ? "circle" : "rect",
    })));
  }, [motionEnabled]);

  const noteEntries = Object.entries(notes).filter(([_, v]) => v.trim());

  const stats = [
    { icon: Timer, label: "Duration", value: formatTime(duration), color: "text-primary" },
    { icon: Check, label: "Sets Done", value: String(totalSets), color: "text-success" },
    { icon: Flame, label: "Exercises", value: String(exerciseCount), color: "text-warning" },
    { icon: Zap, label: "Calories", value: `~${calories}`, color: "text-destructive" },
  ];
  if (totalVolume > 0) stats.splice(1, 0, { icon: Dumbbell, label: "Volume", value: `${totalVolume.toLocaleString()} kg`, color: "text-accent" });

  return (
    <div className="member-shell min-h-screen bg-background text-foreground flex items-center justify-center p-4 relative overflow-hidden">
      {confettiPieces.map(p => (
        <motion.div key={p.id}
          initial={{ y: -20, opacity: 1, rotate: 0 }}
          animate={{ y: "110vh", opacity: 0, rotate: 720 + Math.random() * 360 }}
          transition={{ duration: 2.5 + Math.random() * 1.5, delay: p.delay, ease: "easeIn" }}
          className="absolute top-0 pointer-events-none"
          style={{ left: `${p.x}%`, width: p.size, height: p.shape === "circle" ? p.size : p.size * 0.4, backgroundColor: p.color, borderRadius: p.shape === "circle" ? "50%" : "2px" }}
        />
      ))}
      {motionEnabled && <motion.div animate={{ scale: [1, 1.3, 1], opacity: [0.1, 0.2, 0.1] }} transition={{ duration: 3, repeat: Infinity }}
        className="absolute w-[500px] h-[500px] rounded-full" style={{ background: "radial-gradient(circle, hsl(var(--primary) / .3), transparent 70%)" }} />}

      <motion.div initial={{ scale: motionEnabled ? 0.9 : 1, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: fadeDuration }}
        className="glass-card p-8 rounded-3xl max-w-md w-full text-center relative z-10">
        <motion.div initial={{ scale: motionEnabled ? 0 : 1, rotate: motionEnabled ? -90 : 0 }} animate={{ scale: 1, rotate: 0 }}
          transition={motionEnabled ? { type: "spring", damping: 12, delay: 0.2 } : { duration: fadeDuration }}
          className="w-20 h-20 rounded-3xl gradient-bg mx-auto mb-6 flex items-center justify-center">
          <Trophy size={40} className="text-primary-foreground" />
        </motion.div>
        <motion.h1 initial={{ opacity: 0, y: motionEnabled ? 20 : 0 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: fadeDuration, delay: motionEnabled ? 0.3 : 0 }}
          className="text-2xl font-heading font-bold mb-1">Another session in the books.</motion.h1>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: fadeDuration, delay: motionEnabled ? 0.4 : 0 }}
          className="text-muted-foreground text-sm mb-6">{planName}</motion.p>
        <div className="flex justify-center mb-5"><SyncStatus /></div>

        <div className={`grid ${stats.length > 4 ? "grid-cols-3" : "grid-cols-2"} gap-2.5 mb-6`}>
          {stats.map((stat, i) => (
            <motion.div key={i} initial={{ opacity: 0, scale: motionEnabled ? 0.8 : 1 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: fadeDuration, delay: motionEnabled ? 0.45 + i * 0.08 : 0 }} className="glass-card p-3 rounded-xl">
              <stat.icon size={16} className={`mx-auto mb-1.5 ${stat.color}`} />
              <p className="text-lg font-bold">{stat.value}</p>
              <p className="text-[10px] text-muted-foreground">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        {noteEntries.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: fadeDuration, delay: motionEnabled ? 0.7 : 0 }}
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

        <motion.div initial={{ opacity: 0, y: motionEnabled ? 10 : 0 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: fadeDuration, delay: motionEnabled ? 0.8 : 0 }}>
          <Button onClick={onDone} className="w-full gradient-bg text-primary-foreground rounded-xl text-base py-3 glow-pulse">
            Back to your training
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
}
