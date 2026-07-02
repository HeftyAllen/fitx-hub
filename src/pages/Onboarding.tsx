import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { motion, AnimatePresence } from "framer-motion";
import logo from "@/assets/logo.png";
import { ChevronRight, ChevronLeft, Check, Flame, Beef, Wheat, Droplets } from "lucide-react";
import { computeTargets, PACE_OPTIONS, type WeeklyPace, type NutritionPreference } from "@/lib/nutrition";

const GOALS = [
  { id: "muscle", label: "Build Muscle", icon: "🏋️", kind: "gain" as const },
  { id: "lose", label: "Lose Weight", icon: "🔥", kind: "lose" as const },
  { id: "flex", label: "Improve Flexibility", icon: "🧘", kind: "maintain" as const },
  { id: "endurance", label: "Increase Endurance", icon: "🏃", kind: "maintain" as const },
  { id: "maintain", label: "Maintain Weight", icon: "⚖️", kind: "maintain" as const },
  { id: "general", label: "General Fitness", icon: "💪", kind: "maintain" as const },
];

const NUTRITION_PREFS: { id: NutritionPreference; label: string; sub: string }[] = [
  { id: "balanced",     label: "Balanced",      sub: "30P / 40C / 30F" },
  { id: "high-protein", label: "High Protein",  sub: "40P / 35C / 25F" },
  { id: "low-carb",     label: "Low Carb",      sub: "35P / 20C / 45F" },
  { id: "high-carb",    label: "High Carb",     sub: "25P / 55C / 20F" },
  { id: "higher-fat",   label: "Higher Fat",    sub: "25P / 30C / 45F" },
];

