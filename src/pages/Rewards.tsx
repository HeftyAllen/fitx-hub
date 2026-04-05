import AppLayout from "@/components/layout/AppLayout";
import { motion } from "framer-motion";
import { Lock, Award, Zap, Star, Trophy, Target, CheckCircle2, TrendingUp, ChevronRight } from "lucide-react";
import { useChallenges } from "@/hooks/useChallenges";
import { Link } from "react-router-dom";

const BADGES = [
  { id: "7day", name: "7-Day Warrior", desc: "Work out 7 days in a row", icon: "🔥", challengeId: "7day-streak" },
  { id: "30day", name: "30-Day Legend", desc: "30-day workout streak", icon: "🏆", challengeId: "30day-streak" },
  { id: "firstpr", name: "PR Setter", desc: "Set your first personal record", icon: "💪", challengeId: "first-pr" },
  { id: "5prs", name: "Record Breaker", desc: "Set 5 personal records", icon: "💫", challengeId: "5-prs" },
  { id: "5workouts", name: "Iron Week", desc: "Complete 5 workouts", icon: "🏋️", challengeId: "5-workouts" },
  { id: "10workouts", name: "Dedicated Athlete", desc: "Complete 10 workouts", icon: "🎯", challengeId: "10-workouts" },
  { id: "30workouts", name: "30 Workouts Club", desc: "Complete 30 workouts", icon: "🏅", challengeId: "30-workouts" },
  { id: "10k", name: "10K Club", desc: "Lift 10,000 kg total volume", icon: "⚡", challengeId: "volume-10k" },
  { id: "100k", name: "Volume King", desc: "Lift 100,000 kg total", icon: "👑", challengeId: "volume-100k" },
  { id: "firstworkout", name: "First Steps", desc: "Complete your first workout", icon: "👟", challengeId: "first-workout" },
];

const LEVEL_NAMES = ["Beginner", "Rookie", "Athlete", "Challenger", "Warrior", "Legend", "Champion", "Elite", "Master", "Grandmaster"];

