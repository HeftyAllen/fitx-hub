import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import logo from "@/assets/logo.png";
import heroImg from "@/assets/landing-hero.jpg";
import trackImg from "@/assets/landing-track.jpg";
import nutritionImg from "@/assets/landing-nutrition.jpg";
import { useTheme } from "@/contexts/ThemeContext";
import {
  Dumbbell, Trophy, Zap, Target, BarChart3, Calendar,
  ArrowRight, Menu, X, Sun, Moon, Check,
} from "lucide-react";

const FEATURES = [
  { icon: Dumbbell,  title: "Workout builder",   desc: "Build multi-day plans, then run them with live set logging and rest timers." },
  { icon: Target,    title: "Nutrition that fits", desc: "Calories and macros calculated from your own goals — log food by search or barcode." },
  { icon: BarChart3, title: "Progress you can see", desc: "Weight, volume and personal records charted over time. No guesswork." },
  { icon: Calendar,  title: "Plan your week",     desc: "Send any workout straight to your calendar and keep your streak alive." },
  { icon: Trophy,    title: "Records & rewards",  desc: "Every PR is logged, every milestone earns XP and badges." },
  { icon: Zap,       title: "Works offline",      desc: "Log in the gym with bad signal — everything syncs when you're back." },
];

const STEPS = [
  { n: "01", title: "Set your goal", desc: "Tell us your body metrics, training days and whether you're cutting, maintaining or building." },
  { n: "02", title: "Follow your plan", desc: "Workouts and calorie targets are generated to match that goal — adjust anything, anytime." },
  { n: "03", title: "Track and adapt", desc: "Log sessions and meals; your charts, streaks and targets update as you go." },
];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const } },
};
const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.08 } } };

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className="relative h-9 w-9 rounded-xl border border-border bg-card/60 backdrop-blur flex items-center justify-center text-foreground hover:bg-secondary transition-colors"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={theme}
          initial={{ rotate: -90, opacity: 0, scale: 0.6 }}
          animate={{ rotate: 0, opacity: 1, scale: 1 }}
          exit={{ rotate: 90, opacity: 0, scale: 0.6 }}
          transition={{ duration: 0.2 }}
          className="absolute inset-0 flex items-center justify-center"
        >
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

