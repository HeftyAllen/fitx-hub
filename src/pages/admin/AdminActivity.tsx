import { useEffect, useMemo, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import Papa from "papaparse";
import {
  Activity, Users, Dumbbell, UtensilsCrossed, ShieldCheck, LifeBuoy,
  Download, RefreshCw, Search, Clock, AlertCircle,
} from "lucide-react";

interface LogRow {
  id: string;
  userId: string;
  userEmail?: string;
  action: string;
  meta?: any;
  createdAt?: any;
}

const GROUP_META: Record<string, { icon: any; tone: string; label: string }> = {
  auth:     { icon: ShieldCheck,      tone: "text-sky-400",     label: "Auth" },
  workout:  { icon: Dumbbell,         tone: "text-primary",     label: "Workouts" },
  plan:     { icon: Dumbbell,         tone: "text-primary",     label: "Plans" },
  meal:     { icon: UtensilsCrossed,  tone: "text-emerald-400", label: "Nutrition" },
  admin:    { icon: ShieldCheck,      tone: "text-amber-400",   label: "Admin" },
  library:  { icon: Activity,         tone: "text-violet-400",  label: "Library" },
  support:  { icon: LifeBuoy,         tone: "text-rose-400",    label: "Support" },
};

function groupOf(action: string) { return action.split(".")[0]; }
function metaOf(action: string) {
  return GROUP_META[groupOf(action)] ?? { icon: Activity, tone: "text-muted-foreground", label: groupOf(action) };
}
function relative(d?: Date) {
  if (!d) return "—";
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
function dayKey(d?: Date) {
  if (!d) return "Unknown";
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const y = new Date(t); y.setDate(y.getDate() - 1);
  if (d >= t) return "Today";
  if (d >= y) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

export default function AdminActivity() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [live, setLive] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "activityLogs"), orderBy("createdAt", "desc"), limit(500)),
      (snap) => {
        if (!live) return;
        setRows(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, [live]);

  const enriched = useMemo(
    () => rows.map(r => ({ ...r, date: r.createdAt?.toDate?.() as Date | undefined })),
    [rows],
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return enriched.filter(r =>
      (!groupFilter || groupOf(r.action) === groupFilter) &&
      (!q || r.userEmail?.toLowerCase().includes(q) || r.userId.includes(q) || r.action.includes(q))
    );
  }, [enriched, search, groupFilter]);

  const groups = useMemo(
    () => Array.from(new Set(rows.map(r => groupOf(r.action)))).sort(),
    [rows],
  );

  /* ── stats ── */
  const now = Date.now();
  const last24 = enriched.filter(r => r.date && now - r.date.getTime() < 864e5);
  const activeUsers = new Set(last24.map(r => r.userId)).size;
  const errors = enriched.filter(r => r.action.includes("error")).length;
  const perDay = useMemo(() => {
    const buckets = Array.from({ length: 14 }, () => 0);
    enriched.forEach(r => {
      if (!r.date) return;
      const idx = 13 - Math.floor((now - r.date.getTime()) / 864e5);
      if (idx >= 0 && idx < 14) buckets[idx]++;
    });
    return buckets;
  }, [enriched, now]);
  const peak = Math.max(1, ...perDay);

  function exportCsv() {
    const csv = Papa.unparse(filtered.map(r => ({
      time: r.date?.toISOString() ?? "",
      user: r.userEmail ?? r.userId,
      action: r.action,
      meta: JSON.stringify(r.meta ?? {}),
    })));
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `activity-${Date.now()}.csv`;
    a.click();
  }

  /* group rows by day for the timeline */
  const byDay = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    filtered.forEach(r => {
      const k = dayKey(r.date);
      if (!map.has(k)) map.set(k, [] as any);
      (map.get(k) as any).push(r);
    });
    return Array.from(map.entries());
  }, [filtered]);

  const stats = [
    { label: "Events (24h)", value: last24.length, icon: Activity, tone: "text-primary" },
    { label: "Active users (24h)", value: activeUsers, icon: Users, tone: "text-sky-400" },
    { label: "Events loaded", value: rows.length, icon: Clock, tone: "text-violet-400" },
    { label: "Errors", value: errors, icon: AlertCircle, tone: errors ? "text-destructive" : "text-muted-foreground" },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight">Activity</h1>
          <p className="text-sm text-muted-foreground">
            Real-time audit trail of everything happening in the app — newest 500 events.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant={live ? "default" : "outline"} size="sm" onClick={() => setLive(l => !l)}>
            <RefreshCw size={14} className={`mr-1 ${live ? "animate-spin" : ""}`} /> {live ? "Live" : "Paused"}
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv}><Download size={14} className="mr-1" /> CSV</Button>
        </div>
      </header>

      {/* stat strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map(s => (
          <Card key={s.label} className="p-4">
            <s.icon size={16} className={s.tone} />
            <div className="text-2xl font-black mt-2">{loading ? "…" : s.value}</div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
          </Card>
        ))}
      </div>

      {/* 14-day sparkline */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold">Last 14 days</p>
          <span className="text-xs text-muted-foreground">peak {peak}</span>
        </div>
        <div className="flex items-end gap-1.5 h-24">
          {perDay.map((v, i) => (
            <motion.div key={i} initial={{ height: 0 }} animate={{ height: `${(v / peak) * 100}%` }}
              transition={{ delay: i * 0.02, type: "spring", damping: 18 }}
              title={`${v} events`}
              className="flex-1 rounded-t-md bg-gradient-to-t from-primary/30 to-primary min-h-[3px]" />
          ))}
        </div>
      </Card>

      {/* filters */}
      <Card className="p-3 flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search user or action…" className="pl-9" />
        </div>
        <div className="flex gap-1 flex-wrap">
          <Button size="sm" variant={!groupFilter ? "default" : "outline"} onClick={() => setGroupFilter("")}>All</Button>
          {groups.map(g => {
            const m = metaOf(g);
            return (
              <Button key={g} size="sm" variant={groupFilter === g ? "default" : "outline"}
                className="gap-1" onClick={() => setGroupFilter(g)}>
                <m.icon size={12} /> {m.label}
              </Button>
            );
          })}
        </div>
      </Card>

      {/* timeline */}
      {byDay.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          {loading ? "Loading events…" : "No events match your filters yet."}
        </Card>
      ) : byDay.map(([day, items]) => (
        <div key={day} className="space-y-2">
          <div className="flex items-center gap-2 sticky top-0 z-10 py-1 bg-background/85 backdrop-blur">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{day}</span>
            <Badge variant="outline" className="text-[10px]">{items.length}</Badge>
          </div>
          <Card className="divide-y divide-border overflow-hidden">
            {items.slice(0, 200).map(r => {
              const m = metaOf(r.action);
              return (
                <div key={r.id} className="flex items-start gap-3 px-4 py-3 hover:bg-secondary/40 transition-colors">
                  <div className={`mt-0.5 h-8 w-8 rounded-xl bg-secondary flex items-center justify-center shrink-0 ${m.tone}`}>
                    <m.icon size={14} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold truncate">{r.userEmail ?? r.userId.slice(0, 10)}</span>
                      <Badge variant="secondary" className="text-[10px] font-mono">{r.action}</Badge>
                    </div>
                    {r.meta && Object.keys(r.meta).length > 0 && (
                      <p className="text-[11px] text-muted-foreground font-mono truncate mt-0.5">
                        {Object.entries(r.meta).map(([k, v]) => `${k}: ${String(v)}`).join(" · ")}
                      </p>
                    )}
                  </div>
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">{relative(r.date)}</span>
                </div>
              );
            })}
          </Card>
        </div>
      ))}
    </div>
  );
}
