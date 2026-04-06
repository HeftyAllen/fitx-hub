import { useState, useEffect, useRef } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { db, storage } from "@/lib/firebase";
import {
  collection, addDoc, getDocs, deleteDoc, doc, orderBy, query, Timestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { motion, AnimatePresence } from "framer-motion";
import {
  AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip,
  BarChart, Bar, CartesianGrid,
} from "recharts";
import {
  Scale, Camera, TrendingUp, TrendingDown, Plus, Trash2, X,
  ChevronDown, Target, Dumbbell, Award, ArrowUpRight, ArrowDownRight,
  Download, Share2, Loader2, Image, BarChart3, Ruler,
} from "lucide-react";
import { toast } from "sonner";

const MEASURE_FIELDS = [
  { key: "chest",   label: "Chest" },
  { key: "waist",   label: "Waist" },
  { key: "hips",    label: "Hips" },
  { key: "arms",    label: "Arms" },
  { key: "thighs",  label: "Thighs" },
  { key: "neck",    label: "Neck" },
];

const PHOTO_POSES = ["Front", "Side", "Back", "Other"];
const TIME_RANGES = ["1M", "3M", "6M", "1Y", "ALL"];

const fadeUp = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } };
const stagger = { visible: { transition: { staggerChildren: 0.07 } } };

function StatCard({
  label, value, unit, sub, icon: Icon, color, trend,
}: {
  label: string; value: string | number; unit?: string; sub?: string;
  icon: any; color: string; trend?: "up" | "down" | "neutral";
}) {
  return (
    <motion.div variants={fadeUp}
      className="glass-card p-5 flex flex-col gap-3 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-[0.07] -translate-y-6 translate-x-6"
        style={{ background: color }} />
      <div className="flex items-center justify-between">
        <div className="p-2.5 rounded-xl" style={{ background: `${color}20` }}>
          <Icon size={17} style={{ color }} />
        </div>
        {trend && trend !== "neutral" && (
          <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${trend === "up" ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"}`}>
            {trend === "up" ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
          </div>
        )}
      </div>
      <div>
        <p className="text-xs text-muted-foreground font-medium mb-1">{label}</p>
        <p className="text-2xl font-black text-foreground leading-none">
          {value}<span className="text-sm font-medium text-muted-foreground ml-1">{unit}</span>
        </p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </div>
    </motion.div>
  );
}

function SectionTitle({ icon: Icon, label, desc }: { icon: any; label: string; desc?: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="p-2 rounded-xl bg-primary/10">
        <Icon size={17} className="text-primary" />
      </div>
      <div>
        <h2 className="font-heading font-bold text-base">{label}</h2>
        {desc && <p className="text-xs text-muted-foreground">{desc}</p>}
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl px-3 py-2 shadow-xl text-xs">
      <p className="text-muted-foreground mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="font-bold" style={{ color: p.color }}>{p.name}: {p.value}{p.unit || ""}</p>
      ))}
    </div>
  );
};

