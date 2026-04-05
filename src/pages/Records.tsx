import { useState, useEffect } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy, Plus, X, Target, Zap, CheckCircle2, Lock, Star,
  TrendingUp, Dumbbell, Clock, Flame, Medal, ChevronRight,
  Trash2, Calendar, Award
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import {
  collection, addDoc, getDocs, deleteDoc, doc, Timestamp, orderBy, query,
} from "firebase/firestore";
import { toast } from "sonner";
import { useChallenges, CHALLENGE_TEMPLATES } from "@/hooks/useChallenges";
import { format } from "date-fns";

interface PersonalRecord {
  id: string;
  exerciseName: string;
  category: "strength" | "cardio" | "body";
  value: number;
  unit: string;
  notes?: string;
  date: Timestamp;
}

const PR_UNITS = {
  strength: [{ label: "kg (1RM)", value: "kg" }, { label: "lbs (1RM)", value: "lbs" }],
  cardio: [{ label: "min (time)", value: "min" }, { label: "km (distance)", value: "km" }, { label: "mi (distance)", value: "mi" }],
  body: [{ label: "kg (weight)", value: "kg" }, { label: "lbs (weight)", value: "lbs" }, { label: "cm (measurement)", value: "cm" }, { label: "% (body fat)", value: "%" }],
};

const DIFFICULTY_COLORS: Record<string, string> = {
  Easy: "text-green-400 bg-green-500/15 border-green-500/30",
  Medium: "text-yellow-400 bg-yellow-500/15 border-yellow-500/30",
  Hard: "text-orange-400 bg-orange-500/15 border-orange-500/30",
  Extreme: "text-red-400 bg-red-500/15 border-red-500/30",
};

type Tab = "prs" | "pbs" | "challenges";

