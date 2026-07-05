import { useMemo, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lock, Zap, Star, Trophy, Target, CheckCircle2, TrendingUp,
  ChevronRight, Flame, Crown, Sparkles, Medal,
} from "lucide-react";
import { useChallenges } from "@/hooks/useChallenges";
import { Link } from "react-router-dom";

const BADGES = [
  { id: "firstworkout", name: "First Steps",       desc: "Complete your first workout",  icon: "👟", challengeId: "first-workout",  category: "workouts" },
  { id: "5workouts",    name: "Iron Week",         desc: "Complete 5 workouts",          icon: "🏋️", challengeId: "5-workouts",     category: "workouts" },
  { id: "10workouts",   name: "Dedicated Athlete", desc: "Complete 10 workouts",         icon: "🎯", challengeId: "10-workouts",    category: "workouts" },
  { id: "30workouts",   name: "30 Workouts Club",  desc: "Complete 30 workouts",         icon: "🏅", challengeId: "30-workouts",    category: "workouts" },
  { id: "7day",         name: "7-Day Warrior",     desc: "Work out 7 days in a row",     icon: "🔥", challengeId: "7day-streak",    category: "streaks" },
  { id: "30day",        name: "30-Day Legend",     desc: "30-day workout streak",        icon: "🏆", challengeId: "30day-streak",   category: "streaks" },
  { id: "firstpr",      name: "PR Setter",         desc: "Set your first personal record", icon: "💪", challengeId: "first-pr",      category: "records" },
  { id: "5prs",         name: "Record Breaker",    desc: "Set 5 personal records",       icon: "💫", challengeId: "5-prs",          category: "records" },
  { id: "10k",          name: "10K Club",          desc: "Lift 10,000 kg total volume",  icon: "⚡", challengeId: "volume-10k",     category: "volume" },
  { id: "100k",         name: "Volume King",       desc: "Lift 100,000 kg total",        icon: "👑", challengeId: "volume-100k",    category: "volume" },
];

const CATEGORIES = [
  { id: "all",      label: "All"       },
  { id: "workouts", label: "Workouts"  },
  { id: "streaks",  label: "Streaks"   },
  { id: "records",  label: "Records"   },
  { id: "volume",   label: "Volume"    },
];

const TIERS = [
  { min: 0,     name: "Rookie",      icon: Star,     color: "from-slate-400 to-slate-600"     },
  { min: 500,   name: "Challenger",  icon: Flame,    color: "from-orange-400 to-red-500"      },
  { min: 1500,  name: "Warrior",     icon: Medal,    color: "from-amber-400 to-yellow-500"    },
  { min: 3000,  name: "Legend",      icon: Trophy,   color: "from-fuchsia-400 to-pink-500"    },
  { min: 5000,  name: "Champion",    icon: Sparkles, color: "from-cyan-400 to-blue-500"       },
  { min: 8000,  name: "Elite",       icon: Crown,    color: "from-violet-400 to-purple-600"   },
  { min: 12000, name: "Grandmaster", icon: Crown,    color: "from-yellow-300 to-amber-500"    },
];

function tierFor(xp: number) {
  let cur = TIERS[0], next: typeof TIERS[number] | null = null;
  for (let i = 0; i < TIERS.length; i++) {
    if (xp >= TIERS[i].min) { cur = TIERS[i]; next = TIERS[i + 1] ?? null; }
  }
  return { cur, next };
}

