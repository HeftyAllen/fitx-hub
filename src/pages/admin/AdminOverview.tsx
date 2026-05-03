import { useEffect, useState } from "react";
import { collection, getCountFromServer, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card } from "@/components/ui/card";
import { Activity, Users as UsersIcon, Megaphone, LifeBuoy, AlertCircle, Zap } from "lucide-react";
import { getDailyUsage } from "@/lib/spoonacular";

type Stat = { label: string; value: string | number; icon: any; tone?: string; sub?: string };

export default function AdminOverview() {
  const [stats, setStats] = useState<Stat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [activityCount, openTickets, announcements, recentLogs] = await Promise.all([
          getCountFromServer(query(collection(db, "activityLogs"))).then(s => s.data().count).catch(() => 0),
          getCountFromServer(query(collection(db, "supportTickets"), where("status", "==", "open"))).then(s => s.data().count).catch(() => 0),
          getCountFromServer(collection(db, "announcements")).then(s => s.data().count).catch(() => 0),
          getDocs(query(collection(db, "activityLogs"), orderBy("createdAt", "desc"), limit(50))).catch(() => null),
        ]);

        const uniqueUsers = recentLogs ? new Set(recentLogs.docs.map(d => d.data().userId)).size : 0;
        const errors = recentLogs ? recentLogs.docs.filter(d => String(d.data().action ?? "").includes("error")).length : 0;
        const usage = getDailyUsage();

        setStats([
          { label: "Activity events",  value: activityCount, icon: Activity, sub: "lifetime" },
          { label: "Active users (50)", value: uniqueUsers,   icon: UsersIcon, sub: "recent slice" },
          { label: "Open tickets",     value: openTickets,   icon: LifeBuoy, tone: openTickets > 0 ? "text-amber-500" : undefined },
          { label: "Announcements",    value: announcements, icon: Megaphone },
          { label: "Errors logged",    value: errors,        icon: AlertCircle, tone: errors > 0 ? "text-destructive" : undefined },
          { label: "Spoonacular today", value: `${usage.used}/${usage.limit}`, icon: Zap, sub: `resets in ${usage.resetIn}` },
        ]);
      } finally { setLoading(false); }
    })();
  }, []);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold">Overview</h1>
        <p className="text-sm text-muted-foreground">Key metrics at a glance.</p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {(loading ? Array.from({ length: 6 }).map((_, i) => ({ label: "", value: "", icon: Activity, sub: "" } as Stat)) : stats).map((s, i) => (
          <Card key={i} className="p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <s.icon size={18} className={s.tone ?? "text-primary"} />
              {s.sub && <span className="text-[10px] text-muted-foreground">{s.sub}</span>}
            </div>
            <div className={`text-2xl font-bold ${s.tone ?? ""}`}>{loading ? "…" : s.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{s.label || "Loading"}</div>
          </Card>
        ))}
      </div>

      <Card className="p-6">
        <h2 className="font-semibold mb-2">Quick tips</h2>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
          <li>Use <strong>Users</strong> to assign roles or suspend an account.</li>
          <li>Send an <strong>Announcement</strong> — it appears in every user's notification center.</li>
          <li>Open <strong>Reports</strong> for trends and CSV exports.</li>
        </ul>
      </Card>
    </div>
  );
}