export default function Records() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("prs");
  const [records, setRecords] = useState<PersonalRecord[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const { challenges, loading: cLoading, joinChallenge, completeChallenge, fetchChallenges } = useChallenges();

  useEffect(() => {
    if (user) fetchRecords();
  }, [user]);

  const fetchRecords = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const snap = await getDocs(
        query(collection(db, "users", user.uid, "personalRecords"), orderBy("date", "desc"))
      );
      setRecords(snap.docs.map(d => ({ id: d.id, ...d.data() } as PersonalRecord)));
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const deleteRecord = async (id: string) => {
    if (!user) return;
    await deleteDoc(doc(db, "users", user.uid, "personalRecords", id));
    setRecords(prev => prev.filter(r => r.id !== id));
    toast.success("Record deleted");
    fetchChallenges();
  };

  const prs = records.filter(r => r.category === "strength");
  const pbs = records.filter(r => r.category !== "strength");

  const joinedChallenges = challenges.filter(c => c.joined);
  const availableChallenges = challenges.filter(c => !c.joined);

  const totalXp = challenges.filter(c => c.completed).reduce((s, c) => s + c.xpReward, 0);
  const level = Math.floor(totalXp / 500) + 1;
  const xpForNextLevel = level * 500;
  const xpProgress = totalXp % 500;

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-heading font-bold gradient-text">Records & Challenges</h1>
            <p className="text-xs text-muted-foreground mt-1">Track your bests and conquer challenges</p>
          </div>
          {(tab === "prs" || tab === "pbs") && (
            <Button onClick={() => setShowAddModal(true)} className="gradient-bg text-primary-foreground rounded-xl gap-2">
              <Plus size={16} /> Add Record
            </Button>
          )}
        </div>

        {/* XP + Level banner */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="glass-card p-4 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl gradient-bg flex items-center justify-center text-xl shadow-lg">
            <Star className="text-white" size={22} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-bold">Level {level}</span>
              <span className="text-xs text-muted-foreground">{totalXp.toLocaleString()} / {xpForNextLevel.toLocaleString()} XP</span>
            </div>
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <motion.div className="h-full gradient-bg rounded-full"
                initial={{ width: 0 }} animate={{ width: `${(xpProgress / 500) * 100}%` }}
                transition={{ duration: 1, ease: "easeOut" }} />
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Completed</p>
            <p className="text-lg font-bold text-primary">{challenges.filter(c => c.completed).length}</p>
            <p className="text-xs text-muted-foreground">challenges</p>
          </div>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-secondary/40 rounded-2xl w-fit border border-white/[0.05]">
          {([
            { id: "prs", label: "Gym PRs", icon: Dumbbell },
            { id: "pbs", label: "Personal Bests", icon: Trophy },
            { id: "challenges", label: "Challenges", icon: Zap },
          ] as const).map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                tab === t.id ? "gradient-bg text-primary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground"
              }`}>
              <t.icon size={14} /> {t.label}
            </button>
          ))}
        </div>

        {/* PRs Tab */}
        <AnimatePresence mode="wait">
          {tab === "prs" && (
            <motion.div key="prs" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <RecordsList records={prs} category="strength" loading={loading} onDelete={deleteRecord} onAdd={() => setShowAddModal(true)} label="Gym PRs" emptyLabel="No gym PRs recorded yet" />
            </motion.div>
          )}

          {/* PBs Tab */}
          {tab === "pbs" && (
            <motion.div key="pbs" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <RecordsList records={pbs} category="other" loading={loading} onDelete={deleteRecord} onAdd={() => setShowAddModal(true)} label="Personal Bests" emptyLabel="No personal bests recorded yet" />
            </motion.div>
          )}

          {/* Challenges Tab */}
          {tab === "challenges" && (
            <motion.div key="challenges" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
              {/* Active challenges */}
              {joinedChallenges.length > 0 && (
                <div className="space-y-3">
                  <h2 className="text-sm font-heading font-bold uppercase tracking-wider text-muted-foreground">Active Challenges</h2>
                  <div className="grid gap-3 md:grid-cols-2">
                    {joinedChallenges.map((c, i) => (
                      <ChallengeCard key={c.id} challenge={c} index={i} onComplete={completeChallenge} />
                    ))}
                  </div>
                </div>
              )}

              {/* Available challenges */}
              {availableChallenges.length > 0 && (
                <div className="space-y-3">
                  <h2 className="text-sm font-heading font-bold uppercase tracking-wider text-muted-foreground">
                    {joinedChallenges.length > 0 ? "More Challenges" : "All Challenges"}
                  </h2>
                  <div className="grid gap-3 md:grid-cols-2">
                    {availableChallenges.map((c, i) => (
                      <ChallengeCard key={c.id} challenge={c} index={i} onJoin={joinChallenge} />
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Add Record Modal */}
      <AnimatePresence>
        {showAddModal && (
          <AddRecordModal
            onClose={() => setShowAddModal(false)}
            onSave={async (record) => {
              if (!user) return;
              const ref = await addDoc(collection(db, "users", user.uid, "personalRecords"), {
                ...record, date: Timestamp.now(),
              });
              setRecords(prev => [{ id: ref.id, ...record, date: Timestamp.now() }, ...prev]);
              toast.success("Record added! 🏆");
              setShowAddModal(false);
              fetchChallenges();
            }}
            defaultCategory={tab === "prs" ? "strength" : "cardio"}
          />
        )}
      </AnimatePresence>
    </AppLayout>
  );
}

/* ===== RECORDS LIST ===== */
function RecordsList({ records, category, loading, onDelete, onAdd, label, emptyLabel }: {
  records: PersonalRecord[];
  category: string;
  loading: boolean;
  onDelete: (id: string) => void;
  onAdd: () => void;
  label: string;
  emptyLabel: string;
}) {
  if (loading) {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        {[1, 2, 3, 4].map(i => <div key={i} className="glass-card h-24 rounded-2xl shimmer" />)}
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="glass-card p-12 rounded-2xl flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 rounded-2xl gradient-bg flex items-center justify-center mb-4">
          <Trophy size={28} className="text-white" />
        </div>
        <h3 className="font-heading font-bold text-lg mb-2">{emptyLabel}</h3>
        <p className="text-sm text-muted-foreground mb-5">Start tracking your {label.toLowerCase()} to see your progress over time.</p>
        <Button onClick={onAdd} className="gradient-bg text-primary-foreground rounded-xl gap-2">
          <Plus size={14} /> Add First Record
        </Button>
      </motion.div>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {records.map((record, i) => {
        const dateStr = record.date?.toDate ? format(record.date.toDate(), "MMM d, yyyy") : "—";
        return (
          <motion.div key={record.id}
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="glass-card p-4 rounded-2xl group hover:border-white/[0.15] transition-all">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1 min-w-0">
                <h3 className="font-heading font-bold text-sm capitalize truncate">{record.exerciseName}</h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground capitalize">
                    {record.category}
                  </span>
                  {record.notes && (
                    <span className="text-xs text-muted-foreground truncate max-w-[120px]">{record.notes}</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => onDelete(record.id)}
                className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg flex items-center justify-center bg-destructive/10 text-destructive hover:bg-destructive/20 transition-all ml-2 flex-shrink-0">
                <Trash2 size={12} />
              </button>
            </div>

            <div className="flex items-end justify-between">
              <div>
                <span className="text-2xl font-bold gradient-text">{record.value}</span>
                <span className="text-sm text-muted-foreground ml-1">{record.unit}</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar size={11} />
                {dateStr}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

/* ===== CHALLENGE CARD ===== */
function ChallengeCard({ challenge, index, onJoin, onComplete }: {
  challenge: ReturnType<typeof CHALLENGE_TEMPLATES[0] & { joined: boolean; completed: boolean; progress: number }> & any;
  index: number;
  onJoin?: (id: string) => void;
  onComplete?: (id: string) => void;
}) {
  const pct = Math.min((challenge.progress / challenge.target) * 100, 100);
  const isComplete = challenge.progress >= challenge.target;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`glass-card p-4 rounded-2xl transition-all hover:border-white/[0.15] relative overflow-hidden ${challenge.completed ? "border-green-500/30" : ""}`}
    >
      {challenge.completed && (
        <div className="absolute top-2 right-2">
          <CheckCircle2 size={16} className="text-green-400" />
        </div>
      )}

      <div className="flex items-start gap-3 mb-3">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${challenge.color} flex items-center justify-center text-xl flex-shrink-0 shadow-lg`}>
          {challenge.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-heading font-bold text-sm">{challenge.name}</h3>
            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${DIFFICULTY_COLORS[challenge.difficulty]}`}>
              {challenge.difficulty}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{challenge.description}</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-muted-foreground">
            {challenge.progress.toLocaleString()} / {challenge.target.toLocaleString()} {challenge.targetLabel}
          </span>
          <span className={`font-medium ${isComplete ? "text-green-400" : "text-primary"}`}>{Math.round(pct)}%</span>
        </div>
        <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${challenge.completed ? "bg-green-500" : `bg-gradient-to-r ${challenge.color}`}`}
            initial={{ width: 0 }} animate={{ width: `${pct}%` }}
            transition={{ duration: 1, ease: "easeOut", delay: index * 0.05 }}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Zap size={11} className="text-warning" />
          <span>{challenge.xpReward} XP</span>
        </div>
        {challenge.completed ? (
          <span className="text-xs text-green-400 font-medium flex items-center gap-1">
            <Award size={12} /> Completed!
          </span>
        ) : isComplete && onComplete ? (
          <Button size="sm" onClick={() => onComplete(challenge.id)}
            className="h-7 px-3 text-xs rounded-lg gradient-bg text-primary-foreground gap-1">
            <Trophy size={12} /> Claim Reward
          </Button>
        ) : !challenge.joined && onJoin ? (
          <Button size="sm" onClick={() => onJoin(challenge.id)}
            className="h-7 px-3 text-xs rounded-lg bg-secondary hover:bg-secondary/80 text-foreground border border-white/10 gap-1">
            <Plus size={12} /> Join
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">In Progress</span>
        )}
      </div>
    </motion.div>
  );
}

