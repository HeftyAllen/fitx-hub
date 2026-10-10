import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { ArrowRight, ArrowUpRight, CalendarDays, Check, Clock, Droplets, Dumbbell, Flame, Leaf, Scale, Sparkles, Trophy, WifiOff } from "lucide-react";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { useFeatureAccess } from "@/contexts/FeatureAccessContext";
import { type FeatureId } from "@/lib/feature-access";
import FeatureSummary from "@/components/member/FeatureSummary";
import AppLayout from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useOffline } from "@/contexts/OfflineContext";
import { useChallenges } from "@/hooks/useChallenges";
import { db } from "@/lib/firebase";
import { computeTargets } from "@/lib/nutrition";
import { buildSuggestions } from "@/lib/suggestions";
import { loadWorkoutDraft } from "@/lib/offline/drafts";
import { localDay, trainingStreak, weeklyActivity, workoutDate, type MemberWorkout } from "@/lib/member-metrics";
import SyncStatus from "@/components/SyncStatus";
import { memberGreetingName } from "@/lib/member-identity";

interface Plan { id: string; name: string; days?: string[]; exercises?: { name: string; sets?: number }[] }
interface Weight { weight?: number; weightKg?: number; date?: unknown; id: string }
interface Food { calories?: number; protein?: number; carbs?: number; fat?: number }
const weekNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function Dashboard() {
  const { user, userProfile } = useAuth();
  const uid = user?.uid;
  const { online, queue } = useOffline();
  const settings = useSiteSettings();
  const { getAccess } = useFeatureAccess();
  const allowed = (id: FeatureId) => { const access = getAccess(id); return !access.loading && !access.error && access.state === "allowed"; };
  const visible = (id: FeatureId) => getAccess(id).state !== "disabled";
  const nutritionAllowed = allowed("nutrition");
  const trainingAllowed = allowed("training");
  const recordsAllowed = allowed("records");
  const progressAllowed = allowed("progress");
  const { challenges } = useChallenges(recordsAllowed);
  const [logs, setLogs] = useState<MemberWorkout[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [weights, setWeights] = useState<Weight[]>([]);
  const [recordCount, setRecordCount] = useState(0);
  const [foods, setFoods] = useState<Food[]>([]);
  const [water, setWater] = useState(0);
  const [loaded, setLoaded] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [cached, setCached] = useState<string[]>([]);
  const draft = useMemo(() => uid && trainingAllowed ? loadWorkoutDraft(uid) : null, [uid, trainingAllowed]);
  const [clock, setClock] = useState(() => new Date());
  const today = localDay(clock);
  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!user) return;
    setLogs([]); setPlans([]); setWeights([]); setFoods([]); setWater(0); setRecordCount(0); setLoaded([]); setErrors([]); setCached([]);
    const success = (key: string, fromCache: boolean) => {
      setLoaded(prev => prev.includes(key) ? prev : [...prev, key]);
      setErrors(prev => prev.filter(item => item !== key));
      setCached(prev => fromCache ? [...new Set([...prev, key])] : prev.filter(item => item !== key));
    };
    const fail = (key: string) => setErrors(prev => [...new Set([...prev, key])]);
    const unsubscribers = [
      ...(trainingAllowed ? [onSnapshot(collection(db, "users", user.uid, "workoutLogs"), { includeMetadataChanges: true }, snap => {
        setLogs(snap.docs.map(item => ({ ...item.data(), id: item.id } as MemberWorkout)).sort((a, b) => (workoutDate(b.date)?.getTime() || 0) - (workoutDate(a.date)?.getTime() || 0)));
        success("workouts", snap.metadata.fromCache);
      }, () => fail("workouts")),
      onSnapshot(collection(db, "users", user.uid, "workoutPlans"), { includeMetadataChanges: true }, snap => { setPlans(snap.docs.map(item => ({ ...item.data(), id: item.id } as Plan))); success("plans", snap.metadata.fromCache); }, () => fail("plans"))] : []),
      ...(progressAllowed ? [onSnapshot(collection(db, "users", user.uid, "weightLogs"), { includeMetadataChanges: true }, snap => { setWeights(snap.docs.map(item => ({ ...item.data(), id: item.id } as Weight)).sort((a, b) => (workoutDate(b.date ?? b.id)?.getTime() || 0) - (workoutDate(a.date ?? a.id)?.getTime() || 0))); success("weight", snap.metadata.fromCache); }, () => fail("weight"))] : []),
      ...(recordsAllowed ? [onSnapshot(collection(db, "users", user.uid, "personalRecords"), { includeMetadataChanges: true }, snap => { setRecordCount(snap.size); success("records", snap.metadata.fromCache); }, () => fail("records"))] : []),
      ...(nutritionAllowed ? [onSnapshot(doc(db, "users", user.uid, "foodLogs", today), { includeMetadataChanges: true }, snap => { setFoods(Array.isArray(snap.data()?.foods) ? snap.data()!.foods : []); setWater(Number(snap.data()?.water) || 0); success("nutrition", snap.metadata.fromCache); }, () => fail("nutrition"))] : []),
    ];
    return () => unsubscribers.forEach(stop => stop());
  }, [user, today, nutritionAllowed, trainingAllowed, progressAllowed, recordsAllowed]);
  const name = memberGreetingName(userProfile, user?.displayName);
  const hour = clock.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const week = useMemo(() => weeklyActivity(logs, new Date(`${today}T12:00:00`)), [logs, today]);
  const weeklyCount = week.reduce((sum, day) => sum + day.workouts, 0);
  const minutes = week.reduce((sum, day) => sum + day.minutes, 0);
  const streak = trainingStreak(logs, new Date(`${today}T12:00:00`));
  const trainingGoal = Math.max(1, Math.min(7, Number(userProfile?.daysPerWeek) || 3));
  const computedTargets = computeTargets(userProfile || {});
  const targets = { ...computedTargets, calorieTarget: Number(userProfile?.calorieTarget) || computedTargets.calorieTarget };
  const totals = foods.reduce((sum, food) => ({ calories: sum.calories + (Number(food.calories) || 0), protein: sum.protein + (Number(food.protein) || 0), carbs: sum.carbs + (Number(food.carbs) || 0), fat: sum.fat + (Number(food.fat) || 0) }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
  const scheduled = trainingAllowed ? plans.find(plan => plan.days?.includes(weekNames[clock.getDay()])) : undefined;
  const latestKg = weights[0]?.weightKg ?? weights[0]?.weight;
  const imperial = userProfile?.units === "imperial";
  const latestWeight = latestKg === undefined ? undefined : Math.round(Number(latestKg) * (imperial ? 2.20462 : 1) * 10) / 10;
  const joinedChallenges = challenges.filter(challenge => challenge.joined && !challenge.completed);
  const ready = (key: string, value: string | number) => loaded.includes(key) && !errors.includes(key) ? value : "—";
  const primaryTo = draft || scheduled ? "/workout-session" : "/workout-planner";
  const maxMinutes = Math.max(30, ...week.map(day => day.minutes));
  const daySteps = [
    ...(trainingAllowed ? [{ id: "training", label: "Move your body", detail: "Save a workout session", to: primaryTo, icon: Dumbbell, tone: "blue", ready: loaded.includes("workouts") && !errors.includes("workouts"), done: week.some(day => day.date === today && day.workouts > 0) }] : []),
    ...(nutritionAllowed ? [{ id: "food", label: "Fuel your day", detail: "Log a meal in your diary", to: "/nutrition", icon: Leaf, tone: "mint", ready: loaded.includes("nutrition") && !errors.includes("nutrition"), done: foods.length > 0 }, { id: "water", label: "Make time for water", detail: "Record a glass of water", to: "/nutrition", icon: Droplets, tone: "cyan", ready: loaded.includes("nutrition") && !errors.includes("nutrition"), done: water > 0 }] : []),
  ];
  const completedSteps = daySteps.filter(step => step.ready && step.done).length;
  const suggestions = buildSuggestions({
    uid: uid || null,
    profile: userProfile,
    todayPlan: scheduled || null,
    workoutLogs: trainingAllowed && loaded.includes("workouts") ? logs : [],
    todayCalories: totals.calories,
    weightHistory: progressAllowed && loaded.includes("weight") ? [...weights].reverse().flatMap(entry => {
      const date = workoutDate(entry.date ?? entry.id);
      const weightKg = Number(entry.weightKg ?? entry.weight);
      return date && weightKg > 0 ? [{ dateISO: date.toISOString(), weightKg }] : [];
    }) : [],
  }).filter(suggestion => !["nutrition-tip", "calorie-compliance"].includes(suggestion.kind) || (nutritionAllowed && loaded.includes("nutrition") && !errors.includes("nutrition")));
  return <AppLayout>
    <div className="max-w-7xl mx-auto px-4 md:px-7 lg:px-8 space-y-6 member-content-stagger">
      <div className="flex items-end justify-between gap-4">
        <div><p className="member-eyebrow">{clock.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p><h1 className="member-page-title">{greeting}{name ? `, ${name}` : ""}.</h1><p className="text-sm text-muted-foreground mt-2">{settings.dashboardSubtitle}</p>{!name && <Link to="/settings" className="text-xs text-primary inline-block mt-2">Add your name for a personal welcome →</Link>}</div>
        {visible("calendar") && <span className="hidden sm:block shrink-0"><Link to="/calendar" className="member-action secondary"><CalendarDays size={15} />Your calendar</Link></span>}
      </div>
      {(errors.length > 0 || !online) && <div className="member-card p-4 text-xs flex items-start gap-3" role="status"><WifiOff size={16} className="shrink-0 text-primary" /><span>{errors.length ? `Some data could not load: ${errors.join(", ")}. Reconnect to refresh your account.` : "You're offline. Previously loaded data is available, and completed workouts stay saved on this device until you reconnect."}</span></div>}
      <div className="grid xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)] gap-5">
        <section className="member-today-hero flex flex-col justify-between min-h-[245px]">
          <div className="member-hero-art hidden sm:block" aria-hidden="true"><div className="member-hero-ring"><Dumbbell size={39} strokeWidth={1.6} /></div><span className="member-hero-spark"><Sparkles size={19} /></span><span className="member-hero-dot" /></div>
          <div className="relative z-10"><p className="text-[10px] uppercase tracking-[.2em] member-hero-caption">{draft ? "Pick up where you left off" : scheduled ? "On your schedule today" : "Build your routine"}</p><h2 className="text-3xl sm:text-4xl font-semibold mt-4 max-w-sm !tracking-[-.04em]">{draft ? draft.plan.name : scheduled ? scheduled.name : settings.welcomeTitle}</h2><p className="text-xs member-hero-caption mt-3 max-w-sm leading-relaxed">{draft ? "Your sets and notes are saved. Continue your session whenever you're ready." : scheduled ? `${scheduled.exercises?.length || 0} exercises, one session at a time. Your training is ready when you are.` : "Create a workout that fits your day, or explore a plan from the coach library."}</p></div>
          <div className="flex flex-wrap gap-2 mt-6 relative z-10">{visible("training") && <Link to={primaryTo} state={!draft && scheduled ? { plan: scheduled } : undefined} className="member-action"><Dumbbell size={16} />{!trainingAllowed ? "Explore training" : draft ? "Resume workout" : scheduled ? "Start today's workout" : "Plan a workout"}<ArrowRight size={15} /></Link>}{visible("library") && <Link to="/library" className="member-action secondary">Explore plans<ArrowUpRight size={14} /></Link>}</div>
        </section>
        {visible("training") && (allowed("training") ? <section className="member-card member-tone-card p-6 flex flex-col justify-between" data-tone="amber">
          <div className="flex items-center justify-between"><div><p className="member-eyebrow !mb-2">This week's focus</p><h2 className="member-panel-title">Keep showing up</h2></div><span className="member-tone-icon"><Flame size={20} /></span></div>
          <div className="my-5 flex items-end justify-between"><p className="text-4xl font-semibold tracking-tight">{ready("workouts", weeklyCount)}<span className="text-lg text-muted-foreground font-normal"> / {trainingGoal}</span></p><span className="text-xs text-muted-foreground mb-1">sessions this week</span></div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden"><div className="h-full rounded-full member-tone-fill" style={{ width: `${loaded.includes("workouts") && !errors.includes("workouts") ? Math.min(100, weeklyCount / trainingGoal * 100) : 0}%` }} /></div>
          <div className="flex items-center justify-between mt-4"><p className="text-xs text-muted-foreground">{loaded.includes("workouts") && !errors.includes("workouts") && weeklyCount >= trainingGoal ? "Your weekly target is complete." : "Your pace. Your progress."}</p><Link to="/settings?section=prefs" aria-label="Edit weekly training target" className="text-xs text-primary">Edit target</Link></div>
        </section> : <FeatureSummary feature="training" />)}
      </div>
      <section className="grid grid-cols-2 xl:grid-cols-4 gap-3" aria-label="Your recorded progress">
        {[{ feature: "training" as FeatureId, tone: "blue", label: "Training time", value: ready("workouts", minutes), unit: "min", detail: "This week", icon: Clock }, { feature: "training" as FeatureId, tone: "amber", label: "Training streak", value: ready("workouts", streak), unit: "days", detail: "Consecutive training days", icon: Flame }, { feature: "progress" as FeatureId, tone: "violet", label: "Latest weight", value: ready("weight", latestWeight ?? "—"), unit: imperial ? "lbs" : "kg", detail: weights.length ? "Latest recorded entry" : "Log your first entry", icon: Scale }, { feature: "records" as FeatureId, tone: "rose", label: "Personal records", value: ready("records", recordCount), unit: "", detail: "Your all-time achievements", icon: Trophy }].filter(item => allowed(item.feature)).map(item => <article key={item.label} data-tone={item.tone} className="member-card member-data-tile member-tone-card"><div className="flex items-center justify-between gap-2"><p className="text-xs text-muted-foreground">{item.label}</p><span className="member-tone-icon !h-8 !w-8 !rounded-lg"><item.icon size={16} /></span></div><p className="text-2xl sm:text-3xl font-semibold tracking-tight mt-4">{item.value}<span className="text-xs font-normal text-muted-foreground ml-1.5">{item.unit}</span></p><p className="text-[10px] text-muted-foreground mt-2">{item.detail}</p></article>)}
      </section>
      {daySteps.length > 0 && <section className="member-card p-5 sm:p-6" aria-label="Today check-in"><div className="flex flex-wrap justify-between gap-3 mb-4"><div><h2 className="member-panel-title">Small steps, a better day.</h2><p className="text-xs text-muted-foreground mt-1">Your check-in updates from your saved activity.</p></div><span className="member-checkin-count">{daySteps.every(step => step.ready) ? `${completedSteps} / ${daySteps.length} complete` : "Loading your check-in…"}</span></div><div className="grid sm:grid-cols-3 gap-3">{daySteps.map(step => <Link key={step.id} to={step.to} state={step.id === "training" && !draft && scheduled ? { plan: scheduled } : undefined} data-tone={step.tone} aria-label={`${step.label}: ${step.ready ? step.done ? "complete" : "not yet logged" : "awaiting data"}`} className={`member-checkin-step ${step.ready && step.done ? "is-done" : ""}`}><span className="member-tone-icon"><step.icon size={18} /></span><span className="min-w-0 flex-1"><strong className="block text-xs">{step.label}</strong><span className="block text-[10px] text-muted-foreground mt-1">{step.ready && step.done ? "Logged today · Nice work" : step.detail}</span></span>{step.ready && step.done ? <Check size={16} className="member-tone-text" /> : <ArrowUpRight size={14} className="text-muted-foreground shrink-0" />}</Link>)}</div></section>}
      <div className="grid xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)] gap-5">
        {visible("training") && (allowed("training") ? <section className="member-card p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3"><div><p className="member-eyebrow !mb-2">A week in motion</p><h2 className="member-panel-title">Your training rhythm</h2><p className="text-xs text-muted-foreground mt-1">Minutes from your saved workout sessions</p></div>{visible("calendar") && <Link to="/calendar" className="text-xs text-primary flex items-center gap-1">View all<ArrowUpRight size={14} /></Link>}</div>
          <div className="grid grid-cols-7 gap-2 mt-6" role="img" aria-label={week.map(day => `${day.day}: ${day.minutes} minutes`).join(", ")}>
            {week.map(day => <div key={day.day} className="text-center min-w-0"><div className="h-[120px] flex flex-col justify-end items-center"><span className="text-[10px] text-muted-foreground mb-2">{day.minutes || ""}</span><div className={`member-training-bar ${day.date === today ? "today" : ""}`} style={{ height: `${Math.max(4, day.minutes / maxMinutes * 92)}px` }} /></div><p className={`text-[10px] mt-3 ${day.date === today ? "text-primary font-semibold" : "text-muted-foreground"}`}>{day.day}</p></div>)}
          </div>
          <p className="text-[10px] text-muted-foreground border-t border-border pt-4 mt-5">{ready("workouts", weeklyCount)} sessions recorded this week{cached.includes("workouts") ? " · showing device cache" : ""}</p>
        </section> : <FeatureSummary feature="training" />)}
        {visible("nutrition") && (allowed("nutrition") ? <section className="member-card member-tone-card p-5 sm:p-6" data-tone="mint">
          <div className="flex items-start justify-between"><div><p className="member-eyebrow !mb-2">Fuel your day</p><h2 className="member-panel-title">Today's nutrition</h2></div><span className="member-tone-icon"><Leaf size={18} /></span></div>
          <div className="mt-5 flex justify-between items-end"><p className="text-3xl font-semibold tracking-tight">{ready("nutrition", Math.round(totals.calories))}<span className="text-xs text-muted-foreground font-normal ml-2">kcal logged</span></p><span className="text-[10px] text-muted-foreground">/ {targets.calorieTarget.toLocaleString()}</span></div>
          <div className="h-1.5 bg-secondary rounded-full overflow-hidden mt-3"><div className="h-full member-tone-fill rounded-full" style={{ width: `${Math.min(100, totals.calories / targets.calorieTarget * 100)}%` }} /></div>
          <div className="grid grid-cols-3 gap-2 mt-5">{[{ label: "Protein", value: totals.protein }, { label: "Carbs", value: totals.carbs }, { label: "Fat", value: totals.fat }].map(item => <div key={item.label}><p className="text-[10px] text-muted-foreground">{item.label}</p><p className="text-sm font-semibold mt-1">{ready("nutrition", Math.round(item.value))}<span className="font-normal text-muted-foreground"> g</span></p></div>)}</div>
          <div className="flex items-center justify-between mt-5 border-t border-border pt-4"><p className="text-xs text-muted-foreground">{ready("nutrition", water)} glasses of water logged</p><Link to="/nutrition" className="text-xs text-primary font-semibold">Open food diary<ArrowRight size={13} className="inline ml-1" /></Link></div>
        </section> : <FeatureSummary feature="nutrition" />)}
        {visible("training") && (allowed("training") ? <section className="member-card p-5 sm:p-6">
          <div className="flex items-center justify-between mb-5"><h2 className="member-panel-title">Recent sessions</h2>{visible("calendar") && <Link to="/calendar" className="text-xs text-primary">History<ArrowUpRight size={13} className="inline ml-1" /></Link>}</div>
          {!loaded.includes("workouts") ? <p className="text-sm text-muted-foreground py-5">Loading your sessions…</p> : logs.length === 0 ? <div className="rounded-xl bg-secondary/50 p-5"><Dumbbell size={22} className="text-primary mb-3" /><p className="text-sm font-semibold">Your first session starts here.</p><p className="text-xs text-muted-foreground mt-1 mb-4">Completed workouts will appear in your history.</p><Link to="/workout-planner" className="text-xs text-primary">Choose a workout<ArrowRight size={14} className="inline ml-1" /></Link></div> : <div className="space-y-3">{logs.slice(0, 3).map(log => <div key={log.id} className="flex items-center gap-3 py-2"><span className="w-10 h-10 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0"><Check size={17} /></span><div className="flex-1 min-w-0"><p className="text-xs font-semibold truncate">{log.planName || "Workout"}</p><p className="text-[10px] text-muted-foreground mt-1">{workoutDate(log.date)?.toLocaleDateString(undefined, { month: "short", day: "numeric" }) || "Date unavailable"}</p></div><span className="text-xs text-muted-foreground">{Math.round((log.duration || 0) / 60)} min</span></div>)}</div>}
        </section> : <FeatureSummary feature="training" />)}
        {visible("records") && (allowed("records") ? <section className="member-card member-tone-card p-5 sm:p-6" data-tone="violet">
          <div className="flex items-center justify-between mb-5"><h2 className="member-panel-title">A little extra motivation</h2><span className="member-tone-icon"><Trophy size={18} /></span></div>
          {joinedChallenges.length ? joinedChallenges.slice(0, 2).map(challenge => <div key={challenge.id} className="mb-4"><div className="flex justify-between gap-3 text-xs"><p>{challenge.icon} {challenge.name}</p><span className="text-muted-foreground">{Math.min(challenge.progress, challenge.target)}/{challenge.target}</span></div><div className="mt-2 h-1.5 bg-secondary rounded-full overflow-hidden"><div className="h-full bg-primary" style={{ width: `${Math.min(100, challenge.progress / challenge.target * 100)}%` }} /></div></div>) : <p className="text-xs text-muted-foreground leading-relaxed mb-5">Pick a challenge and turn small wins into a routine. Your recorded sessions track your progress.</p>}
          <Link to="/records" className="member-action secondary w-full">Explore challenges<ArrowRight size={14} /></Link>
        </section> : <FeatureSummary feature="records" />)}
      </div>
      <section aria-label="Personalised suggestions">
        <div className="mb-4"><p className="member-eyebrow !mb-2">A little guidance</p><h2 className="member-panel-title">Smart suggestions</h2></div>
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">{suggestions.map(suggestion => {
          const Icon = suggestion.kind === "motivation" ? Sparkles : ["nutrition-tip", "calorie-compliance"].includes(suggestion.kind) ? Leaf : suggestion.kind === "plateau" ? Scale : suggestion.kind === "recovery-alert" ? Clock : Flame;
          const tone = Icon === Sparkles ? "violet" : Icon === Leaf ? "mint" : Icon === Scale ? "rose" : Icon === Clock ? "blue" : "amber";
          return <article key={suggestion.id} data-tone={tone} className="member-card member-tone-card p-5"><span className="member-tone-icon"><Icon size={20} aria-hidden="true" /></span><h3 className="text-sm font-semibold mt-3">{suggestion.title}</h3><p className="text-xs text-muted-foreground leading-relaxed mt-2">{suggestion.body}</p>{suggestion.kind === "burn-prediction" && <p className="text-[10px] text-muted-foreground mt-3">Estimated from your plan; actual energy use varies.</p>}</article>;
        })}</div>
      </section>
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2"><p className="text-[10px] text-muted-foreground">{queue.length ? `${queue.length} workout${queue.length > 1 ? "s" : ""} saved on this device and awaiting sync.` : "A steady routine is built one day at a time."}</p><SyncStatus /></div>
    </div>
  </AppLayout>;
}
