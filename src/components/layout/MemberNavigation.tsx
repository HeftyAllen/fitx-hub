import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useFeatureAccess } from "@/contexts/FeatureAccessContext";
import { featureForPath } from "@/lib/feature-access";
import { motion } from "framer-motion";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { useBrand } from "@/contexts/SiteSettingsContext";
import { useAdmin } from "@/hooks/useAdmin";
import { useTheme } from "@/contexts/ThemeContext";
import { useNotifications, type NotifCategory } from "@/hooks/useNotifications";
import NotificationCenter from "@/components/notifications/NotificationCenter";
import SyncStatus from "@/components/SyncStatus";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import {
  LayoutDashboard, Dumbbell, UtensilsCrossed, TrendingUp, Trophy, CalendarDays,
  Award, Settings, LogOut, Bell, ShieldCheck, Sun, Moon, Menu, ArrowUpRight,
  BookOpen, ShoppingBasket, LifeBuoy, Library, ChevronRight, Crown, LockKeyhole, type LucideIcon,
} from "lucide-react";

type NavItem = { to: string; label: string; icon: LucideIcon; related?: string[] };
const groups: { label: string; links: NavItem[] }[] = [
  { label: "Your day", links: [
    { to: "/dashboard", label: "Today", icon: LayoutDashboard },
    { to: "/workout-planner", label: "Training", icon: Dumbbell, related: ["/workout-session", "/exercise-library"] },
    { to: "/nutrition", label: "Nutrition", icon: UtensilsCrossed, related: ["/recipes", "/meal-planner", "/grocery-list"] },
    { to: "/progress", label: "Progress", icon: TrendingUp },
  ] },
  { label: "Keep exploring", links: [
    { to: "/calendar", label: "Calendar", icon: CalendarDays },
    { to: "/records", label: "Personal records", icon: Trophy },
    { to: "/rewards", label: "Rewards", icon: Award },
    { to: "/library", label: "Coach library", icon: Library },
  ] },
  { label: "Essentials", links: [
    { to: "/settings", label: "Profile & settings", icon: Settings },
    { to: "/membership", label: "Membership", icon: Crown },
    { to: "/support", label: "Help & support", icon: LifeBuoy },
  ] },
];
const extras: NavItem[] = [
  { to: "/exercise-library", label: "Exercise library", icon: Dumbbell },
  { to: "/recipes", label: "Recipes", icon: BookOpen },
  { to: "/meal-planner", label: "Meal planner", icon: CalendarDays },
  { to: "/grocery-list", label: "Grocery list", icon: ShoppingBasket },
];

