import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import logo from "@/assets/logo.png";
import {
  Dumbbell, Flame, Trophy, Zap, Target, BarChart3, Calendar,
  ChevronRight, Play, Star, CheckCircle2, ArrowRight, Menu, X,
  Apple, Smartphone
} from "lucide-react";

const FEATURES = [
  { icon: Dumbbell,  title: "Smart Workout Plans",  desc: "AI-powered plans tailored to your fitness level, goals, and schedule — adjust on the fly.",       color: "from-blue-600 to-cyan-500" },
  { icon: Target,    title: "Nutrition Tracking",   desc: "Log meals, track macros, and discover recipes that fuel your performance.",                         color: "from-violet-600 to-blue-500" },
  { icon: BarChart3, title: "Progress Analytics",   desc: "Detailed charts and insights to visualise every milestone in your fitness journey.",                color: "from-cyan-500 to-teal-500" },
  { icon: Trophy,    title: "Challenges & Rewards", desc: "Earn XP, badges and rewards as you crush goals and climb the leaderboards.",                        color: "from-blue-500 to-indigo-600" },
  { icon: Calendar,  title: "Workout Calendar",     desc: "Schedule and track workouts across the month with streak tracking built in.",                       color: "from-teal-500 to-cyan-400" },
  { icon: Zap,       title: "Live Session Tracker", desc: "Real-time set logging, rest timers and voice coaching during your workout.",                        color: "from-indigo-500 to-violet-500" },
];

const STATS = [
  { value: "10K+",  label: "Active Athletes" },
  { value: "500K+", label: "Workouts Logged" },
  { value: "98%",   label: "Goal Achievement" },
  { value: "4.9★",  label: "App Rating" },
];

const TAGS = [
  "Personal Training", "Strength", "Cardio", "HIIT",
  "Nutrition", "Recovery", "Challenges", "Progress Tracking",
];

const TESTIMONIALS = [
  {
    name: "Marcus T.",
    role: "Powerlifter · 8 months in",
    avatar: "M",
    text: "FitX Journey completely transformed how I train. The PR tracking and challenge system keeps me locked in every single session.",
    rating: 5,
  },
  {
    name: "Aisha K.",
    role: "Runner · 1 year in",
    avatar: "A",
    text: "From nutrition logging to workout plans, everything is in one place. My marathon time dropped by 18 minutes!",
    rating: 5,
  },
  {
    name: "Jordan R.",
    role: "Bodybuilder · 6 months in",
    avatar: "J",
    text: "The live session coach kept me pushing harder than I ever would alone. Gained 8kg of muscle and I have the data to prove it.",
    rating: 5,
  },
];

const fadeUp = { hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0 } };
const stagger = { visible: { transition: { staggerChildren: 0.1 } } };