export default function Rewards() {
  const { challenges, loading } = useChallenges();
  const [cat, setCat] = useState<string>("all");

  const completedChallengeIds = new Set(challenges.filter(c => c.completed).map(c => c.id));
  const earnedBadges = BADGES.filter(b => completedChallengeIds.has(b.challengeId));
  const lockedBadges = BADGES.filter(b => !completedChallengeIds.has(b.challengeId));

  const totalXp = challenges.filter(c => c.completed).reduce((s, c) => s + c.xpReward, 0);
  const { cur: currentTier, next: nextTier } = tierFor(totalXp);
  const level = Math.floor(totalXp / 500) + 1;
  const xpIntoLevel = totalXp % 500;
  const tierPct = nextTier
    ? Math.min(100, ((totalXp - currentTier.min) / (nextTier.min - currentTier.min)) * 100)
    : 100;
  const xpToNextTier = nextTier ? nextTier.min - totalXp : 0;

  const activeChallenges = challenges.filter(c => c.joined && !c.completed);
  const completedChallenges = challenges.filter(c => c.completed);

  const filteredEarned = useMemo(
    () => cat === "all" ? earnedBadges : earnedBadges.filter(b => b.category === cat),
    [cat, earnedBadges]
  );
  const filteredLocked = useMemo(
    () => cat === "all" ? lockedBadges : lockedBadges.filter(b => b.category === cat),
    [cat, lockedBadges]
  );

  const TierIcon = currentTier.icon;

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6 pb-24">

        {/* ── HERO / TIER CARD ────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
          className="relative rounded-3xl overflow-hidden border border-white/10 p-6 md:p-8 isolate"
        >
          {/* animated aurora */}
          <div className={`absolute inset-0 bg-gradient-to-br ${currentTier.color} opacity-20`} />
          <motion.div
            aria-hidden
            className="absolute -top-40 -right-32 w-[420px] h-[420px] rounded-full blur-3xl opacity-40"
            style={{ background: "radial-gradient(circle, hsl(var(--primary)) 0%, transparent 65%)" }}
            animate={{ x: [0, 30, 0], y: [0, 20, 0] }}
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            aria-hidden
            className="absolute -bottom-40 -left-32 w-[420px] h-[420px] rounded-full blur-3xl opacity-30"
            style={{ background: "radial-gradient(circle, hsl(var(--accent)) 0%, transparent 65%)" }}
            animate={{ x: [0, -25, 0], y: [0, -15, 0] }}
            transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/70 via-background/20 to-transparent" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-6">
            {/* Tier medallion */}
            <motion.div
              initial={{ scale: 0.7, rotate: -12, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 180, damping: 14 }}
              className="relative flex-shrink-0 mx-auto md:mx-0"
            >
              <div className={`w-28 h-28 rounded-3xl bg-gradient-to-br ${currentTier.color} p-[2px] shadow-2xl shadow-primary/30`}>
                <div className="w-full h-full rounded-3xl bg-background/80 backdrop-blur flex items-center justify-center relative overflow-hidden">
                  <motion.div
                    aria-hidden
                    className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent"
                    animate={{ opacity: [0.15, 0.35, 0.15] }}
                    transition={{ duration: 3, repeat: Infinity }}
                  />
                  <TierIcon size={44} className="text-foreground relative z-10 drop-shadow-lg" />
                </div>
              </div>
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-background border border-border text-[10px] font-black uppercase tracking-widest">
                Lv {level}
              </div>
            </motion.div>

            {/* Text + progress */}
            <div className="flex-1 min-w-0 text-center md:text-left">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-1">Current tier</p>
              <h1 className="text-3xl md:text-4xl font-black bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent leading-none">
                {currentTier.name}
              </h1>
              <p className="text-xs text-muted-foreground mt-2">
                {nextTier
                  ? <>Earn <span className="text-foreground font-bold">{xpToNextTier.toLocaleString()} XP</span> more to reach <span className="text-foreground font-bold">{nextTier.name}</span></>
                  : <>You've reached the highest tier — legendary.</>}
              </p>

              <div className="mt-4 space-y-1.5">
                <div className="h-2.5 rounded-full bg-background/60 border border-white/10 overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full bg-gradient-to-r ${currentTier.color} relative`}
                    initial={{ width: 0 }} animate={{ width: `${tierPct}%` }}
                    transition={{ duration: 1.2, ease: "easeOut" }}
                  >
                    <motion.div
                      aria-hidden
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent"
                      animate={{ x: ["-100%", "200%"] }}
                      transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}
                    />
                  </motion.div>
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground font-medium">
                  <span>{totalXp.toLocaleString()} XP</span>
                  <span>{nextTier ? `${nextTier.min.toLocaleString()} XP` : "MAX"}</span>
                </div>
              </div>
            </div>

            {/* Right stats stack */}
            <div className="flex md:flex-col gap-3 md:gap-2 md:pl-4 md:border-l md:border-white/10">
              <div className="flex-1 md:flex-none text-center md:text-right">
                <p className="text-3xl font-black bg-gradient-to-br from-primary to-accent bg-clip-text text-transparent leading-none">
                  {earnedBadges.length}
                </p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">Badges</p>
              </div>
              <div className="flex-1 md:flex-none text-center md:text-right">
                <p className="text-3xl font-black text-foreground leading-none">{xpIntoLevel}<span className="text-sm text-muted-foreground">/500</span></p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">Level XP</p>
              </div>
            </div>
          </div>
        </motion.section>

        {/* ── TIER LADDER ─────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="glass-card p-4 rounded-2xl"
        >
          <div className="flex items-center justify-between mb-3 px-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Tier Ladder</p>
            <p className="text-[11px] text-muted-foreground">{totalXp.toLocaleString()} XP</p>
          </div>
          <div className="flex items-stretch gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {TIERS.map((t, i) => {
              const reached = totalXp >= t.min;
              const isCurrent = t.name === currentTier.name;
              const Icon = t.icon;
              return (
                <div
                  key={t.name}
                  className={`flex-1 min-w-[92px] rounded-xl p-3 text-center transition-all ${
                    isCurrent ? "bg-gradient-to-br " + t.color + " shadow-lg" :
                    reached   ? "bg-secondary/60 border border-white/5" :
                                "bg-secondary/20 border border-dashed border-white/5 opacity-50"
                  }`}
                >
                  <Icon size={16} className={`mx-auto mb-1.5 ${isCurrent ? "text-white" : reached ? "text-foreground" : "text-muted-foreground"}`} />
                  <p className={`text-[10px] font-bold ${isCurrent ? "text-white" : "text-foreground"}`}>{t.name}</p>
                  <p className={`text-[9px] mt-0.5 ${isCurrent ? "text-white/80" : "text-muted-foreground"}`}>{t.min.toLocaleString()}</p>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* ── QUICK STATS ─────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: Trophy, label: "Completed", value: completedChallenges.length, tint: "from-amber-400/20 to-amber-600/5",  fg: "text-amber-400" },
            { icon: Target, label: "Active",    value: activeChallenges.length,    tint: "from-primary/20 to-primary/5",       fg: "text-primary"  },
            { icon: Zap,    label: "Total XP",  value: totalXp.toLocaleString(),   tint: "from-accent/20 to-accent/5",         fg: "text-accent"   },
          ].map(({ icon: Icon, label, value, tint, fg }, i) => (
            <motion.div key={label}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }}
              className="relative rounded-2xl p-4 overflow-hidden border border-white/10 bg-card/40 backdrop-blur">
              <div className={`absolute inset-0 bg-gradient-to-br ${tint}`} />
              <div className="relative z-10">
                <Icon size={16} className={fg} />
                <p className="text-xl font-black mt-2 leading-none">{value}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">{label}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* ── ACTIVE CHALLENGES ───────────────────────────────────── */}
        {activeChallenges.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">In Progress</h2>
              <Link to="/records" className="text-xs text-primary hover:underline flex items-center gap-1">
                Manage <ChevronRight size={12} />
              </Link>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {activeChallenges.slice(0, 6).map((c, i) => {
                const pct = Math.min((c.progress / c.target) * 100, 100);
                return (
                  <motion.div key={c.id}
                    initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                    className="glass-card p-4 rounded-2xl flex items-center gap-3 hover:border-white/20 transition-colors">
                    <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${c.color} flex items-center justify-center text-xl flex-shrink-0 shadow-lg`}>
                      {c.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-bold truncate">{c.name}</p>
                        <span className="text-xs font-black text-primary ml-2">{Math.round(pct)}%</span>
                      </div>
                      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                        <motion.div className={`h-full bg-gradient-to-r ${c.color} rounded-full`}
                          initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1 }} />
                      </div>
                      <div className="flex items-center justify-between mt-1.5">
                        <p className="text-[10px] text-muted-foreground">
                          {c.progress.toLocaleString()} / {c.target.toLocaleString()} {c.targetLabel}
                        </p>
                        <span className="flex items-center gap-0.5 text-[10px] text-warning font-bold">
                          <Zap size={10} /> {c.xpReward}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── BADGE CABINET ───────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-lg font-black">Badge Cabinet</h2>
              <p className="text-xs text-muted-foreground">
                {earnedBadges.length} of {BADGES.length} unlocked
              </p>
            </div>
            <div className="flex items-center gap-1 p-1 rounded-full bg-secondary/60 border border-white/5 overflow-x-auto max-w-full">
              {CATEGORIES.map(c => (
                <button key={c.id} onClick={() => setCat(c.id)}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all ${
                    cat === c.id
                      ? "bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-md shadow-primary/30"
                      : "text-muted-foreground hover:text-foreground"
                  }`}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Earned */}
          {filteredEarned.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <AnimatePresence mode="popLayout">
                {filteredEarned.map((badge, i) => (
                  <motion.div key={badge.id}
                    layout
                    initial={{ opacity: 0, scale: 0.85, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                    transition={{ delay: i * 0.04, type: "spring", stiffness: 200, damping: 18 }}
                    whileHover={{ y: -4 }}
                    className="relative rounded-2xl p-4 text-center overflow-hidden border border-primary/20 bg-gradient-to-br from-primary/10 via-card/80 to-accent/10 backdrop-blur group cursor-pointer"
                  >
                    {/* shine sweep */}
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <motion.div
                        className="absolute inset-y-0 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-white/25 to-transparent skew-x-12"
                        animate={{ x: ["0%", "300%"] }}
                        transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
                      />
                    </div>
                    <div className="absolute top-2 right-2 z-10">
                      <div className="w-5 h-5 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center">
                        <CheckCircle2 size={11} className="text-green-400" />
                      </div>
                    </div>
                    <motion.div
                      className="text-4xl mb-2 relative z-10"
                      animate={{ y: [0, -3, 0] }}
                      transition={{ duration: 3 + i * 0.2, repeat: Infinity, ease: "easeInOut" }}
                    >
                      {badge.icon}
                    </motion.div>
                    <p className="text-xs font-black relative z-10">{badge.name}</p>
                    <p className="text-[10px] text-muted-foreground mt-1 relative z-10">{badge.desc}</p>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}

          {filteredEarned.length === 0 && cat !== "all" && (
            <div className="text-center py-8 text-xs text-muted-foreground border border-dashed border-white/10 rounded-2xl">
              No badges earned in this category yet.
            </div>
          )}

          {/* Locked */}
          {filteredLocked.length > 0 && (
            <>
              <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground pt-2">
                Locked · {filteredLocked.length}
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {filteredLocked.map((badge, i) => {
                  const challenge = challenges.find(c => c.id === badge.challengeId);
                  const pct = challenge ? Math.min((challenge.progress / challenge.target) * 100, 100) : 0;
                  const started = pct > 0;
                  return (
                    <motion.div key={badge.id}
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                      whileHover={{ y: -3 }}
                      className="relative rounded-2xl p-4 text-center border border-white/5 bg-card/40 backdrop-blur overflow-hidden group"
                    >
                      <div className="text-4xl mb-2 grayscale opacity-40 group-hover:opacity-60 transition-opacity">
                        {badge.icon}
                      </div>
                      <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-secondary/80 border border-white/10 flex items-center justify-center">
                        <Lock size={10} className="text-muted-foreground" />
                      </div>
                      <p className="text-xs font-bold text-muted-foreground">{badge.name}</p>
                      <p className="text-[10px] text-muted-foreground/70 mt-1 line-clamp-2">{badge.desc}</p>
                      {started ? (
                        <div className="mt-2.5">
                          <div className="h-1 bg-secondary rounded-full overflow-hidden">
                            <motion.div className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
                              initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8 }} />
                          </div>
                          <p className="text-[9px] text-primary font-bold mt-1">{Math.round(pct)}% there</p>
                        </div>
                      ) : (
                        <p className="text-[9px] text-muted-foreground/60 mt-2 uppercase tracking-wider">Not started</p>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* ── CTA ─────────────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
          <Link to="/records"
            className="relative flex items-center justify-between p-5 rounded-2xl overflow-hidden border border-white/10 group hover:border-primary/40 transition-colors">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-accent/10 opacity-70" />
            <motion.div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-r from-primary/20 to-accent/20 opacity-0 group-hover:opacity-100 transition-opacity"
            />
            <div className="relative z-10 flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/30">
                <TrendingUp size={18} className="text-primary-foreground" />
              </div>
              <div>
                <p className="text-sm font-bold">Explore Challenges</p>
                <p className="text-xs text-muted-foreground">Join new challenges to earn more XP and badges</p>
              </div>
            </div>
            <ChevronRight size={20} className="relative z-10 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all" />
          </Link>
        </motion.div>

        {loading && (
          <p className="text-center text-xs text-muted-foreground">Loading challenges…</p>
        )}
      </div>
    </AppLayout>
  );
}
