import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence, useScroll, useTransform, useReducedMotion } from "framer-motion";
import logo from "@/assets/logo.png";
import heroImg from "@/assets/landing-hero.jpg";
import trackImg from "@/assets/landing-track.jpg";
import nutritionImg from "@/assets/landing-nutrition.jpg";
import { useTheme } from "@/contexts/ThemeContext";
import {
  Dumbbell, Trophy, Zap, Target, BarChart3, Calendar,
  ArrowRight, ArrowUpRight, Menu, X, Sun, Moon,
} from "lucide-react";

const FEATURES = [
  { icon: Dumbbell,  title: "Workout builder",     desc: "Build multi-day plans, then run them with live set logging and rest timers." },
  { icon: Target,    title: "Nutrition that fits", desc: "Calories and macros from your own goal — log food by search or barcode." },
  { icon: BarChart3, title: "Progress you can see",desc: "Weight, volume and personal records charted over time. No guesswork." },
  { icon: Calendar,  title: "Plan your week",      desc: "Send any workout straight to your calendar and keep the streak alive." },
  { icon: Trophy,    title: "Records & rewards",   desc: "Every PR is logged, every milestone earns XP and badges." },
  { icon: Zap,       title: "Works offline",       desc: "Log in the gym with bad signal — everything syncs when you're back." },
];

const STEPS = [
  { n: "01", title: "Set your goal",     desc: "Body metrics, training days, and whether you're cutting, maintaining or building." },
  { n: "02", title: "Follow your plan",  desc: "Workouts and calorie targets are generated to match that goal — adjust anything, anytime." },
  { n: "03", title: "Track and adapt",   desc: "Log sessions and meals; charts, streaks and targets update as you go." },
];

const NUTRITION_POINTS = [
  "Barcode scanning and food search",
  "Portion editor with live macros",
  "Meal planner and grocery list",
  "Hydration tracking",
];

const NAV = [["Features", "#features"], ["How it works", "#how"], ["Nutrition", "#nutrition"]] as const;

