import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { collection, getCountFromServer, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  Activity, Users as UsersIcon, Megaphone, LifeBuoy, AlertCircle, Zap,
  FileText, BarChart3, Settings as SettingsIcon, ArrowRight, Sparkles,
} from "lucide-react";
import { getDailyUsage } from "@/lib/spoonacular";
import { useAdmin } from "@/hooks/useAdmin";
import { useAuth } from "@/contexts/AuthContext";
import { ROLE_META, SECTION_PATH, type AdminSection } from "@/lib/permissions";

type Stat = { label: string; value: string | number; icon: any; tone?: string; sub?: string };

const ACTION_META: Record<AdminSection, { label: string; desc: string; icon: any }> = {
  overview:      { label: "Overview",      desc: "Key metrics",                icon: Activity },
  users:         { label: "Members",       desc: "Roles, suspensions, search", icon: UsersIcon },
  content:       { label: "Content",       desc: "Author & publish plans",     icon: FileText },
  activity:      { label: "Activity",      desc: "Live audit trail",           icon: Activity },
  announcements: { label: "Broadcast",     desc: "Message every member",       icon: Megaphone },
  support:       { label: "Support",       desc: "Answer tickets",             icon: LifeBuoy },
  reports:       { label: "Reports",       desc: "Trends & CSV exports",       icon: BarChart3 },
  settings:      { label: "Brand & system",desc: "Logo, colours, flags",       icon: SettingsIcon },
};

export default function AdminOverview() {
  const { role, sections, canWrite } = useAdmin();
  const { user } = useAuth();
  const [stats, setStats] = useState<Stat[]>([]);
  const [loading, setLoading] = useState(true);
  const roleMeta = role ? ROLE_META[role] : null;

  useEffect(() => {
    (async () => {
      try {
        const [activityCount, openTickets, announcements, recentLogs] = await Promise.all([
          getCountFromServer(query(collection(db, "activityLogs"))).then(s => s.data().count).catch(() => 0),
          getCountFromServer(query(collection(db, "supportTickets"), where("status", "==", "open"))).then(s => s.data().count).catch(() => 0),
          getCountFromServer(collection(db, "announcements")).then(s => s.data().count).catch(() => 0),
          getDocs(query(collection(db, "activityLogs"), orderBy("createdAt", "desc"), limit(100))).catch(() => null),
        ]);

        const uniqueUsers = recentLogs ? new Set(recentLogs.docs.map(d => d.data().userId)).size : 0;
        const errors = recentLogs ? recentLogs.docs.filter(d => String(d.data().action ?? "").includes("error")).length : 0;
        const usage = getDailyUsage();

        setStats([
          { label: "Activity events", value: activityCount, icon: Activity, sub: "lifetime" },
          { label: "Active members", value: uniqueUsers, icon: UsersIcon, sub: "recent slice" },
          { label: "Open tickets", value: openTickets, icon: LifeBuoy, tone: openTickets > 0 ? "text-amber-400" : undefined },
          { label: "Announcements", value: announcements, icon: Megaphone },
          { label: "Errors logged", value: errors, icon: AlertCircle, tone: errors > 0 ? "text-destructive" : undefined },
          { label: "Spoonacular today", value: `${usage.used}/${usage.limit}`, icon: Zap, sub: `resets in ${usage.resetIn}` },
        ]);
      } finally { setLoading(false); }
    })();
  }, []);

  return (
    <div className="space-y-8">
      {/* HEADER */}
      <header>
        <Badge variant="outline" className="mb-3 gap-1 text-[10px]">
          <Sparkles size={10} /> {roleMeta?.label ?? "Console"}
        </Badge>
        <h1 className="text-4xl md:text-5xl font-black tracking-tight">
          Welcome back{user?.email ? `, ${user.email.split("@")[0]}` : ""}
        </h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-md">
          {roleMeta?.blurb}. {canWrite ? "You can publish changes from here." : "You have read-only visibility."}
        </p>
      </header>

      {/* STATS */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-px rounded-2xl overflow-hidden border border-border bg-border">
        {(loading ? Array.from({ length: 6 }).map(() => ({ label: "", value: "", icon: Activity } as Stat)) : stats).map((s, i) => (
          <div key={i} className="bg-card p-5">
            <div className="flex items-start justify-between mb-6">
              <s.icon size={16} className={s.tone ?? "text-primary"} />
              {s.sub && <span className="text-[10px] text-muted-foreground">{s.sub}</span>}
            </div>
            <div className={`text-3xl font-black tracking-tight ${s.tone ?? ""}`}>{loading ? "…" : s.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{s.label || "Loading"}</div>
          </div>
        ))}
      </div>

      {/* ROLE-SCOPED QUICK ACTIONS */}
      <div>
        <p className="text-sm text-muted-foreground mb-3">Your workspace</p>
        <div className="grid sm:grid-cols-2 gap-3">
          {sections.filter(s => s !== "overview").map((s, i) => {
            const m = ACTION_META[s];
            return (
              <motion.div key={s} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                <Link to={SECTION_PATH[s]}>
                  <Card className="p-4 h-full group hover:border-primary/50 hover:bg-secondary/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-secondary flex items-center justify-center text-primary shrink-0">
                        <m.icon size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold">{m.label}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{m.desc}</p>
                      </div>
                      <ArrowRight size={15} className="text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </Card>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>

      {!canWrite && (
        <Card className="p-5 text-sm text-muted-foreground">
          You're signed in as <strong className="text-foreground">{roleMeta?.label}</strong>. Ask an administrator
          if you need permission to publish content or change settings.
        </Card>
      )}

      {canWrite && (
        <Card className="p-5">
          <h2 className="font-bold mb-2 text-sm">Quick tips</h2>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
            <li>Upload a logo in <strong>Brand & system</strong> — it swaps across the whole app instantly.</li>
            <li>Send a <strong>Broadcast</strong> and it lands in every member's notification center.</li>
            <li><strong>Activity</strong> is a live audit trail — filter by category or export CSV.</li>
          </ul>
          <Button asChild size="sm" variant="outline" className="mt-4">
            <Link to="/admin/settings">Open brand controls <ArrowRight size={13} className="ml-1" /></Link>
          </Button>
        </Card>
      )}
    </div>
  );
}