export default function Landing() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white overflow-x-hidden">

      {/* ===== NAV ===== */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-black/80 backdrop-blur-xl border-b border-white/[0.06]" : "bg-transparent"}`}>
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="FitX Journey" className="h-9 w-auto" />
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm text-white/60 font-medium">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#stats" className="hover:text-white transition-colors">Results</a>
            <a href="#testimonials" className="hover:text-white transition-colors">Stories</a>
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <Link to="/auth" className="text-sm font-medium text-white/70 hover:text-white transition-colors px-4 py-2 rounded-xl">
              Sign In
            </Link>
            <Link to="/auth?signup=true"
              className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 transition-all shadow-lg shadow-blue-600/30 hover:shadow-blue-600/50 hover:scale-[1.02] active:scale-[0.98]">
              Start Free
            </Link>
          </div>

          <button className="md:hidden p-2 text-white" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        <AnimatePresence>
          {menuOpen && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="md:hidden bg-black/95 backdrop-blur-xl border-b border-white/[0.08] overflow-hidden">
              <div className="px-4 py-5 space-y-3">
                <a href="#features" onClick={() => setMenuOpen(false)} className="block text-sm text-white/70 hover:text-white py-2">Features</a>
                <a href="#stats" onClick={() => setMenuOpen(false)} className="block text-sm text-white/70 hover:text-white py-2">Results</a>
                <a href="#testimonials" onClick={() => setMenuOpen(false)} className="block text-sm text-white/70 hover:text-white py-2">Stories</a>
                <div className="flex flex-col gap-2 pt-3 border-t border-white/[0.08]">
                  <Link to="/auth" className="text-center py-3 rounded-xl border border-white/[0.15] text-sm font-medium hover:bg-white/[0.05] transition-colors">
                    Sign In
                  </Link>
                  <Link to="/auth?signup=true"
                    className="text-center py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-cyan-500">
                    Get Started Free
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ===== HERO ===== */}
      <section className="relative min-h-screen flex items-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img src="/hero-athlete.jpg" alt="Athlete" className="w-full h-full object-cover object-top" />
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-black/20" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0f] via-transparent to-black/40" />
          {/* Blue accent glow matching app theme */}
          <div className="absolute top-1/3 left-1/4 w-96 h-96 rounded-full opacity-20 blur-3xl"
            style={{ background: "radial-gradient(circle, #2563eb, transparent 70%)" }} />
          <div className="absolute bottom-1/3 right-1/4 w-64 h-64 rounded-full opacity-15 blur-3xl"
            style={{ background: "radial-gradient(circle, #06b6d4, transparent 70%)" }} />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-6 pt-24 pb-16 w-full">
          <div className="max-w-2xl">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-600/15 border border-blue-500/30 text-blue-400 text-xs font-semibold uppercase tracking-wider mb-6">
              <Flame size={13} />
              The #1 Fitness Tracking App
            </motion.div>

            <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="text-5xl sm:text-6xl md:text-7xl font-black leading-[1.0] tracking-tight mb-6">
              <span className="block text-white">Push Your</span>
              <span className="block text-white">Limits</span>
              <span className="block bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">With Us.</span>
            </motion.h1>

            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
              className="text-white/60 text-base md:text-lg leading-relaxed mb-8 max-w-lg">
              From beginner to advanced — track workouts, nail your nutrition, set PRs and earn rewards as you become the best version of yourself.
            </motion.p>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
              className="flex flex-wrap gap-3 mb-10">
              <Link to="/auth?signup=true"
                className="flex items-center gap-2 px-7 py-3.5 rounded-2xl font-bold text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 shadow-xl shadow-blue-600/30 hover:shadow-blue-600/50 hover:scale-[1.03] active:scale-[0.98] transition-all text-sm">
                Join Now <ArrowRight size={16} />
              </Link>
              <a href="#features"
                className="flex items-center gap-2 px-7 py-3.5 rounded-2xl font-semibold text-white border border-white/20 hover:bg-white/[0.07] transition-all text-sm">
                <div className="w-7 h-7 rounded-full border border-white/30 flex items-center justify-center">
                  <Play size={11} className="ml-0.5" fill="white" />
                </div>
                See Features
              </a>
            </motion.div>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
              className="flex items-center gap-3">
              <div className="flex -space-x-2">
                {["M", "A", "J", "K"].map((l, i) => (
                  <div key={i} className={`w-8 h-8 rounded-full border-2 border-black flex items-center justify-center text-xs font-bold text-white ${["bg-blue-600", "bg-cyan-500", "bg-violet-500", "bg-teal-500"][i]}`}>
                    {l}
                  </div>
                ))}
              </div>
              <div>
                <div className="flex items-center gap-0.5 mb-0.5">
                  {[1,2,3,4,5].map(i => <Star key={i} size={11} fill="#38bdf8" className="text-sky-400" />)}
                </div>
                <p className="text-xs text-white/50"><span className="text-white font-semibold">10,000+</span> athletes crushing it daily</p>
              </div>
            </motion.div>
          </div>
        </div>

        <div className="absolute bottom-8 left-0 right-0 z-10 overflow-hidden">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}
            className="flex gap-2 px-4 md:px-6 overflow-x-auto scrollbar-hide pb-1">
            {TAGS.map(tag => (
              <span key={tag}
                className="flex-shrink-0 px-4 py-1.5 rounded-full bg-white/[0.08] border border-white/[0.12] text-white/70 text-xs font-medium backdrop-blur-sm">
                {tag}
              </span>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ===== STATS ===== */}
      <section id="stats" className="py-16 md:py-20 relative">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 to-cyan-500/5" />
        <div className="max-w-7xl mx-auto px-4 md:px-6 relative">
          <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }}
            className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
            {STATS.map((stat, i) => (
              <motion.div key={stat.label} variants={fadeUp} transition={{ delay: i * 0.1 }}
                className="text-center">
                <p className="text-4xl md:text-5xl font-black bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent mb-1">{stat.value}</p>
                <p className="text-sm text-white/50 font-medium">{stat.label}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ===== GYM VISUAL DIVIDER ===== */}
      <section className="relative h-64 md:h-80 overflow-hidden">
        <img src="/hero-gym.jpg" alt="Gym" className="w-full h-full object-cover object-center" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0f] via-black/50 to-[#0a0a0f]" />
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.p initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}
            className="text-4xl md:text-6xl font-black text-center tracking-tighter">
            <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">STRONGER</span>
            <br />
            <span className="text-white">EVERY DAY</span>
          </motion.p>
        </div>
      </section>

      {/* ===== FEATURES ===== */}
      <section id="features" className="py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="text-center mb-14">
            <span className="inline-block px-4 py-1.5 rounded-full bg-blue-600/15 border border-blue-500/25 text-blue-400 text-xs font-semibold uppercase tracking-wider mb-4">
              Everything You Need
            </span>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight mb-4">
              One App.<br />
              <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">Infinite Results.</span>
            </h2>
            <p className="text-white/50 text-base max-w-xl mx-auto">
              FitX Journey brings together every tool an athlete needs — beautifully designed and ridiculously easy to use.
            </p>
          </motion.div>

          <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }}
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((feature, i) => (
              <motion.div key={feature.title} variants={fadeUp} transition={{ delay: i * 0.08 }}
                className="group relative p-6 rounded-2xl bg-white/[0.04] border border-white/[0.08] hover:border-blue-500/30 hover:bg-white/[0.07] transition-all duration-300">
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-5 shadow-lg group-hover:scale-110 transition-transform`}>
                  <feature.icon size={22} className="text-white" />
                </div>
                <h3 className="font-bold text-base text-white mb-2">{feature.title}</h3>
                <p className="text-sm text-white/50 leading-relaxed">{feature.desc}</p>
                <div className="absolute top-5 right-5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ChevronRight size={16} className="text-blue-400/50" />
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section className="py-20 md:py-24 bg-white/[0.02]">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-4">
              Get Started in <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">3 Steps</span>
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6 md:gap-10 relative">
            <div className="hidden md:block absolute top-8 left-1/6 right-1/6 h-px bg-gradient-to-r from-transparent via-blue-500/40 to-transparent" />

            {[
              { step: "01", title: "Create Your Profile", desc: "Sign up in seconds and tell us your goals, fitness level, and available equipment.", icon: "👤" },
              { step: "02", title: "Build Your Plan",     desc: "Get a personalised workout and nutrition plan — or design your own with our tools.", icon: "📋" },
              { step: "03", title: "Track & Dominate",    desc: "Log every session, earn XP, beat challenges, and watch your data prove your growth.", icon: "🏆" },
            ].map((item, i) => (
              <motion.div key={item.step} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.15 }}
                className="text-center relative">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-2xl mx-auto mb-4 shadow-xl shadow-blue-600/20">
                  {item.icon}
                </div>
                <p className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-2">{item.step}</p>
                <h3 className="font-bold text-lg text-white mb-2">{item.title}</h3>
                <p className="text-sm text-white/50 leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== TESTIMONIALS ===== */}
      <section id="testimonials" className="py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-4">
              Real Athletes. <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">Real Results.</span>
            </h2>
            <p className="text-white/50 text-base">Join thousands of people who transformed their lives with FitX Journey.</p>
          </motion.div>

          <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }}
            className="grid md:grid-cols-3 gap-5">
            {TESTIMONIALS.map((t, i) => (
              <motion.div key={t.name} variants={fadeUp} transition={{ delay: i * 0.1 }}
                className="p-6 rounded-2xl bg-white/[0.04] border border-white/[0.08] hover:border-blue-500/25 transition-all">
                <div className="flex items-center gap-1 mb-4">
                  {Array.from({ length: t.rating }).map((_, j) => (
                    <Star key={j} size={14} fill="#38bdf8" className="text-sky-400" />
                  ))}
                </div>
                <p className="text-white/70 text-sm leading-relaxed mb-5 italic">"{t.text}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-sm font-bold text-white">
                    {t.avatar}
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-white">{t.name}</p>
                    <p className="text-xs text-white/40">{t.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ===== WHAT'S INCLUDED ===== */}
      <section className="py-16 md:py-20 bg-white/[0.02]">
        <div className="max-w-4xl mx-auto px-4 md:px-6 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="mb-10">
            <h2 className="text-2xl md:text-3xl font-black mb-3">Everything Included. <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">Free.</span></h2>
            <p className="text-white/50 text-sm">No hidden fees. No paywalls. Just results.</p>
          </motion.div>
          <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left max-w-2xl mx-auto">
            {[
              "Unlimited workout plans", "Personal record tracking",
              "Nutrition & macro logging", "AI recipe discovery",
              "10 fitness challenges", "XP levels & badge rewards",
              "Workout calendar & streaks", "Progress photos & analytics",
              "Live session voice coach", "Exercise library (1000+ moves)",
            ].map((item, i) => (
              <motion.div key={item} variants={fadeUp} transition={{ delay: i * 0.05 }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <CheckCircle2 size={16} className="text-cyan-500 flex-shrink-0" />
                <span className="text-sm text-white/80">{item}</span>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ===== CTA SECTION ===== */}
      <section className="py-24 md:py-32 relative overflow-hidden">
        <div className="absolute inset-0">
          <img src="/hero-athlete.jpg" alt="" className="w-full h-full object-cover object-top opacity-20" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0f] via-[#0a0a0f]/80 to-[#0a0a0f]" />
          <div className="absolute inset-0 bg-gradient-to-r from-blue-900/20 via-transparent to-cyan-900/20" />
        </div>
        <div className="relative z-10 max-w-3xl mx-auto px-4 md:px-6 text-center">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <span className="inline-block px-4 py-1.5 rounded-full bg-blue-600/15 border border-blue-500/25 text-blue-400 text-xs font-semibold uppercase tracking-wider mb-6">
              Start Today
            </span>
            <h2 className="text-4xl md:text-6xl font-black tracking-tight mb-6">
              Ready to Become<br />
              <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">Unstoppable?</span>
            </h2>
            <p className="text-white/50 text-base md:text-lg mb-10 max-w-xl mx-auto">
              Join thousands of athletes already tracking, improving and winning. Your best performance starts now.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/auth?signup=true"
                className="flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-base font-bold text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 shadow-2xl shadow-blue-600/30 hover:shadow-blue-600/50 hover:scale-[1.03] active:scale-[0.98] transition-all">
                Get Started — It's Free <ArrowRight size={18} />
              </Link>
              <Link to="/auth"
                className="flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-base font-semibold text-white border border-white/20 hover:bg-white/[0.07] transition-all">
                Already have an account?
              </Link>
            </div>
            <div className="flex items-center justify-center gap-4 mt-8 opacity-40">
              <div className="flex items-center gap-2 text-xs text-white/60">
                <Apple size={14} /> iOS App Coming Soon
              </div>
              <div className="w-px h-4 bg-white/20" />
              <div className="flex items-center gap-2 text-xs text-white/60">
                <Smartphone size={14} /> Android App Coming Soon
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="border-t border-white/[0.06] py-10">
        <div className="max-w-7xl mx-auto px-4 md:px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="FitX Journey" className="h-8 w-auto opacity-70 hover:opacity-100 transition-opacity" />
          </Link>
          <p className="text-xs text-white/30 text-center">© {new Date().getFullYear()} FitX Journey. All rights reserved. Built for athletes, by athletes.</p>
          <div className="flex items-center gap-4 text-xs text-white/40">
            <Link to="/auth" className="hover:text-white/70 transition-colors">Sign In</Link>
            <Link to="/auth?signup=true" className="hover:text-white/70 transition-colors">Sign Up</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
