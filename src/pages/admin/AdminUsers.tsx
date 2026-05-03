import { useEffect, useMemo, useState } from "react";
import {
  collection, deleteDoc, doc, getDocs, onSnapshot, query,
  serverTimestamp, setDoc, updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, ShieldOff, ShieldCheck, Trash2, UserCog, Eye } from "lucide-react";
import { logActivity } from "@/lib/activity";
import { toast } from "sonner";
import Papa from "papaparse";

interface UserRow {
  uid: string;
  email?: string;
  name?: string;
  createdAt?: any;
  suspended?: boolean;
  role?: string;       // from admins/{uid}
}

const ROLES = ["admin", "moderator", "staff", "readonly"] as const;

export default function AdminUsers() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [admins, setAdmins] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // Admins live (so role updates reflect immediately)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "admins"), (snap) => {
      const m: Record<string, string> = {};
      snap.forEach(d => { m[d.id] = (d.data().role as string) ?? "readonly"; });
      setAdmins(m);
    });
    return unsub;
  }, []);

  // Users — read profile docs (users/{uid}/profile/data)
  useEffect(() => {
    (async () => {
      try {
        const usersSnap = await getDocs(collection(db, "users"));
        const out: UserRow[] = [];
        for (const u of usersSnap.docs) {
          const profSnap = await getDocs(query(collection(db, "users", u.id, "profile")));
          const data = profSnap.docs.find(p => p.id === "data")?.data() ?? {};
          out.push({
            uid: u.id,
            email: data.email,
            name: data.name,
            createdAt: data.createdAt,
            suspended: !!data.suspended,
          });
        }
        setRows(out);
      } catch (e) {
        toast.error("Failed to load users");
      } finally { setLoading(false); }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return rows.map(r => ({ ...r, role: admins[r.uid] }))
      .filter(r => !q
        || r.email?.toLowerCase().includes(q)
        || r.name?.toLowerCase().includes(q)
        || r.uid.toLowerCase().includes(q));
  }, [rows, admins, search]);

  async function setRole(uid: string, role: string | null) {
    try {
      if (role === null || role === "none") {
        await deleteDoc(doc(db, "admins", uid));
      } else {
        await setDoc(doc(db, "admins", uid), { role, updatedAt: serverTimestamp() }, { merge: true });
      }
      logActivity("admin.role.change", { uid, role });
      toast.success(`Role updated`);
    } catch (e: any) {
      toast.error(e.message ?? "Update failed");
    }
  }

  async function suspend(uid: string, suspended: boolean) {
    try {
      await setDoc(doc(db, "users", uid, "profile", "data"), { suspended }, { merge: true });
      logActivity("admin.user.suspend", { uid, suspended });
      toast.success(suspended ? "User suspended" : "User reinstated");
    } catch (e: any) { toast.error(e.message); }
  }

  async function removeUser(uid: string) {
    if (!confirm("Delete this user's Firestore data? (auth account stays — delete in Firebase console)")) return;
    try {
      await deleteDoc(doc(db, "users", uid, "profile", "data"));
      logActivity("admin.user.delete", { uid });
      toast.success("User data removed");
      setRows(rows.filter(r => r.uid !== uid));
    } catch (e: any) { toast.error(e.message); }
  }

  function exportCsv() {
    const csv = Papa.unparse(filtered.map(r => ({
      uid: r.uid, email: r.email, name: r.name, role: r.role ?? "",
      suspended: r.suspended ? "yes" : "no",
    })));
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `users-${Date.now()}.csv`;
    a.click();
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Users</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} of {rows.length} accounts</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv}>Export CSV</Button>
      </header>

      <Card className="p-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search email, name, or uid…"
            className="pl-9"
          />
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">User</th>
                <th className="text-left px-4 py-3">Role</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No users.</td></tr>
              )}
              {filtered.map(r => (
                <tr key={r.uid} className="border-t border-border hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="font-medium">{r.name || r.email || r.uid.slice(0, 8)}</div>
                    <div className="text-xs text-muted-foreground">{r.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <Select value={r.role ?? "none"} onValueChange={(v) => setRole(r.uid, v === "none" ? null : v)}>
                      <SelectTrigger className="h-8 w-[130px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">User</SelectItem>
                        {ROLES.map(role => <SelectItem key={role} value={role}>{role}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-3">
                    {r.suspended
                      ? <Badge variant="destructive">Suspended</Badge>
                      : <Badge variant="secondary">Active</Badge>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-1">
                      <Button size="sm" variant="ghost" title="View as user (read-only)"
                        onClick={() => window.open(`/admin/users/view/${r.uid}`, "_blank")}>
                        <Eye size={14} />
                      </Button>
                      <Button size="sm" variant="ghost" title={r.suspended ? "Reinstate" : "Suspend"}
                        onClick={() => suspend(r.uid, !r.suspended)}>
                        {r.suspended ? <ShieldCheck size={14} /> : <ShieldOff size={14} />}
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive"
                        onClick={() => removeUser(r.uid)}>
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