const DIETS = ["None", "Vegetarian", "Vegan", "Keto", "Paleo", "Gluten-Free", "Dairy-Free", "High Protein"];
const EQUIPMENT = ["Full Gym", "Home Gym", "Dumbbells Only", "Resistance Bands", "Bodyweight Only", "Outdoor"];

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState({
    name: "", dob: "", gender: "", height: "", weight: "",
    heightUnit: "cm" as "cm" | "ft", weightUnit: "kg" as "kg" | "lbs",
    goalType: "",
    weeklyPace: 0 as WeeklyPace,
    nutritionPreference: "balanced" as NutritionPreference,
    experienceLevel: "", daysPerWeek: 3, workoutDuration: 30,
    dietaryPrefs: [] as string[], equipmentAccess: [] as string[],
  });
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const totalSteps = 8;

  const update = (field: string, value: any) => setProfile((p) => ({ ...p, [field]: value }));
  const toggleArray = (field: string, val: string) => {
    const arr = (profile as any)[field] as string[];
    update(field, arr.includes(val) ? arr.filter((v: string) => v !== val) : [...arr, val]);
  };

  // Always show all pace options (lose, maintain, gain) — users can decide their direction freely.
  const visiblePaceOptions = PACE_OPTIONS;

  const maxDob = useMemo(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 16);
    return d.toISOString().split("T")[0];
  }, []);
  const age = useMemo(() => {
    if (!profile.dob) return null;
    const b = new Date(profile.dob);
    if (isNaN(b.getTime())) return null;
    const now = new Date();
    let a = now.getFullYear() - b.getFullYear();
    const m = now.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < b.getDate())) a--;
    return a;
  }, [profile.dob]);
  const ageValid = age === null ? false : age >= 16;

  const canNext = () => {
    if (step === 1) return !!(profile.name && profile.dob && profile.gender && profile.height && profile.weight) && ageValid;
    if (step === 2) return !!profile.goalType;
    if (step === 4) return !!profile.experienceLevel;
    return true;
  };

  const targets = useMemo(() => computeTargets(profile as any), [profile]);

  const handleFinish = async () => {
    if (!user) return;
    await setDoc(doc(db, "users", user.uid, "profile", "data"), {
      ...profile,
      ...targets,
      createdAt: new Date().toISOString(),
    }, { merge: true });
    await setDoc(doc(db, "users", user.uid, "streaks", "data"), {
      current: 0, best: 0, lastActiveDate: null,
    });
    await setDoc(doc(db, "users", user.uid, "xp", "data"), { total: 0, level: 1 });
    await refreshProfile();
    navigate("/dashboard", { replace: true });
  };

  const slideVariants = {
    enter: { x: 50, opacity: 0 },
    center: { x: 0, opacity: 1 },
    exit: { x: -50, opacity: 0 },
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="mb-6 h-1.5 bg-secondary rounded-full overflow-hidden">
          <motion.div
            className="h-full gradient-bg rounded-full"
            animate={{ width: `${((step + 1) / totalSteps) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        <div className="glass-card p-8">
          <AnimatePresence mode="wait">
            <motion.div key={step} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.25 }}>
              {step === 0 && (
                <div className="flex flex-col items-center gap-6 text-center py-8">
                  <motion.img src={logo} alt="FitX Journey" className="h-24 w-auto" animate={{ scale: [0.9, 1.05, 1] }} transition={{ duration: 0.8 }} />
                  <h1 className="text-3xl font-heading font-bold gradient-text">Your transformation starts here</h1>
                  <p className="text-muted-foreground">Let's set up your profile to personalise your experience</p>
                </div>
              )}

              {step === 1 && (
                <div className="space-y-4">
                  <h2 className="text-xl font-heading font-bold">Basic Profile</h2>
                  <input placeholder="Full Name" value={profile.name} onChange={(e) => update("name", e.target.value)} className="w-full px-4 py-3 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                  <input type="date" value={profile.dob} onChange={(e) => update("dob", e.target.value)} className="w-full px-4 py-3 rounded-xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                  <div className="flex gap-2">
                    {["Male", "Female", "Other"].map((g) => (
                      <button key={g} onClick={() => update("gender", g)} className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all ${profile.gender === g ? "gradient-bg text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>{g}</button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="relative">
                      <input placeholder="Height" type="number" value={profile.height} onChange={(e) => update("height", e.target.value)} className="w-full px-4 py-3 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary pr-12" />
                      <button onClick={() => update("heightUnit", profile.heightUnit === "cm" ? "ft" : "cm")} className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-primary font-medium">{profile.heightUnit}</button>
                    </div>
                    <div className="relative">
                      <input placeholder="Weight" type="number" value={profile.weight} onChange={(e) => update("weight", e.target.value)} className="w-full px-4 py-3 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary pr-12" />
                      <button onClick={() => update("weightUnit", profile.weightUnit === "kg" ? "lbs" : "kg")} className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-primary font-medium">{profile.weightUnit}</button>
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <h2 className="text-xl font-heading font-bold">Fitness Goal</h2>
                  <div className="grid grid-cols-2 gap-3">
                    {GOALS.map((g) => (
                      <button key={g.id} onClick={() => update("goalType", g.id)} className={`p-4 rounded-2xl text-left transition-all hover:scale-[1.02] ${profile.goalType === g.id ? "gradient-border bg-primary/10" : "bg-secondary hover:bg-secondary/80"}`}>
                        <span className="text-2xl">{g.icon}</span>
                        <p className="text-sm font-medium mt-2">{g.label}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-xl font-heading font-bold">Weight Goal Pace</h2>
                    <p className="text-xs text-muted-foreground mt-1">Sets your daily calorie target. Slower paces are easier to sustain.</p>
                  </div>
                  <div className="space-y-2">
                    {visiblePaceOptions.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => update("weeklyPace", opt.value)}
                        className={`w-full px-4 py-3 rounded-xl text-sm font-medium text-left transition-all flex items-center justify-between ${profile.weeklyPace === opt.value ? "gradient-bg text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
                      >
                        <span>{opt.label}</span>
                        {opt.value !== 0 && (
                          <span className="text-xs opacity-80">{opt.value < 0 ? "−" : "+"}{Math.round(Math.abs(opt.value) * 7700 / 7)} kcal/day</span>
                        )}
                      </button>
                    ))}
                  </div>

                  <div className="pt-2">
                    <h3 className="text-sm font-heading font-bold mb-2">Nutrition Preference</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {NUTRITION_PREFS.map(np => (
                        <button
                          key={np.id}
                          onClick={() => update("nutritionPreference", np.id)}
                          className={`px-3 py-2 rounded-xl text-left transition-all ${profile.nutritionPreference === np.id ? "gradient-border bg-primary/10" : "bg-secondary hover:bg-secondary/80"}`}
                        >
                          <p className="text-sm font-medium">{np.label}</p>
                          <p className="text-[10px] text-muted-foreground">{np.sub}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-6">
                  <h2 className="text-xl font-heading font-bold">Experience Level</h2>
                  <div className="flex gap-2">
                    {["Beginner", "Intermediate", "Advanced"].map((lvl) => (
                      <button key={lvl} onClick={() => update("experienceLevel", lvl)} className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all ${profile.experienceLevel === lvl ? "gradient-bg text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>{lvl}</button>
                    ))}
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-2 block">Days per week: {profile.daysPerWeek}</label>
                    <input type="range" min={1} max={7} value={profile.daysPerWeek} onChange={(e) => update("daysPerWeek", +e.target.value)} className="w-full accent-primary" />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-2 block">Workout duration</label>
                    <div className="flex gap-2">
                      {[15, 30, 45, 60].map((d) => (
                        <button key={d} onClick={() => update("workoutDuration", d)} className={`flex-1 py-2 rounded-xl text-sm ${profile.workoutDuration === d ? "gradient-bg text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>{d === 60 ? "60+" : d} min</button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {step === 5 && (
                <div className="space-y-4">
                  <h2 className="text-xl font-heading font-bold">Dietary Preferences</h2>
                  <div className="flex flex-wrap gap-2">
                    {DIETS.map((d) => (
                      <button key={d} onClick={() => toggleArray("dietaryPrefs", d)} className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${profile.dietaryPrefs.includes(d) ? "gradient-bg text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>{d}</button>
                    ))}
                  </div>
                </div>
              )}

              {step === 6 && (
                <div className="space-y-4">
                  <h2 className="text-xl font-heading font-bold">Equipment Access</h2>
                  <div className="flex flex-wrap gap-2">
                    {EQUIPMENT.map((e) => (
                      <button key={e} onClick={() => toggleArray("equipmentAccess", e)} className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${profile.equipmentAccess.includes(e) ? "gradient-bg text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>{e}</button>
                    ))}
                  </div>
                </div>
              )}

              {step === 7 && (
                <div className="space-y-5">
                  <div className="flex flex-col items-center gap-3 text-center">
                    <motion.div className="w-16 h-16 rounded-full gradient-bg flex items-center justify-center" animate={{ scale: [0.8, 1.1, 1] }} transition={{ duration: 0.5 }}>
                      <Check size={32} className="text-primary-foreground" />
                    </motion.div>
                    <h2 className="text-2xl font-heading font-bold gradient-text">Your personalised plan</h2>
                    <p className="text-muted-foreground text-sm">Calibrated to your goal of <span className="text-foreground font-semibold">{profile.goalType || "fitness"}</span></p>
                  </div>

                  <div className="rounded-2xl bg-secondary/40 border border-border p-5 flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center">
                      <Flame className="text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Daily calories</p>
                      <p className="text-3xl font-black tabular-nums">{targets.calorieTarget}</p>
                      <p className="text-[11px] text-muted-foreground">BMR {targets.bmr} · TDEE {targets.tdee}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "Protein", value: targets.protein, color: "#06b6d4", icon: Beef },
                      { label: "Carbs",   value: targets.carbs,   color: "#f59e0b", icon: Wheat },
                      { label: "Fat",     value: targets.fat,     color: "#8b5cf6", icon: Droplets },
                    ].map(m => (
                      <div key={m.label} className="rounded-2xl bg-secondary/40 border border-border p-3 text-center">
                        <m.icon size={16} style={{ color: m.color }} className="mx-auto mb-1" />
                        <p className="text-lg font-black tabular-nums" style={{ color: m.color }}>{m.value}g</p>
                        <p className="text-[10px] text-muted-foreground">{m.label}</p>
                      </div>
                    ))}
                  </div>

                  <p className="text-[11px] text-muted-foreground text-center">You can fine-tune these any time in Settings.</p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="flex justify-between mt-8">
            {step > 0 ? (
              <button onClick={() => setStep(step - 1)} className="flex items-center gap-1 px-4 py-2 rounded-xl text-sm text-muted-foreground hover:text-foreground transition-colors">
                <ChevronLeft size={16} /> Back
              </button>
            ) : <div />}
            {step < totalSteps - 1 ? (
              <button onClick={() => setStep(step + 1)} disabled={!canNext()} className="flex items-center gap-1 px-6 py-2 rounded-xl gradient-bg text-primary-foreground text-sm font-medium hover:scale-[0.98] active:scale-[0.96] transition-transform disabled:opacity-50">
                {step === 0 ? "Get Started" : "Next"} <ChevronRight size={16} />
              </button>
            ) : (
              <button onClick={handleFinish} className="px-6 py-2 rounded-xl gradient-bg text-primary-foreground text-sm font-medium hover:scale-[0.98] active:scale-[0.96] transition-transform glow-pulse">
                Enter Dashboard
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