export default function Landing() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 600], [0, 90]);
  const heroScale = useTransform(scrollY, [0, 600], [1, 1.08]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* ===== NAV ===== */}
      <header className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrolled ? "bg-background/80 backdrop-blur-xl border-b border-border" : "bg-transparent"}`}>
        <div className="max-w-6xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="FitX Journey" className="h-8 w-auto" />
          </Link>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#how" className="hover:text-foreground transition-colors">How it works</a>
            <a href="#nutrition" className="hover:text-foreground transition-colors">Nutrition</a>
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link to="/auth" className="hidden sm:inline-flex text-sm font-medium text-muted-foreground hover:text-foreground px-3 py-2 transition-colors">
              Sign in
            </Link>
            <Link
              to="/auth?signup=true"
              className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-primary-foreground gradient-bg hover:opacity-90 transition-opacity"
            >
              Get started
            </Link>
            <button className="md:hidden p-2 -mr-2 text-foreground" onClick={() => setMenuOpen(v => !v)} aria-label="Menu">
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="md:hidden overflow-hidden bg-background/95 backdrop-blur-xl border-b border-border"
            >
              <div className="px-4 py-4 space-y-1">
                {[["Features", "#features"], ["How it works", "#how"], ["Nutrition", "#nutrition"]].map(([l, h]) => (
                  <a key={h} href={h} onClick={() => setMenuOpen(false)} className="block py-2.5 text-sm text-muted-foreground hover:text-foreground">{l}</a>
                ))}
                <div className="flex flex-col gap-2 pt-3 border-t border-border">
                  <Link to="/auth" onClick={() => setMenuOpen(false)} className="text-center py-3 rounded-xl border border-border text-sm font-medium">Sign in</Link>
                  <Link to="/auth?signup=true" onClick={() => setMenuOpen(false)} className="text-center py-3 rounded-xl text-sm font-semibold text-primary-foreground gradient-bg">Get started</Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ===== HERO ===== */}
      <section className="relative min-h-[92vh] flex items-center pt-24 pb-16">
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <motion.img
            src={heroImg}
            alt="Athlete training with a dumbbell in a gym"
            width={1408}
            height={1600}
            style={{ y: heroY, scale: heroScale }}
            className="absolute inset-0 w-full h-full object-cover object-[70%_20%] opacity-90 dark:opacity-70"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/20" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/60" />
          <motion.div
            aria-hidden
            animate={{ opacity: [0.25, 0.5, 0.25], scale: [1, 1.15, 1] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -left-24 top-1/4 h-80 w-80 rounded-full blur-3xl"
            style={{ background: "radial-gradient(circle, hsl(var(--primary) / 0.5), transparent 70%)" }}
          />
          <motion.div
            aria-hidden
            animate={{ opacity: [0.2, 0.4, 0.2], scale: [1.1, 1, 1.1] }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
            className="absolute right-10 bottom-16 h-72 w-72 rounded-full blur-3xl"
            style={{ background: "radial-gradient(circle, hsl(var(--accent) / 0.45), transparent 70%)" }}
          />
        </div>

        <motion.div
          variants={stagger} initial="hidden" animate="visible"
          className="relative max-w-6xl mx-auto px-4 md:px-6 w-full"
        >
          <div className="max-w-2xl">
            <motion.span variants={fadeUp} className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-border bg-card/60 backdrop-blur text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Train · Eat · Track
            </motion.span>

            <motion.h1 variants={fadeUp} className="mt-6 text-5xl sm:text-6xl md:text-7xl font-black leading-[0.95] tracking-tight">
              Your whole
              <span className="block">fitness journey,</span>
              <span className="gradient-text block">in one place.</span>
            </motion.h1>

            <motion.p variants={fadeUp} className="mt-6 text-base md:text-lg text-muted-foreground max-w-lg leading-relaxed">
              Plan workouts, hit calorie targets built around your own goal, and watch your progress take shape session by session.
            </motion.p>

            <motion.div variants={fadeUp} className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to="/auth?signup=true"
                className="group inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl text-sm font-bold text-primary-foreground gradient-bg hover:scale-[1.02] active:scale-[0.98] transition-transform"
              >
                Create your account
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
              </Link>
              <a href="#features" className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl text-sm font-semibold border border-border hover:bg-secondary transition-colors">
                Explore the app
              </a>
            </motion.div>

            <motion.ul variants={fadeUp} className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              {["Free to start", "No ads", "Works offline"].map(t => (
                <li key={t} className="flex items-center gap-2">
                  <Check size={14} className="text-accent" /> {t}
                </li>
              ))}
            </motion.ul>
          </div>
        </motion.div>
      </section>

      {/* ===== FEATURES ===== */}
      <section id="features" className="py-24 border-t border-border">
        <div className="max-w-6xl mx-auto px-4 md:px-6">
          <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }}>
            <motion.h2 variants={fadeUp} className="text-3xl md:text-5xl font-black tracking-tight max-w-xl">
              Everything you need, nothing you don't.
            </motion.h2>
            <motion.p variants={fadeUp} className="mt-4 text-muted-foreground max-w-lg">
              Six tools that cover training, food and progress — designed to be opened mid-set.
            </motion.p>

            <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {FEATURES.map(({ icon: Icon, title, desc }) => (
                <motion.div
                  key={title}
                  variants={fadeUp}
                  whileHover={{ y: -4 }}
                  className="group relative p-6 rounded-3xl border border-border bg-card/60 backdrop-blur overflow-hidden"
                >
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    style={{ background: "var(--gradient-card)" }} />
                  <div className="relative">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl gradient-bg text-primary-foreground">
                      <Icon size={18} />
                    </span>
                    <h3 className="mt-5 text-lg font-bold">{title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section id="how" className="py-24 border-t border-border">
        <div className="max-w-6xl mx-auto px-4 md:px-6 grid lg:grid-cols-2 gap-14 items-center">
          <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.3 }}>
            <motion.h2 variants={fadeUp} className="text-3xl md:text-5xl font-black tracking-tight">
              Three steps to a plan that fits.
            </motion.h2>
            <div className="mt-10 space-y-8">
              {STEPS.map(s => (
                <motion.div key={s.n} variants={fadeUp} className="flex gap-5">
                  <span className="shrink-0 text-sm font-black tracking-widest text-primary pt-1">{s.n}</span>
                  <div>
                    <h3 className="font-bold text-lg">{s.title}</h3>
                    <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed max-w-md">{s.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.96 }} whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, amount: 0.3 }} transition={{ duration: 0.6 }}
            className="relative"
          >
            <div className="relative rounded-[2rem] overflow-hidden border border-border">
              <img src={trackImg} alt="Athlete logging a workout on her phone" loading="lazy" width={1200} height={1200} className="w-full h-full object-cover" />
            </div>
            <motion.div
              animate={{ y: [0, -10, 0] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -bottom-5 -left-3 md:left-6 px-5 py-4 rounded-2xl border border-border bg-card/90 backdrop-blur-xl"
            >
              <p className="text-xs text-muted-foreground">Session logged</p>
              <p className="text-lg font-black">42 min · 8 sets</p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ===== NUTRITION ===== */}
      <section id="nutrition" className="py-24 border-t border-border">
        <div className="max-w-6xl mx-auto px-4 md:px-6 grid lg:grid-cols-2 gap-14 items-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }} whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, amount: 0.3 }} transition={{ duration: 0.6 }}
            className="order-2 lg:order-1 rounded-[2rem] overflow-hidden border border-border"
          >
            <img src={nutritionImg} alt="Prepared healthy meals with a kitchen scale" loading="lazy" width={1200} height={1200} className="w-full h-full object-cover" />
          </motion.div>

          <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.3 }} className="order-1 lg:order-2">
            <motion.h2 variants={fadeUp} className="text-3xl md:text-5xl font-black tracking-tight">
              Calories that match your goal.
            </motion.h2>
            <motion.p variants={fadeUp} className="mt-4 text-muted-foreground leading-relaxed max-w-md">
              Your daily targets are calculated from your metrics and activity level, then split into protein, carbs and fat. Log food by search or barcode, adjust portions, and the numbers update instantly.
            </motion.p>
            <motion.ul variants={fadeUp} className="mt-8 space-y-3">
              {["Barcode scanning and food search", "Portion editor with live macros", "Meal planner and grocery list", "Hydration tracking"].map(t => (
                <li key={t} className="flex items-center gap-3 text-sm">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent/15 text-accent"><Check size={13} /></span>
                  {t}
                </li>
              ))}
            </motion.ul>
          </motion.div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="py-24 border-t border-border">
        <motion.div
          initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }} transition={{ duration: 0.6 }}
          className="max-w-6xl mx-auto px-4 md:px-6"
        >
          <div className="relative overflow-hidden rounded-[2rem] border border-border p-10 md:p-16 text-center">
            <div className="absolute inset-0 -z-10 opacity-90" style={{ background: "var(--gradient-card)" }} />
            <motion.div
              aria-hidden
              animate={{ rotate: 360 }} transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
              className="absolute -z-10 left-1/2 top-1/2 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/2 blur-3xl opacity-40"
              style={{ background: "conic-gradient(from 0deg, hsl(var(--primary) / 0.5), transparent, hsl(var(--accent) / 0.5), transparent)" }}
            />
            <h2 className="text-3xl md:text-5xl font-black tracking-tight">Start your journey today.</h2>
            <p className="mt-4 text-muted-foreground max-w-md mx-auto">
              Set up your goal in under two minutes and train with a plan that actually fits you.
            </p>
            <Link
              to="/auth?signup=true"
              className="mt-8 inline-flex items-center gap-2 px-7 py-4 rounded-2xl text-sm font-bold text-primary-foreground gradient-bg hover:scale-[1.02] active:scale-[0.98] transition-transform"
            >
              Create your free account <ArrowRight size={16} />
            </Link>
          </div>
        </motion.div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="border-t border-border py-10">
        <div className="max-w-6xl mx-auto px-4 md:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src={logo} alt="FitX Journey" className="h-7 w-auto" />
            <span className="text-sm text-muted-foreground">© {new Date().getFullYear()} FitX Journey</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <Link to="/auth" className="hover:text-foreground transition-colors">Sign in</Link>
            <ThemeToggle />
          </div>
        </div>
      </footer>
    </div>
  );
}
