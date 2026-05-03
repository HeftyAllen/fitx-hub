import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import Papa from "papaparse";

interface Bucket { day: string; count: number; }

export default function AdminReports() {
  const [signups, setSignups] = useState<Bucket[]>([]);
  const [activity, setActivity] = useState<Bucket[]>([]);
  const [topActions, setTopActions] = useState<{ action: string; count: number }[]>([]);

  useEffect(() => {
    (async () => {
      // signups: from users/{uid}/profile/data createdAt
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

      // activity: last 1000 events grouped by day + action
      try {
        const snap = await getDocs(query(collection(db, "activityLogs"), orderBy("createdAt", "desc"), limit(1000)));
        const dayB: Record<string, number> = {};
        const actB: Record<string, number> = {};
        snap.forEach(d => {
          const x = d.data();
          const day = x.createdAt?.toDate?.()?.toISOString?.()?.slice(0, 10);
          if (day) dayB[day] = (dayB[day] ?? 0) + 1;
          actB[x.action] = (actB[x.action] ?? 0) + 1;
        });
        setActivity(Object.entries(dayB).sort().map(([day, count]) => ({ day, count })));
        setTopActions(Object.entries(actB).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([action, count]) => ({ action, count })));
      } catch { /* noop */ }
    })();
  }, []);

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
        <h1 className="text-3xl font-bold">Reports</h1>
        <p className="text-sm text-muted-foreground">Trends and exportable analytics.</p>
      </header>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold">Signups (last 30 days)</h2>
          <Button size="sm" variant="outline" onClick={downloadCsv(signups, "signups")}>Export</Button>
        </div>
        <div className="h-64">
          <ResponsiveContainer>
            <BarChart data={signups}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" tick={{ fontSize: 10 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
              <Bar dataKey="count" fill="hsl(var(--primary))" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold">Activity per day</h2>
          <Button size="sm" variant="outline" onClick={downloadCsv(activity, "activity-per-day")}>Export</Button>
        </div>
        <div className="h-64">
          <ResponsiveContainer>
            <BarChart data={activity}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" tick={{ fontSize: 10 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
              <Bar dataKey="count" fill="hsl(var(--primary))" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold">Top actions</h2>
          <Button size="sm" variant="outline" onClick={downloadCsv(topActions, "top-actions")}>Export</Button>
        </div>
        <ul className="text-sm divide-y divide-border">
          {topActions.map(a => (
            <li key={a.action} className="py-2 flex justify-between"><span className="font-mono text-xs">{a.action}</span><span>{a.count}</span></li>
          ))}
          {topActions.length === 0 && <li className="py-4 text-muted-foreground text-center">No data yet.</li>}
        </ul>
      </Card>
    </div>
  );
}