const reveal = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const } },
};
const group = { hidden: {}, visible: { transition: { staggerChildren: 0.07 } } };

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className="relative h-9 w-9 rounded-full border border-border/70 flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={theme}
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.7 }}
          transition={{ duration: 0.18 }}
          className="absolute inset-0 flex items-center justify-center"
        >
          {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

/** Thin label used above every section — keeps the page reading like an editorial spread. */
function SectionLabel({ index, children }: { index: string; children: string }) {
  return (
    <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
      <span className="text-foreground/40">{index}</span>
      <span className="h-px w-8 bg-border" />
      {children}
    </div>
  );
}

export default function Landing() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const reduce = useReducedMotion();
  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 700], [0, reduce ? 0 : 70]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* ===== NAV ===== */}
      <header
        className={`fixed top-0 inset-x-0 z-50 transition-colors duration-300 ${
          scrolled ? "bg-background/85 backdrop-blur-xl border-b border-border" : "bg-transparent"
        }`}
      >
        <div className="max-w-6xl mx-auto px-5 md:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <img src={logo} alt="FitX Journey" className="h-7 w-auto" />
            <span className="hidden sm:block text-sm font-semibold tracking-tight">FitX Journey</span>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            {NAV.map(([label, href]) => (
              <a key={href} href={href} className="relative py-1 hover:text-foreground transition-colors group">
                {label}
                <span className="absolute -bottom-0.5 left-0 h-px w-0 bg-foreground/60 transition-all duration-300 group-hover:w-full" />
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2.5">
            <ThemeToggle />
            <Link to="/auth" className="hidden sm:inline-flex text-sm text-muted-foreground hover:text-foreground px-2 py-2 transition-colors">
              Sign in
            </Link>
            <Link
              to="/auth?signup=true"
              className="hidden sm:inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold bg-foreground text-background hover:opacity-90 transition-opacity"
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
              transition={{ duration: 0.25 }}
              className="md:hidden overflow-hidden bg-background border-b border-border"
            >
              <div className="px-5 py-4">
                {NAV.map(([l, h]) => (
                  <a key={h} href={h} onClick={() => setMenuOpen(false)} className="flex items-center justify-between py-3 text-sm border-b border-border/60 text-muted-foreground">
                    {l} <ArrowUpRight size={14} />
                  </a>
                ))}
                <div className="flex flex-col gap-2 pt-4">
                  <Link to="/auth" onClick={() => setMenuOpen(false)} className="text-center py-3 rounded-full border border-border text-sm font-medium">Sign in</Link>
                  <Link to="/auth?signup=true" onClick={() => setMenuOpen(false)} className="text-center py-3 rounded-full text-sm font-semibold bg-foreground text-background">Get started</Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ===== HERO ===== */}
      <section className="relative pt-28 pb-14 md:pt-36 md:pb-20">
        <div className="max-w-6xl mx-auto px-5 md:px-8">
          <motion.div variants={group} initial="hidden" animate="visible" className="max-w-3xl">
            <motion.div variants={reveal}>
              <SectionLabel index="—">Train · Eat · Track</SectionLabel>
            </motion.div>

            <motion.h1
              variants={reveal}
              className="mt-7 font-heading text-[13vw] leading-[0.9] sm:text-6xl md:text-7xl font-black tracking-[-0.03em]"
            >
              Your whole fitness
              <br className="hidden sm:block" />
              {" "}journey,
              <span className="block text-muted-foreground">in one place.</span>
            </motion.h1>

            <motion.p variants={reveal} className="mt-7 text-base md:text-lg text-muted-foreground max-w-xl leading-relaxed">
              Plan workouts, hit calorie targets built around your own goal, and watch progress take shape
              session by session.
            </motion.p>

            <motion.div variants={reveal} className="mt-9 flex flex-wrap items-center gap-3">
              <Link
                to="/auth?signup=true"
                className="group inline-flex items-center gap-2 px-6 py-3.5 rounded-full text-sm font-semibold bg-foreground text-background hover:opacity-90 transition-opacity"
              >
                Create your account
                <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
              </Link>
              <a href="#features" className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full text-sm font-medium border border-border hover:border-foreground/30 transition-colors">
                Explore the app
              </a>
            </motion.div>
          </motion.div>

          {/* Wide image band */}
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="mt-14 md:mt-20 relative overflow-hidden rounded-2xl border border-border aspect-[16/9] md:aspect-[21/9]"
          >
            <motion.img
              src={heroImg}
              alt="Athlete training with a dumbbell in a gym"
              width={1408}
              height={1600}
              style={{ y: heroY }}
              className="absolute inset-0 h-[118%] w-full object-cover object-[60%_30%]"
            />
            <div className="absolute inset-0 bg-background/10 dark:bg-background/25" />
            <div className="absolute inset-x-0 bottom-0 p-5 md:p-7 flex flex-wrap gap-x-8 gap-y-2 text-xs md:text-sm text-background dark:text-foreground/90 bg-gradient-to-t from-black/60 to-transparent">
              {["Free to start", "No ads", "Works offline"].map(t => (
                <span key={t} className="font-medium tracking-wide text-white/90">{t}</span>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ===== FEATURES ===== */}
      <section id="features" className="py-20 md:py-28 border-t border-border">
        <div className="max-w-6xl mx-auto px-5 md:px-8">
          <motion.div variants={group} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }}>
            <motion.div variants={reveal}><SectionLabel index="01">What's inside</SectionLabel></motion.div>
            <motion.h2 variants={reveal} className="mt-6 font-heading text-3xl md:text-5xl font-black tracking-[-0.02em] max-w-2xl">
              Everything you need, nothing you don't.
            </motion.h2>

            <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 border-t border-border">
              {FEATURES.map(({ icon: Icon, title, desc }) => (
                <motion.div
                  key={title}
                  variants={reveal}
                  className="group relative p-6 md:p-8 border-b border-border sm:border-r last:border-r-0 hover:bg-secondary/40 transition-colors"
                >
                  <Icon size={18} className="text-muted-foreground group-hover:text-primary transition-colors" />
                  <h3 className="mt-6 text-base font-semibold tracking-tight">{title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{desc}</p>
                  <span className="absolute bottom-0 left-0 h-px w-0 bg-primary transition-all duration-500 group-hover:w-full" />
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section id="how" className="py-20 md:py-28 border-t border-border">
        <div className="max-w-6xl mx-auto px-5 md:px-8 grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <motion.div variants={group} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.25 }}>
            <motion.div variants={reveal}><SectionLabel index="02">How it works</SectionLabel></motion.div>
            <motion.h2 variants={reveal} className="mt-6 font-heading text-3xl md:text-5xl font-black tracking-[-0.02em]">
              Three steps to a plan that fits.
            </motion.h2>

            <div className="mt-10 divide-y divide-border border-y border-border">
              {STEPS.map(s => (
                <motion.div key={s.n} variants={reveal} className="flex gap-6 py-6">
                  <span className="shrink-0 text-xs font-semibold tracking-[0.2em] text-muted-foreground pt-1">{s.n}</span>
                  <div>
                    <h3 className="font-semibold tracking-tight">{s.title}</h3>
                    <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed max-w-md">{s.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            <div className="overflow-hidden rounded-2xl border border-border">
              <img src={trackImg} alt="Athlete logging a workout on her phone" loading="lazy" width={1200} height={1200} className="w-full h-full object-cover" />
            </div>
            <div className="absolute -bottom-4 left-5 px-4 py-3 rounded-xl border border-border bg-background/95 backdrop-blur">
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Session logged</p>
              <p className="mt-0.5 text-base font-semibold tracking-tight">42 min · 8 sets</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ===== NUTRITION ===== */}
      <section id="nutrition" className="py-20 md:py-28 border-t border-border">
        <div className="max-w-6xl mx-auto px-5 md:px-8 grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="order-2 lg:order-1 overflow-hidden rounded-2xl border border-border"
          >
            <img src={nutritionImg} alt="Prepared healthy meals with a kitchen scale" loading="lazy" width={1200} height={1200} className="w-full h-full object-cover" />
          </motion.div>

          <motion.div variants={group} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.25 }} className="order-1 lg:order-2">
            <motion.div variants={reveal}><SectionLabel index="03">Nutrition</SectionLabel></motion.div>
            <motion.h2 variants={reveal} className="mt-6 font-heading text-3xl md:text-5xl font-black tracking-[-0.02em]">
              Calories that match your goal.
            </motion.h2>
            <motion.p variants={reveal} className="mt-5 text-muted-foreground leading-relaxed max-w-md">
              Daily targets are calculated from your metrics and activity level, then split into protein, carbs
              and fat. Log food by search or barcode, adjust portions, and the numbers update instantly.
            </motion.p>
            <motion.ul variants={reveal} className="mt-8 divide-y divide-border border-y border-border">
              {NUTRITION_POINTS.map((t, i) => (
                <li key={t} className="flex items-baseline gap-4 py-3.5 text-sm">
                  <span className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {t}
                </li>
              ))}
            </motion.ul>
          </motion.div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="border-t border-border">
        <motion.div
          initial={{ opacity: 0 }} whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.4 }} transition={{ duration: 0.6 }}
          className="max-w-6xl mx-auto px-5 md:px-8 py-24 md:py-32 text-center"
        >
          <h2 className="font-heading text-4xl md:text-6xl font-black tracking-[-0.03em]">
            Start your journey today.
          </h2>
          <p className="mt-5 text-muted-foreground max-w-md mx-auto">
            Set up your goal in under two minutes and train with a plan that actually fits you.
          </p>
          <Link
            to="/auth?signup=true"
            className="group mt-9 inline-flex items-center gap-2 px-7 py-4 rounded-full text-sm font-semibold bg-foreground text-background hover:opacity-90 transition-opacity"
          >
            Create your free account
            <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        </motion.div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="border-t border-border py-9">
        <div className="max-w-6xl mx-auto px-5 md:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <img src={logo} alt="FitX Journey" className="h-6 w-auto" />
            <span className="text-xs text-muted-foreground">© {new Date().getFullYear()} FitX Journey</span>
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
