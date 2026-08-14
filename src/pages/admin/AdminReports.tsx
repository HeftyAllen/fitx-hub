import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Download } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
} from "recharts";
import Papa from "papaparse";

interface Bucket { day: string; count: number; }

function fmtDay(day: string) {
  const d = new Date(`${day}T00:00:00`);
  return isNaN(d.getTime()) ? day : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function Stat({ label, value, sub, loading }: { label: string; value: string | number; sub?: string; loading?: boolean }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      {loading
        ? <Skeleton className="mt-2 h-8 w-16" />
        : (
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-3xl font-black tabular-nums tracking-tight">{value}</span>
            {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
          </div>
        )}
    </div>
  );
}

export default function AdminReports() {
  const [signups, setSignups] = useState<Bucket[]>([]);
  const [activity, setActivity] = useState<Bucket[]>([]);
  const [topActions, setTopActions] = useState<{ action: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const usersSnap = await getDocs(collection(db, "users"));
        const buckets: Record<string, number> = {};
        for (const u of usersSnap.docs) {
          const profSnap = await getDocs(query(collection(db, "users", u.id, "profile")));
          const data = profSnap.docs.find(p => p.id === "data")?.data() ?? {};
          const ts = data.createdAt?.toDate?.();
          if (!ts) continue;
          const day = ts.toISOString().slice(0, 10);
          buckets[day] = (buckets[day] ?? 0) + 1;
        }
        setSignups(Object.entries(buckets).sort().slice(-30).map(([day, count]) => ({ day, count })));
      } catch { /* noop */ }

      try {
        const snap = await getDocs(query(collection(db, "activityLogs"), orderBy("createdAt", "desc"), limit(1000)));
        const dayB: Record<string, number> = {};
        const actB: Record<string, number> = {};
        snap.forEach(d => {
          const x = d.data();
          const day = x.createdAt?.toDate?.()?.toISOString?.()?.slice(0, 10);
          if (day) dayB[day] = (dayB[day] ?? 0) + 1;
          if (x.action) actB[x.action] = (actB[x.action] ?? 0) + 1;
        });
        setActivity(Object.entries(dayB).sort().map(([day, count]) => ({ day, count })));
        setTopActions(Object.entries(actB).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([action, count]) => ({ action, count })));
      } catch { /* noop */ }

      setLoading(false);
    })();
  }, []);

  const totals = useMemo(() => {
    const totalEvents = activity.reduce((s, b) => s + b.count, 0);
    const peak = activity.reduce<Bucket | null>((best, b) => (!best || b.count > best.count ? b : best), null);
    const signupTotal = signups.reduce((s, b) => s + b.count, 0);
    const lastSignup = signups.length ? signups[signups.length - 1].day : null;
    return { totalEvents, activeDays: activity.length, peak, signupTotal, lastSignup };
  }, [activity, signups]);

  const maxAction = topActions[0]?.count ?? 1;

  const downloadCsv = (rows: any[], name: string) => () => {
    const blob = new Blob([Papa.unparse(rows)], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${name}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-black tracking-tight md:text-4xl">Reports</h1>
        <p className="text-sm text-muted-foreground">Trends and exportable analytics.</p>
      </header>

      {/* Headline stats — no chrome, just numbers */}
      <div className="grid grid-cols-2 gap-6 md:grid-cols-3">
        <Stat label="Total events" value={totals.totalEvents} loading={loading} />
        <Stat label="Active days" value={totals.activeDays} loading={loading} />
        <Stat
          label="Peak day"
          value={totals.peak?.count ?? 0}
          sub={totals.peak ? `on ${fmtDay(totals.peak.day)}` : undefined}
          loading={loading}
        />
      </div>

      {/* Signups — a single number, not a one-bar chart */}
      <Card className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold">Signups</h2>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </div>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={downloadCsv(signups, "signups")}>
            <Download size={13} /> Export
          </Button>
        </div>
        {loading ? <Skeleton className="mt-4 h-14 w-24" /> : (
          <>
            <div className="mt-3 text-5xl font-black tabular-nums tracking-tight">{totals.signupTotal}</div>
            <p className="mt-2 text-sm text-muted-foreground">
              {totals.lastSignup
                ? `Most recent signup was recorded on ${new Date(`${totals.lastSignup}T00:00:00`).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}.`
                : "No signups recorded in this window yet."}
            </p>
            {signups.length > 1 && (
              <div className="mt-4 h-28">
                <ResponsiveContainer>
                  <BarChart data={signups}>
                    <XAxis dataKey="day" tickFormatter={fmtDay} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      labelFormatter={(l) => fmtDay(String(l))}
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }}
                    />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={26} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Activity per day */}
      <Card className="p-5">
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-lg font-bold">Activity per day</h2>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={downloadCsv(activity, "activity-per-day")}>
            <Download size={13} /> Export
          </Button>
        </div>
        {loading ? <Skeleton className="h-64 w-full" /> : activity.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">No activity recorded yet.</p>
        ) : (
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={activity}>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tickFormatter={fmtDay} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={24} />
                <Tooltip
                  labelFormatter={(l) => fmtDay(String(l))}
                  cursor={{ fill: "hsl(var(--muted) / 0.35)" }}
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={28}>
                  {activity.map(b => (
                    <Cell
                      key={b.day}
                      fill={b.day === totals.peak?.day ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.55)"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* Top actions with inline bars */}
      <Card className="p-5">
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-lg font-bold">Top actions</h2>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={downloadCsv(topActions, "top-actions")}>
            <Download size={13} /> Export
          </Button>
        </div>
        <div className="space-y-3">
          {loading && [...Array(4)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
          {!loading && topActions.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">No data yet.</p>
          )}
          {!loading && topActions.map(a => (
            <div key={a.action}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate font-mono text-xs">{a.action}</span>
                <span className="text-sm font-bold tabular-nums">{a.count}</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${Math.max(4, (a.count / maxAction) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
