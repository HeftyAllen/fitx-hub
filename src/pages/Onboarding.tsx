import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { motion, AnimatePresence } from "framer-motion";
import logo from "@/assets/logo.png";
import { ChevronRight, ChevronLeft, Check } from "lucide-react";

const GOALS = [
  { id: "muscle", label: "Build Muscle", icon: "🏋️" },
  { id: "lose", label: "Lose Weight", icon: "🔥" },
  { id: "flex", label: "Improve Flexibility", icon: "🧘" },
  { id: "endurance", label: "Increase Endurance", icon: "🏃" },
  { id: "maintain", label: "Maintain Weight", icon: "⚖️" },
  { id: "general", label: "General Fitness", icon: "💪" },
];

const DIETS = ["None", "Vegetarian", "Vegan", "Keto", "Paleo", "Gluten-Free", "Dairy-Free", "High Protein"];
const EQUIPMENT = ["Full Gym", "Home Gym", "Dumbbells Only", "Resistance Bands", "Bodyweight Only", "Outdoor"];

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState({
    name: "", dob: "", gender: "", height: "", weight: "",
    heightUnit: "cm", weightUnit: "kg",
    goalType: "", experienceLevel: "", daysPerWeek: 3, workoutDuration: 30,
    dietaryPrefs: [] as string[], equipmentAccess: [] as string[],
  });
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const totalSteps = 7;

  const update = (field: string, value: any) => setProfile((p) => ({ ...p, [field]: value }));
  const toggleArray = (field: string, val: string) => {
    const arr = (profile as any)[field] as string[];
    update(field, arr.includes(val) ? arr.filter((v: string) => v !== val) : [...arr, val]);
  };

  const canNext = () => {
    if (step === 1) return profile.name && profile.dob && profile.gender;
    if (step === 2) return !!profile.goalType;
    if (step === 3) return !!profile.experienceLevel;
    return true;
  };

  const handleFinish = async () => {
    if (!user) return;
    await setDoc(doc(db, "users", user.uid, "profile", "data"), {
      ...profile,
      createdAt: new Date().toISOString(),
    });
    await setDoc(doc(db, "users", user.uid, "streaks", "data"), {
      current: 0, best: 0, lastActiveDate: null,
    });
    await setDoc(doc(db, "users", user.uid, "xp", "data"), { total: 0, level: 1 });
    await refreshProfile();
    navigate("/dashboard");
  };

  const slideVariants = {
    enter: { x: 50, opacity: 0 },
    center: { x: 0, opacity: 1 },
    exit: { x: -50, opacity: 0 },
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Progress bar */}
        <div className="mb-6 h-1.5 bg-secondary rounded-full overflow-hidden">
          <motion.div
            className="h-full gradient-bg rounded-full"
            animate={{ width: `${((step + 1) / totalSteps) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        <div className="glass-card p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25 }}
            >
              {step === 0 && (
                <div className="flex flex-col items-center gap-6 text-center py-8">
                  <motion.img
                    src={logo}
                    alt="FitX Journey"
                    className="h-24 w-auto"
                    animate={{ scale: [0.9, 1.05, 1] }}
                    transition={{ duration: 0.8 }}
                  />
                  <h1 className="text-3xl font-heading font-bold gradient-text">
                    Your transformation starts here
                  </h1>
                  <p className="text-muted-foreground">
                    Let's set up your profile to personalize your experience
                  </p>
                </div>
              )}

              {step === 1 && (
                <div className="space-y-4">
                  <h2 className="text-xl font-heading font-bold">Basic Profile</h2>
                  <input placeholder="Full Name" value={profile.name} onChange={(e) => update("name", e.target.value)} className="w-full px-4 py-3 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                  <input type="date" value={profile.dob} onChange={(e) => update("dob", e.target.value)} className="w-full px-4 py-3 rounded-xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                  <div className="flex gap-2">
                    {["Male", "Female", "Other"].map((g) => (
                      <button key={g} onClick={() => update("gender", g)} className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all ${profile.gender === g ? "gradient-bg text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
                        {g}
                      </button>
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
                <div className="space-y-6">
                  <h2 className="text-xl font-heading font-bold">Experience Level</h2>
                  <div className="flex gap-2">
                    {["Beginner", "Intermediate", "Advanced"].map((lvl) => (
                      <button key={lvl} onClick={() => update("experienceLevel", lvl)} className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all ${profile.experienceLevel === lvl ? "gradient-bg text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
                        {lvl}
                      </button>
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
                        <button key={d} onClick={() => update("workoutDuration", d)} className={`flex-1 py-2 rounded-xl text-sm ${profile.workoutDuration === d ? "gradient-bg text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
                          {d === 60 ? "60+" : d} min
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-4">
                  <h2 className="text-xl font-heading font-bold">Dietary Preferences</h2>
                  <div className="flex flex-wrap gap-2">
                    {DIETS.map((d) => (
                      <button key={d} onClick={() => toggleArray("dietaryPrefs", d)} className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${profile.dietaryPrefs.includes(d) ? "gradient-bg text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 5 && (
                <div className="space-y-4">
                  <h2 className="text-xl font-heading font-bold">Equipment Access</h2>
                  <div className="flex flex-wrap gap-2">
                    {EQUIPMENT.map((e) => (
                      <button key={e} onClick={() => toggleArray("equipmentAccess", e)} className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${profile.equipmentAccess.includes(e) ? "gradient-bg text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
                        {e}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 6 && (
                <div className="flex flex-col items-center gap-6 text-center py-8">
                  <motion.div
                    className="w-20 h-20 rounded-full gradient-bg flex items-center justify-center"
                    animate={{ scale: [0.8, 1.1, 1] }}
                    transition={{ duration: 0.5 }}
                  >
                    <Check size={40} className="text-primary-foreground" />
                  </motion.div>
                  <h2 className="text-2xl font-heading font-bold gradient-text">You're all set!</h2>
                  <p className="text-muted-foreground">Let's start your fitness journey</p>
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