/* ===== ADD RECORD MODAL ===== */
function AddRecordModal({ onClose, onSave, defaultCategory }: {
  onClose: () => void;
  onSave: (record: Omit<PersonalRecord, "id" | "date">) => void;
  defaultCategory: "strength" | "cardio" | "body";
}) {
  const [exerciseName, setExerciseName] = useState("");
  const [category, setCategory] = useState<"strength" | "cardio" | "body">(defaultCategory);
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState(PR_UNITS[defaultCategory][0].value);
  const [notes, setNotes] = useState("");

  const handleCategoryChange = (c: "strength" | "cardio" | "body") => {
    setCategory(c);
    setUnit(PR_UNITS[c][0].value);
  };

  const handleSubmit = () => {
    if (!exerciseName.trim() || !value) {
      toast.error("Please fill in the exercise name and value");
      return;
    }
    onSave({ exerciseName: exerciseName.trim(), category, value: parseFloat(value), unit, notes: notes.trim() });
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="glass-card w-full max-w-md p-6 rounded-2xl"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-heading font-bold text-lg">Add Record</h3>
            <p className="text-xs text-muted-foreground">Log a new personal best or PR</p>
          </div>
          <Button size="icon" variant="ghost" onClick={onClose} className="rounded-xl"><X size={18} /></Button>
        </div>

        <div className="space-y-4">
          {/* Category */}
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">Category</label>
            <div className="flex gap-2">
              {(["strength", "cardio", "body"] as const).map(c => (
                <button key={c} onClick={() => handleCategoryChange(c)}
                  className={`flex-1 py-2 rounded-xl text-xs font-medium capitalize transition-all border ${
                    category === c ? "gradient-bg text-primary-foreground border-transparent" : "bg-secondary border-white/[0.08] text-muted-foreground hover:text-foreground"
                  }`}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Exercise name */}
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">
              {category === "strength" ? "Exercise Name" : category === "cardio" ? "Activity" : "Metric"}
            </label>
            <Input
              placeholder={category === "strength" ? "e.g. Bench Press, Squat..." : category === "cardio" ? "e.g. 5K Run, Mile..." : "e.g. Body Weight..."}
              value={exerciseName}
              onChange={e => setExerciseName(e.target.value)}
              className="bg-secondary/60 border-white/[0.08] rounded-xl"
            />
          </div>

          {/* Value + Unit */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">Value</label>
              <Input
                type="number" placeholder="0"
                value={value}
                onChange={e => setValue(e.target.value)}
                className="bg-secondary/60 border-white/[0.08] rounded-xl"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">Unit</label>
              <select
                value={unit}
                onChange={e => setUnit(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-secondary/60 border border-white/[0.08] text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                {PR_UNITS[category].map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">Notes (optional)</label>
            <Input
              placeholder="e.g. Full ROM, competition lift..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="bg-secondary/60 border-white/[0.08] rounded-xl"
            />
          </div>

          <Button onClick={handleSubmit} className="w-full gradient-bg text-primary-foreground rounded-xl gap-2 mt-2">
            <Trophy size={16} /> Save Record
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
