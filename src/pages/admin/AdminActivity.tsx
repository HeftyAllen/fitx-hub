import { useEffect, useMemo, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Papa from "papaparse";

interface LogRow {
  id: string;
  userId: string;
  userEmail?: string;
  action: string;
  meta?: any;
  createdAt?: any;
}

export default function AdminActivity() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "activityLogs"), orderBy("createdAt", "desc"), limit(500)),
      (snap) => setRows(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))),
    );
    return unsub;
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return rows.filter(r =>
      (!actionFilter || r.action.startsWith(actionFilter)) &&
      (!q || r.userEmail?.toLowerCase().includes(q) || r.userId.includes(q) || r.action.includes(q))
    );
  }, [rows, search, actionFilter]);

  function exportCsv() {
    const csv = Papa.unparse(filtered.map(r => ({
      time: r.createdAt?.toDate?.()?.toISOString() ?? "",
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

  const actions = Array.from(new Set(rows.map(r => r.action.split(".")[0]))).sort();

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Activity Log</h1>
          <p className="text-sm text-muted-foreground">Latest 500 events</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv}>Export CSV</Button>
      </header>

      <Card className="p-3 flex flex-wrap gap-2">
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search user, action…"
          className="flex-1 min-w-[200px]"
        />
        <div className="flex gap-1 flex-wrap">
          <Button size="sm" variant={!actionFilter ? "default" : "outline"} onClick={() => setActionFilter("")}>All</Button>
          {actions.map(a => (
            <Button key={a} size="sm" variant={actionFilter === a ? "default" : "outline"} onClick={() => setActionFilter(a)}>
              {a}
            </Button>
          ))}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto max-h-[70vh]">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground sticky top-0">
              <tr>
                <th className="text-left px-4 py-2">Time</th>
                <th className="text-left px-4 py-2">User</th>
                <th className="text-left px-4 py-2">Action</th>
                <th className="text-left px-4 py-2">Details</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">
                    {r.createdAt?.toDate?.()?.toLocaleString?.() ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-xs">{r.userEmail ?? r.userId.slice(0, 10)}</td>
                  <td className="px-4 py-2"><Badge variant="outline">{r.action}</Badge></td>
                  <td className="px-4 py-2 text-xs text-muted-foreground font-mono truncate max-w-[400px]">
                    {r.meta && Object.keys(r.meta).length ? JSON.stringify(r.meta) : "—"}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No events match.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