export default function Rewards() {
  const { challenges, loading } = useChallenges();

  const completedChallengeIds = new Set(challenges.filter(c => c.completed).map(c => c.id));
  const earnedBadges = BADGES.filter(b => completedChallengeIds.has(b.challengeId));
  const lockedBadges = BADGES.filter(b => !completedChallengeIds.has(b.challengeId));

  const totalXp = challenges.filter(c => c.completed).reduce((s, c) => s + c.xpReward, 0);
  const level = Math.floor(totalXp / 500) + 1;
  const xpProgress = totalXp % 500;
  const levelName = LEVEL_NAMES[Math.min(level - 1, LEVEL_NAMES.length - 1)];

  const activeChallenges = challenges.filter(c => c.joined && !c.completed);
  const completedChallenges = challenges.filter(c => c.completed);

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-heading font-bold gradient-text">Rewards</h1>
          <p className="text-xs text-muted-foreground mt-1">Your achievements and progress</p>
        </div>

        {/* Level card */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="glass-card p-6 rounded-2xl relative overflow-hidden">
          <div className="absolute inset-0 opacity-5 bg-gradient-to-br from-primary to-accent" />
          <div className="relative z-10 flex items-center gap-5">
            <div className="w-16 h-16 rounded-2xl gradient-bg flex items-center justify-center shadow-lg shadow-primary/20 flex-shrink-0">
              <Star size={28} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">Level {level}</p>
              <h2 className="text-2xl font-heading font-bold gradient-text">{levelName}</h2>
              <div className="mt-2 h-2 bg-secondary rounded-full overflow-hidden max-w-xs">
                <motion.div className="h-full gradient-bg rounded-full"
                  initial={{ width: 0 }} animate={{ width: `${(xpProgress / 500) * 100}%` }}
                  transition={{ duration: 1, ease: "easeOut" }} />
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">{totalXp.toLocaleString()} / {(level * 500).toLocaleString()} XP</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold gradient-text">{earnedBadges.length}</p>
              <p className="text-xs text-muted-foreground">Badges Earned</p>
            </div>
          </div>
        </motion.div>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: Trophy, label: "Completed", value: completedChallenges.length, color: "text-warning bg-warning/15" },
            { icon: Target, label: "Active", value: activeChallenges.length, color: "text-primary bg-primary/15" },
            { icon: Zap, label: "Total XP", value: `${totalXp.toLocaleString()}`, color: "text-accent bg-accent/15" },
          ].map(({ icon: Icon, label, value, color }) => (
            <motion.div key={label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="glass-card p-4 rounded-2xl text-center">
              <div className={`w-8 h-8 rounded-xl ${color} flex items-center justify-center mx-auto mb-2`}>
                <Icon size={16} />
              </div>
              <p className="text-lg font-bold">{value}</p>
              <p className="text-[10px] text-muted-foreground">{label}</p>
            </motion.div>
          ))}
        </div>

        {/* Active challenges */}
        {activeChallenges.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-heading font-bold uppercase tracking-wider text-muted-foreground">Active Challenges</h2>
              <Link to="/records" className="text-xs text-primary hover:underline flex items-center gap-1">
                Manage <ChevronRight size={12} />
              </Link>
            </div>
            <div className="space-y-2">
              {activeChallenges.slice(0, 4).map((c, i) => {
                const pct = Math.min((c.progress / c.target) * 100, 100);
                return (
                  <motion.div key={c.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="glass-card p-4 rounded-2xl flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${c.color} flex items-center justify-center text-xl flex-shrink-0`}>
                      {c.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium">{c.name}</p>
                        <span className="text-xs text-primary font-medium">{Math.round(pct)}%</span>
                      </div>
                      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                        <motion.div className={`h-full bg-gradient-to-r ${c.color} rounded-full`}
                          initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                          transition={{ duration: 1 }} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {c.progress.toLocaleString()} / {c.target.toLocaleString()} {c.targetLabel}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
                      <Zap size={11} className="text-warning" />
                      {c.xpReward}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {/* Earned badges */}
        {earnedBadges.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-heading font-bold uppercase tracking-wider text-muted-foreground">Earned Badges</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {earnedBadges.map((badge, i) => (
                <motion.div key={badge.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className="glass-card p-4 text-center rounded-2xl border-green-500/20 relative overflow-hidden">
                  <div className="absolute top-2 right-2">
                    <CheckCircle2 size={14} className="text-green-400" />
                  </div>
                  <div className="text-3xl mb-2">{badge.icon}</div>
                  <p className="text-xs font-heading font-bold">{badge.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">{badge.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Locked badges */}
        <div className="space-y-3">
          <h2 className="text-sm font-heading font-bold uppercase tracking-wider text-muted-foreground">
            Locked Badges {lockedBadges.length > 0 && `(${lockedBadges.length})`}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {lockedBadges.map((badge, i) => {
              const challenge = challenges.find(c => c.id === badge.challengeId);
              const pct = challenge ? Math.min((challenge.progress / challenge.target) * 100, 100) : 0;
              return (
                <motion.div key={badge.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="glass-card p-4 text-center rounded-2xl opacity-60">
                  <Lock size={24} className="mx-auto mb-2 text-muted-foreground" />
                  <p className="text-xs font-heading font-bold">{badge.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">{badge.desc}</p>
                  {pct > 0 && (
                    <div className="mt-2 h-1 bg-secondary rounded-full overflow-hidden">
                      <div className="h-full gradient-bg rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Link to Challenges */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
          <Link to="/records"
            className="flex items-center justify-between p-4 glass-card rounded-2xl hover:border-white/[0.15] transition-all group">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center">
                <TrendingUp size={18} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-medium">Explore Challenges</p>
                <p className="text-xs text-muted-foreground">Join new challenges to earn more XP</p>
              </div>
            </div>
            <ChevronRight size={18} className="text-muted-foreground group-hover:text-foreground transition-colors" />
          </Link>
        </motion.div>
      </div>
    </AppLayout>
  );
}