export default function Progress() {
  const { user, userProfile } = useAuth();

  // Weight state
  const [weightLogs, setWeightLogs] = useState<any[]>([]);
  const [newWeight, setNewWeight] = useState("");
  const [newWeightNote, setNewWeightNote] = useState("");
  const [targetWeight, setTargetWeight] = useState("");
  const [weightRange, setWeightRange] = useState("3M");
  const [loggingWeight, setLoggingWeight] = useState(false);
  const [showWeightForm, setShowWeightForm] = useState(false);

  // Measurements state
  const [measurements, setMeasurements] = useState<any[]>([]);
  const [newMeasure, setNewMeasure] = useState<Record<string, string>>({});
  const [showMeasureForm, setShowMeasureForm] = useState(false);
  const [savingMeasure, setSavingMeasure] = useState(false);

  // Photos state
  const [photos, setPhotos] = useState<any[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoLabel, setPhotoLabel] = useState("Front");
  const [selectedPhoto, setSelectedPhoto] = useState<any | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [compareA, setCompareA] = useState<any | null>(null);
  const [compareB, setCompareB] = useState<any | null>(null);

  // Workout stats
  const [workoutStats, setWorkoutStats] = useState({ total: 0, volume: 0, streak: 0, prs: 0 });

  // Loading
  const [loadingAll, setLoadingAll] = useState(true);

  const photoInputRef = useRef<HTMLInputElement>(null);

  /* ──────────────── FETCH ──────────────── */
  useEffect(() => {
    if (!user) return;
    Promise.all([
      loadWeightLogs(),
      loadMeasurements(),
      loadPhotos(),
      loadWorkoutStats(),
    ]).finally(() => setLoadingAll(false));
  }, [user]);

  async function loadWeightLogs() {
    const snap = await getDocs(query(collection(db, "users", user!.uid, "weightLogs"), orderBy("date", "asc")));
    setWeightLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }

  async function loadMeasurements() {
    const snap = await getDocs(query(collection(db, "users", user!.uid, "measurements"), orderBy("date", "desc")));
    setMeasurements(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }

  async function loadPhotos() {
    const snap = await getDocs(query(collection(db, "users", user!.uid, "progressPhotos"), orderBy("date", "desc")));
    setPhotos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }

  async function loadWorkoutStats() {
    const logsSnap = await getDocs(collection(db, "users", user!.uid, "workoutLogs"));
    const prsSnap = await getDocs(collection(db, "users", user!.uid, "personalRecords"));
    const logs = logsSnap.docs.map(d => d.data());
    setWorkoutStats({
      total: logs.length,
      volume: Math.round(logs.reduce((s, l) => s + (l.totalVolume || 0), 0)),
      streak: 0,
      prs: prsSnap.size,
    });
  }

  /* ──────────────── WEIGHT ──────────────── */
  async function logWeight() {
    if (!newWeight || !user) return;
    setLoggingWeight(true);
    try {
      await addDoc(collection(db, "users", user.uid, "weightLogs"), {
        weight: parseFloat(newWeight),
        note: newWeightNote,
        date: Timestamp.now(),
      });
      setNewWeight("");
      setNewWeightNote("");
      setShowWeightForm(false);
      await loadWeightLogs();
      toast.success("Weight logged!");
    } catch {
      toast.error("Failed to log weight");
    } finally {
      setLoggingWeight(false);
    }
  }

  async function deleteWeight(id: string) {
    await deleteDoc(doc(db, "users", user!.uid, "weightLogs", id));
    setWeightLogs(p => p.filter(w => w.id !== id));
    toast.success("Entry deleted");
  }

  /* ──────────────── MEASUREMENTS ──────────────── */
  async function saveMeasurement() {
    if (!user || Object.keys(newMeasure).length === 0) return;
    setSavingMeasure(true);
    try {
      const data: any = { date: Timestamp.now() };
      MEASURE_FIELDS.forEach(f => { if (newMeasure[f.key]) data[f.key] = parseFloat(newMeasure[f.key]); });
      await addDoc(collection(db, "users", user.uid, "measurements"), data);
      setNewMeasure({});
      setShowMeasureForm(false);
      await loadMeasurements();
      toast.success("Measurements saved!");
    } catch {
      toast.error("Failed to save measurements");
    } finally {
      setSavingMeasure(false);
    }
  }

  /* ──────────────── PHOTOS ──────────────── */
  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("Photo must be under 10MB"); return; }
    setUploadingPhoto(true);
    try {
      const storageRef = ref(storage, `users/${user.uid}/progress/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      await addDoc(collection(db, "users", user.uid, "progressPhotos"), {
        photoURL: url,
        storagePath: storageRef.fullPath,
        pose: photoLabel,
        date: Timestamp.now(),
      });
      await loadPhotos();
      toast.success("Photo uploaded!");
    } catch {
      toast.error("Upload failed — try again");
    } finally {
      setUploadingPhoto(false);
    }
    e.target.value = "";
  }

  async function deletePhoto(photo: any) {
    try {
      if (photo.storagePath) await deleteObject(ref(storage, photo.storagePath));
      await deleteDoc(doc(db, "users", user!.uid, "progressPhotos", photo.id));
      setPhotos(p => p.filter(x => x.id !== photo.id));
      if (selectedPhoto?.id === photo.id) setSelectedPhoto(null);
      toast.success("Photo deleted");
    } catch {
      toast.error("Failed to delete photo");
    }
  }

  /* ──────────────── CHART DATA ──────────────── */
  function getFilteredWeightData() {
    const now = Date.now();
    const cutoffs: Record<string, number> = {
      "1M": 30, "3M": 90, "6M": 180, "1Y": 365, "ALL": 99999,
    };
    const days = cutoffs[weightRange] || 90;
    const cutoff = now - days * 24 * 60 * 60 * 1000;
    return weightLogs
      .filter(w => (w.date?.toMillis?.() ?? 0) >= cutoff)
      .map(w => ({
        date: new Date(w.date?.toMillis?.() ?? Date.now()).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
        weight: w.weight,
      }));
  }

  /* ──────────────── DERIVED STATS ──────────────── */
  const currentWeight = weightLogs.length ? weightLogs[weightLogs.length - 1].weight : null;
  const startWeight = weightLogs.length ? weightLogs[0].weight : null;
  const weightChange = currentWeight && startWeight ? +(currentWeight - startWeight).toFixed(1) : null;
  const units = userProfile?.units === "imperial" ? "lbs" : "kg";
  const chartData = getFilteredWeightData();

  const latestMeasure = measurements[0];

  if (loadingAll) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 size={28} className="animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 pb-24 space-y-8">

        {/* ── PAGE HEADER ── */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="relative rounded-3xl overflow-hidden p-6 md:p-8"
          style={{ background: "linear-gradient(135deg, rgba(37,99,235,0.18) 0%, rgba(6,182,212,0.10) 100%)" }}>
          <div className="absolute inset-0 border border-primary/20 rounded-3xl pointer-events-none" />
          <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full opacity-10 blur-3xl bg-primary" />
          <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full opacity-10 blur-3xl bg-cyan-500" />
          <div className="relative z-10">
            <p className="text-xs text-primary/80 font-bold uppercase tracking-widest mb-1">Your Journey</p>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-2">Progress Tracker</h1>
            <p className="text-muted-foreground text-sm max-w-lg">
              Track your weight, measurements, progress photos and workout stats all in one place.
            </p>
          </div>
        </motion.div>

        {/* ── STAT CARDS ── */}
        <motion.div variants={stagger} initial="hidden" animate="visible"
          className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Current Weight" value={currentWeight ?? "—"} unit={units}
            sub={startWeight ? `Started at ${startWeight} ${units}` : "Log your first weight"}
            icon={Scale} color="#2563eb"
            trend={weightChange === null ? "neutral" : weightChange < 0 ? "down" : "up"} />
          <StatCard label="Weight Change"
            value={weightChange !== null ? (weightChange > 0 ? `+${weightChange}` : weightChange) : "—"}
            unit={weightChange !== null ? units : ""}
            sub={weightLogs.length > 1 ? `Over ${weightLogs.length} entries` : "Need 2+ entries"}
            icon={weightChange !== null && weightChange < 0 ? TrendingDown : TrendingUp}
            color={weightChange !== null && weightChange < 0 ? "#10b981" : "#f59e0b"}
            trend={weightChange !== null ? (weightChange < 0 ? "up" : "down") : "neutral"} />
          <StatCard label="Total Workouts" value={workoutStats.total}
            sub={`${(workoutStats.volume / 1000).toFixed(1)}k ${units} lifted total`}
            icon={Dumbbell} color="#8b5cf6" trend="neutral" />
          <StatCard label="Personal Records" value={workoutStats.prs}
            sub="All time PRs"
            icon={Award} color="#06b6d4" trend="neutral" />
        </motion.div>

        {/* ── WEIGHT TRACKER ── */}
        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <div className="glass-card p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <SectionTitle icon={Scale} label="Weight History" desc="Track your weight over time" />
              <div className="flex items-center gap-2 flex-wrap">
                {TIME_RANGES.map(r => (
                  <button key={r} onClick={() => setWeightRange(r)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${weightRange === r ? "gradient-bg text-primary-foreground shadow-md shadow-primary/20" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
                    {r}
                  </button>
                ))}
                <button onClick={() => setShowWeightForm(!showWeightForm)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold gradient-bg text-primary-foreground shadow-md shadow-primary/20 ml-1">
                  <Plus size={13} /> Log
                </button>
              </div>
            </div>

            <AnimatePresence>
              {showWeightForm && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden mb-6">
                  <div className="flex flex-col sm:flex-row gap-3 p-4 rounded-2xl bg-secondary/50 border border-border">
                    <div className="flex items-center gap-2 flex-1">
                      <Scale size={15} className="text-muted-foreground flex-shrink-0" />
                      <input type="number" step="0.1" placeholder={`Weight (${units})`} value={newWeight}
                        onChange={e => setNewWeight(e.target.value)}
                        className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none" />
                    </div>
                    <input type="text" placeholder="Optional note..." value={newWeightNote}
                      onChange={e => setNewWeightNote(e.target.value)}
                      className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none border-l border-border pl-3" />
                    <div className="flex gap-2">
                      <button onClick={logWeight} disabled={loggingWeight || !newWeight}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl gradient-bg text-primary-foreground text-xs font-bold disabled:opacity-50">
                        {loggingWeight ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                        Save
                      </button>
                      <button onClick={() => setShowWeightForm(false)} className="p-2 rounded-xl bg-secondary text-muted-foreground hover:text-foreground">
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {chartData.length > 1 ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData} margin={{ left: -10, right: 10, top: 5, bottom: 0 }}>
                  <defs>
                    <linearGradient id="wGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false}
                    domain={["auto", "auto"]} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="weight" name={`Weight (${units})`} stroke="#2563eb" strokeWidth={2.5}
                    fill="url(#wGrad)" dot={{ fill: "#2563eb", r: 3 }} activeDot={{ r: 5, fill: "#06b6d4" }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                  <TrendingUp size={28} className="text-primary/60" />
                </div>
                <p className="text-sm font-medium mb-1">No weight data yet</p>
                <p className="text-xs">Log at least 2 entries to see your chart</p>
                <button onClick={() => setShowWeightForm(true)}
                  className="mt-4 flex items-center gap-2 text-xs text-primary hover:text-primary/80 font-semibold">
                  <Plus size={14} /> Log your first weight
                </button>
              </div>
            )}

            {/* Recent log entries */}
            {weightLogs.length > 0 && (
              <div className="mt-6 border-t border-border pt-5">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Recent Entries</p>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {[...weightLogs].reverse().slice(0, 10).map(log => (
                    <div key={log.id} className="flex items-center justify-between px-3 py-2 rounded-xl bg-secondary/40 hover:bg-secondary/70 transition-colors group">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Scale size={13} className="text-primary" />
                        </div>
                        <div>
                          <span className="text-sm font-bold">{log.weight} {units}</span>
                          {log.note && <span className="text-xs text-muted-foreground ml-2">· {log.note}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">
                          {new Date(log.date?.toMillis?.() ?? Date.now()).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })}
                        </span>
                        <button onClick={() => deleteWeight(log.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-muted-foreground hover:text-destructive">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.section>

        {/* ── BODY MEASUREMENTS ── */}
        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-5">
              <SectionTitle icon={Ruler} label="Body Measurements" desc={`All measurements in ${units === "kg" ? "cm" : "inches"}`} />
              <button onClick={() => setShowMeasureForm(!showMeasureForm)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl gradient-bg text-primary-foreground text-xs font-bold shadow-md shadow-primary/20">
                <Plus size={13} /> Log
              </button>
            </div>

            <AnimatePresence>
              {showMeasureForm && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden mb-6">
                  <div className="p-4 rounded-2xl bg-secondary/50 border border-border space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {MEASURE_FIELDS.map(f => (
                        <div key={f.key}>
                          <label className="text-xs text-muted-foreground font-medium block mb-1">{f.label}</label>
                          <input type="number" step="0.1" placeholder={units === "kg" ? "cm" : "in"}
                            value={newMeasure[f.key] || ""}
                            onChange={e => setNewMeasure(p => ({ ...p, [f.key]: e.target.value }))}
                            className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50" />
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setShowMeasureForm(false)} className="px-4 py-2 rounded-lg text-xs bg-secondary text-muted-foreground">Cancel</button>
                      <button onClick={saveMeasurement} disabled={savingMeasure}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg gradient-bg text-primary-foreground text-xs font-bold disabled:opacity-50">
                        {savingMeasure ? <Loader2 size={12} className="animate-spin" /> : null} Save
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {latestMeasure ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {MEASURE_FIELDS.map(f => latestMeasure[f.key] ? (
                  <div key={f.key} className="px-4 py-3 rounded-xl bg-secondary/50 border border-border/50">
                    <p className="text-xs text-muted-foreground mb-1">{f.label}</p>
                    <p className="font-bold text-lg">{latestMeasure[f.key]}
                      <span className="text-xs font-normal text-muted-foreground ml-1">{units === "kg" ? "cm" : "in"}</span>
                    </p>
                    {measurements[1]?.[f.key] && (
                      <p className={`text-xs mt-0.5 font-medium ${latestMeasure[f.key] < measurements[1][f.key] ? "text-green-400" : "text-muted-foreground"}`}>
                        {latestMeasure[f.key] < measurements[1][f.key] ? "↓ " : latestMeasure[f.key] > measurements[1][f.key] ? "↑ " : ""}
                        {Math.abs(latestMeasure[f.key] - measurements[1][f.key]).toFixed(1)} from last
                      </p>
                    )}
                  </div>
                ) : null)}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
                  <Ruler size={24} className="text-primary/60" />
                </div>
                <p className="text-sm font-medium mb-1">No measurements yet</p>
                <p className="text-xs mb-3">Track your chest, waist, arms and more</p>
                <button onClick={() => setShowMeasureForm(true)} className="text-xs text-primary font-semibold flex items-center gap-1">
                  <Plus size={13} /> Add first measurement
                </button>
              </div>
            )}

            {measurements.length > 0 && (
              <p className="text-xs text-muted-foreground mt-4 text-center">
                Last logged: {new Date(measurements[0].date?.toMillis?.() ?? Date.now()).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
              </p>
            )}
          </div>
        </motion.section>

        {/* ── PROGRESS PHOTOS ── */}
        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <div className="glass-card p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <SectionTitle icon={Camera} label="Progress Photos" desc="Document your transformation visually" />
              <div className="flex items-center gap-2 flex-wrap">
                {photos.length >= 2 && (
                  <button onClick={() => setCompareMode(!compareMode)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${compareMode ? "gradient-bg text-primary-foreground shadow-md shadow-primary/20" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
                    <Image size={13} /> {compareMode ? "Exit Compare" : "Compare"}
                  </button>
                )}
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <select value={photoLabel} onChange={e => setPhotoLabel(e.target.value)}
                      className="appearance-none pl-3 pr-7 py-2 rounded-xl bg-secondary border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 cursor-pointer">
                      {PHOTO_POSES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  </div>
                  <button onClick={() => photoInputRef.current?.click()} disabled={uploadingPhoto}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl gradient-bg text-primary-foreground text-xs font-bold shadow-md shadow-primary/20 disabled:opacity-60">
                    {uploadingPhoto ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                    Upload
                  </button>
                  <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                </div>
              </div>
            </div>

            {/* Compare mode */}
            {compareMode && (
              <div className="mb-6 p-4 rounded-2xl bg-secondary/40 border border-border">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Select 2 photos to compare</p>
                <div className="grid grid-cols-2 gap-4">
                  {["A", "B"].map(side => {
                    const sel = side === "A" ? compareA : compareB;
                    return (
                      <div key={side} className="relative rounded-2xl overflow-hidden bg-secondary/60 border border-border aspect-[3/4]">
                        {sel ? (
                          <>
                            <img src={sel.photoURL} alt={sel.pose} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                            <div className="absolute bottom-2 left-2 right-2">
                              <span className="text-xs font-bold text-white">{sel.pose} · {new Date(sel.date?.toMillis?.() ?? Date.now()).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })}</span>
                            </div>
                            <button onClick={() => side === "A" ? setCompareA(null) : setCompareB(null)}
                              className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/50 flex items-center justify-center text-white">
                              <X size={12} />
                            </button>
                            <div className={`absolute top-2 left-2 px-2 py-0.5 rounded-full text-xs font-black ${side === "A" ? "bg-blue-600" : "bg-cyan-500"}`}>{side === "A" ? "BEFORE" : "AFTER"}</div>
                          </>
                        ) : (
                          <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
                            <Image size={24} className="mb-2" />
                            <p className="text-xs">{side === "A" ? "Before" : "After"}</p>
                            <p className="text-xs opacity-60">Tap a photo below</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Photo grid */}
            {photos.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {photos.map(photo => (
                  <motion.div key={photo.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                    className={`relative rounded-2xl overflow-hidden cursor-pointer group aspect-[3/4] ${compareMode ? "hover:ring-2 hover:ring-primary" : ""} ${(compareA?.id === photo.id || compareB?.id === photo.id) ? "ring-2 ring-primary" : ""}`}
                    onClick={() => {
                      if (compareMode) {
                        if (!compareA) setCompareA(photo);
                        else if (!compareB && compareA.id !== photo.id) setCompareB(photo);
                        else if (compareA?.id === photo.id) setCompareA(null);
                        else if (compareB?.id === photo.id) setCompareB(null);
                      } else {
                        setSelectedPhoto(photo);
                      }
                    }}>
                    <img src={photo.photoURL} alt={photo.pose} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                    <div className="absolute bottom-2 left-2 right-2">
                      <p className="text-xs font-bold text-white">{photo.pose}</p>
                      <p className="text-[10px] text-white/70">
                        {new Date(photo.date?.toMillis?.() ?? Date.now()).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })}
                      </p>
                    </div>
                    <button onClick={e => { e.stopPropagation(); deletePhoto(photo); }}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/80">
                      <Trash2 size={12} />
                    </button>
                    {(compareA?.id === photo.id || compareB?.id === photo.id) && (
                      <div className={`absolute top-2 left-2 px-2 py-0.5 rounded-full text-xs font-black ${compareA?.id === photo.id ? "bg-blue-600" : "bg-cyan-500"}`}>
                        {compareA?.id === photo.id ? "B" : "A"}
                      </div>
                    )}
                  </motion.div>
                ))}

                {/* Upload placeholder */}
                <button onClick={() => photoInputRef.current?.click()}
                  className="aspect-[3/4] rounded-2xl border-2 border-dashed border-border hover:border-primary/50 transition-colors flex flex-col items-center justify-center text-muted-foreground hover:text-primary group">
                  {uploadingPhoto
                    ? <Loader2 size={22} className="animate-spin mb-2" />
                    : <Plus size={22} className="mb-2 group-hover:scale-110 transition-transform" />}
                  <span className="text-xs font-medium">{uploadingPhoto ? "Uploading..." : "Add Photo"}</span>
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-14 text-muted-foreground border-2 border-dashed border-border rounded-2xl">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                  <Camera size={28} className="text-primary/60" />
                </div>
                <p className="text-sm font-medium mb-1">No photos yet</p>
                <p className="text-xs mb-4">Upload your first progress photo to start tracking visually</p>
                <button onClick={() => photoInputRef.current?.click()}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-bg text-primary-foreground text-xs font-bold shadow-lg shadow-primary/20">
                  {uploadingPhoto ? <Loader2 size={13} className="animate-spin" /> : <Camera size={14} />}
                  {uploadingPhoto ? "Uploading..." : "Upload First Photo"}
                </button>
              </div>
            )}
          </div>
        </motion.section>

        {/* ── WORKOUT VOLUME CHART ── */}
        {workoutStats.total > 0 && (
          <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <div className="glass-card p-6">
              <SectionTitle icon={BarChart3} label="Workout Stats" desc="Your training volume and frequency" />
              <div className="grid grid-cols-3 gap-4 mb-6">
                {[
                  { label: "Total Sessions", value: workoutStats.total, suffix: "" },
                  { label: "Volume Lifted", value: workoutStats.volume >= 1000 ? `${(workoutStats.volume / 1000).toFixed(1)}k` : workoutStats.volume, suffix: units },
                  { label: "Personal Records", value: workoutStats.prs, suffix: "PRs" },
                ].map(s => (
                  <div key={s.label} className="text-center py-4 rounded-2xl bg-secondary/40 border border-border/50">
                    <p className="text-2xl font-black gradient-text">{s.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{s.suffix ? `${s.suffix} · ` : ""}{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.section>
        )}

        {/* ── EXPORT / SHARE ── */}
        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
          <div className="glass-card p-6 flex flex-col sm:flex-row items-center gap-5 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-cyan-500/5 pointer-events-none" />
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-600/20">
              <Share2 size={22} className="text-white" />
            </div>
            <div className="flex-1 text-center sm:text-left">
              <p className="font-bold text-base mb-0.5">Share Your Progress</p>
              <p className="text-xs text-muted-foreground">Save or share your stats. Coming soon: auto-generated progress cards you can post anywhere.</p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={() => toast.info("Export feature coming soon!")}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-secondary border border-border hover:bg-secondary/80 transition-colors">
                <Download size={15} /> Export
              </button>
              <button
                onClick={() => toast.info("Share cards coming soon!")}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold gradient-bg text-primary-foreground shadow-lg shadow-primary/20 hover:opacity-90 transition-opacity">
                <Share2 size={15} /> Share
              </button>
            </div>
          </div>
        </motion.section>

      </div>

      {/* ── LIGHTBOX ── */}
      <AnimatePresence>
        {selectedPhoto && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex items-center justify-center p-4"
            onClick={() => setSelectedPhoto(null)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-lg w-full" onClick={e => e.stopPropagation()}>
              <img src={selectedPhoto.photoURL} alt={selectedPhoto.pose}
                className="w-full rounded-3xl object-contain max-h-[80vh]" />
              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                <div>
                  <span className="text-white font-bold text-sm">{selectedPhoto.pose}</span>
                  <p className="text-white/60 text-xs">
                    {new Date(selectedPhoto.date?.toMillis?.() ?? Date.now()).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => deletePhoto(selectedPhoto)}
                    className="p-2 rounded-xl bg-destructive/20 text-destructive hover:bg-destructive/30 transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <button onClick={() => setSelectedPhoto(null)}
                className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70 transition-colors">
                <X size={18} />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AppLayout>
  );
}