export default function MemberNavigation() {
  const { theme, toggleTheme } = useTheme();
  const { pathname } = useLocation();
  const { user, userProfile, logout } = useAuth();
  const { isAdmin } = useAdmin();
  const brand = useBrand();
  const settings = useSiteSettings();
  const { getAccess, config } = useFeatureAccess();
  const visible = (item: NavItem) => { const id = featureForPath(item.to); return !id || getAccess(id).state !== "disabled"; };
  const premium = (item: NavItem) => { const id = featureForPath(item.to); return !!id && getAccess(id).state === "premium"; };
  const label = (item: NavItem) => { const id = featureForPath(item.to); return id ? config.features[id].label || item.label : item.label; };
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<NotifCategory | "all">("all");
  const prefs = userProfile?.notifications;
  const { notifications, unreadCount, markRead, markAllRead, dismiss, dismissAll, formatTime } = useNotifications(prefs);
  if (!user) return null;
  const name = userProfile?.name || user.displayName || "Your profile";
  const avatar = userProfile?.photoURL || user.photoURL;
  const active = (item: NavItem) => pathname === item.to || !!item.related?.includes(pathname);
  const currentItem = [...groups.flatMap(g => g.links), ...extras].find(item => item.to === pathname);
  const section = currentItem ? label(currentItem) : "Your journey";
  const brandLink = <Link to="/dashboard" className="member-brand" aria-label={`${brand.name} home`} onClick={() => setMenuOpen(false)}>
    <span className="member-brand-mark">{brand.logo ? <img src={brand.logo} alt="" className="h-full w-full object-contain p-1" /> : <Dumbbell size={21} strokeWidth={2.5} />}</span>
    <span><strong>{brand.name}</strong><small>{brand.tagline}</small></span>
  </Link>;
  const nav = <nav aria-label="Member navigation" className="space-y-6">
    {groups.map(group => <div key={group.label}>
      <p className="member-nav-label">{group.label}</p>
      <div className="space-y-1">{group.links.filter(visible).map(item => <Link key={item.to} to={item.to} onClick={() => setMenuOpen(false)} aria-current={active(item) ? "page" : undefined} className={`member-nav-link ${active(item) ? "is-active" : ""}`}>
        <item.icon size={18} /><span>{label(item)}</span>{premium(item) ? <LockKeyhole size={13} className="ml-auto" aria-label="Premium feature" /> : active(item) ? <motion.span layoutId="member-active-nav" className="ml-auto"><ChevronRight size={15} /></motion.span> : null}
      </Link>)}</div>
    </div>)}
    {isAdmin && <Link to="/admin" className="member-nav-link" onClick={() => setMenuOpen(false)}><ShieldCheck size={18} />Team workspace<ArrowUpRight size={14} className="ml-auto" /></Link>}
  </nav>;
  const account = <div className="border-t border-border pt-4 mt-5 flex items-center gap-3">
    <Link to="/settings" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 flex-1 min-w-0" aria-label="Open profile">
      <span className="member-avatar">{avatar ? <img src={avatar} alt="" /> : name[0].toUpperCase()}</span>
      <span className="min-w-0"><span className="block text-sm font-semibold truncate">{name}</span><span className="block text-xs text-muted-foreground">Personal workspace</span></span>
    </Link>
    <button onClick={() => void logout()} aria-label="Log out" className="member-icon-button"><LogOut size={17} /></button>
  </div>;
  return <>
    <aside className="member-sidebar hidden lg:flex">
      {brandLink}
      <div className="flex-1 overflow-y-auto py-8">{nav}</div>
      <div className="member-sidebar-note"><span className="text-xs font-semibold">{settings.sidebarTitle}</span><p className="text-xs text-muted-foreground mt-1 leading-relaxed">{settings.sidebarDescription}</p></div>
      {account}
    </aside>
    <header className="member-topbar">
      <div className="flex items-center gap-3 min-w-0">
        <button className="member-icon-button lg:hidden" aria-label="Open member menu" onClick={() => setMenuOpen(true)}><Menu size={21} /></button>
        <div className="min-w-0"><p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground hidden sm:block">Personal workspace</p><p className="font-semibold text-sm truncate">{section}</p></div>
      </div>
      <div className="flex items-center gap-1 sm:gap-3">
        <div className="hidden md:block"><SyncStatus compact /></div>
        <button onClick={toggleTheme} aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} className="member-icon-button">{theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}</button>
        <button onClick={() => setNotifOpen(o => !o)} aria-label="Notifications" className="member-icon-button relative"><Bell size={18} />{unreadCount > 0 && <span className="absolute right-1 top-1 h-2 w-2 bg-primary rounded-full" />}</button>
        <Link to="/settings" className="member-avatar !w-8 !h-8 sm:!w-9 sm:!h-9" aria-label="Profile & settings">{avatar ? <img src={avatar} alt="" /> : name[0].toUpperCase()}</Link>
      </div>
    </header>
    <nav aria-label="Mobile member navigation" className="member-bottom-nav lg:hidden">
      {groups[0].links.filter(visible).map(item => <Link key={item.to} to={item.to} aria-current={active(item) ? "page" : undefined} className={active(item) ? "is-active" : ""}><item.icon size={20} /><span>{label(item)}{premium(item) && <LockKeyhole size={10} className="inline ml-1" aria-label="Premium feature" />}</span></Link>)}
      <button onClick={() => setMenuOpen(true)} aria-label="More member features"><Menu size={20} /><span>More</span></button>
    </nav>
    <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
      <SheetContent side="left" className="member-shell !w-[min(90vw,340px)] overflow-y-auto p-6">
        <SheetTitle className="sr-only">{brand.name}</SheetTitle><SheetDescription className="sr-only">Member features and account navigation</SheetDescription>
        <div className="pr-6">{brandLink}</div><div className="py-7">{nav}</div>
        <p className="member-nav-label">Training & food tools</p>{extras.filter(visible).map(item => <Link key={item.to} to={item.to} onClick={() => setMenuOpen(false)} className="member-nav-link"><item.icon size={18} />{label(item)}{premium(item) && <LockKeyhole size={13} className="ml-auto" />}</Link>)}
        {account}
      </SheetContent>
    </Sheet>
    <NotificationCenter open={notifOpen} onClose={() => setNotifOpen(false)} notifications={notifications} unreadCount={unreadCount} activeFilter={activeFilter} onFilterChange={setActiveFilter} onMarkRead={markRead} onMarkAllRead={markAllRead} onDismiss={dismiss} onDismissAll={dismissAll} formatTime={formatTime} />
  </>;
}
