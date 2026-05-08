import { useEffect, useMemo, useState } from "react";
import {
  collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, ShieldOff, ShieldCheck, Trash2, Send, Circle } from "lucide-react";
import { logActivity } from "@/lib/activity";
import { toast } from "sonner";
import Papa from "papaparse";

interface UserRow {
  uid: string;
  email?: string;
  name?: string;
  createdAt?: any;
  lastLoginAt?: any;
  suspended?: boolean;
  role?: string; // from admins/{uid}
}

const ROLES = ["admin", "moderator", "staff", "readonly"] as const;
type Role = typeof ROLES[number];

function fmtDate(t: any): string {
  try {
    const d = t?.toDate?.() ?? (t ? new Date(t) : null);
    return d ? d.toLocaleString() : "—";
  } catch { return "—"; }
}

function isOnline(lastLoginAt: any): boolean {
  // Heuristic: signed in within the last 5 minutes
  try {
    const d = lastLoginAt?.toDate?.() ?? (lastLoginAt ? new Date(lastLoginAt) : null);
    if (!d) return false;
    return Date.now() - d.getTime() < 5 * 60 * 1000;
  } catch { return false; }
}

export default function AdminUsers() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [admins, setAdmins] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [inviteFor, setInviteFor] = useState<UserRow | null>(null);
  const [inviteRole, setInviteRole] = useState<Role>("moderator");

  // Live admins map
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "admins"), (snap) => {
      const m: Record<string, string> = {};
      snap.forEach(d => { m[d.id] = (d.data().role as string) ?? "readonly"; });
      setAdmins(m);
    });
    return unsub;
  }, []);

  // Live users — reads our `users/{uid}` summary doc written on signup/login.
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "users"),
      (snap) => {
        const out: UserRow[] = snap.docs.map(d => {
          const data = d.data() as any;
          return {
            uid: d.id,
            email: data.email,
            name: data.name,
            createdAt: data.createdAt,
            lastLoginAt: data.lastLoginAt,
            suspended: !!data.suspended,
          };
        });
        out.sort((a, b) => {
          const at = a.lastLoginAt?.toDate?.()?.getTime?.() ?? 0;
          const bt = b.lastLoginAt?.toDate?.()?.getTime?.() ?? 0;
          return bt - at;
        });
        setRows(out);
        setLoading(false);
      },
      (err) => { toast.error(err.message); setLoading(false); },
    );
    return unsub;
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return rows.map(r => ({ ...r, role: admins[r.uid] }))
      .filter(r => !q
        || r.email?.toLowerCase().includes(q)
        || r.name?.toLowerCase().includes(q)
        || r.uid.toLowerCase().includes(q));
  }, [rows, admins, search]);

  const stats = useMemo(() => ({
    total: rows.length,
    admins: Object.keys(admins).length,
    online: rows.filter(r => isOnline(r.lastLoginAt)).length,
  }), [rows, admins]);

  async function setRole(uid: string, role: string | null) {
    try {
      if (role === null || role === "none") {
        await deleteDoc(doc(db, "admins", uid));
      } else {
        await setDoc(doc(db, "admins", uid), { role, updatedAt: serverTimestamp() }, { merge: true });
      }
      logActivity("admin.role.change", { uid, role });
      toast.success("Role updated");
    } catch (e: any) {
      toast.error(e.message ?? "Update failed");
    }
  }

  async function sendInvite() {
    if (!inviteFor) return;
    try {
      const id = `inv_${Date.now()}`;
      await setDoc(doc(db, "users", inviteFor.uid, "adminInvites", id), {
        role: inviteRole,
        invitedByEmail: auth.currentUser?.email ?? null,
        invitedByUid: auth.currentUser?.uid ?? null,
        invitedAt: serverTimestamp(),
      });
      logActivity("admin.invite.send", { uid: inviteFor.uid, role: inviteRole });
      toast.success(`Invitation sent to ${inviteFor.email ?? inviteFor.uid}`);
      setInviteFor(null);
    } catch (e: any) {
      toast.error(e.message ?? "Could not send invite");
    }
  }

  async function suspend(uid: string, suspended: boolean) {
    try {
      await setDoc(doc(db, "users", uid), { suspended }, { merge: true });
      await setDoc(doc(db, "users", uid, "profile", "data"), { suspended }, { merge: true });
      logActivity("admin.user.suspend", { uid, suspended });
      toast.success(suspended ? "User suspended" : "User reinstated");
    } catch (e: any) { toast.error(e.message); }
  }

  async function removeUser(uid: string) {
    if (!confirm("Delete this user's Firestore data? (Auth account stays — delete in Firebase console.)")) return;
    try {
      await deleteDoc(doc(db, "users", uid, "profile", "data"));
      await deleteDoc(doc(db, "users", uid));
      logActivity("admin.user.delete", { uid });
      toast.success("User data removed");
    } catch (e: any) { toast.error(e.message); }
  }

  function exportCsv() {
    const csv = Papa.unparse(filtered.map(r => ({
      uid: r.uid, email: r.email, name: r.name, role: r.role ?? "",
      lastLogin: fmtDate(r.lastLoginAt),
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
          <p className="text-sm text-muted-foreground">Real-time list of every signed-up account.</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv}>Export CSV</Button>
      </header>

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Total users</div>
          <div className="text-2xl font-bold mt-1">{stats.total}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Admins</div>
          <div className="text-2xl font-bold mt-1">{stats.admins}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <Circle size={8} className="fill-green-500 text-green-500" /> Active now
          </div>
          <div className="text-2xl font-bold mt-1">{stats.online}</div>
        </Card>
      </div>

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
                <th className="text-left px-4 py-3">Last seen</th>
                <th className="text-left px-4 py-3">Role</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No users yet.</td></tr>
              )}
              {filtered.map(r => {
                const online = isOnline(r.lastLoginAt);
                return (
                  <tr key={r.uid} className="border-t border-border hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Circle size={8} className={online ? "fill-green-500 text-green-500" : "fill-muted-foreground/30 text-muted-foreground/30"} />
                        <div>
                          <div className="font-medium">{r.name || r.email || r.uid.slice(0, 8)}</div>
                          <div className="text-xs text-muted-foreground">{r.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDate(r.lastLoginAt)}</td>
                    <td className="px-4 py-3">
                      {r.role
                        ? <Select value={r.role} onValueChange={(v) => setRole(r.uid, v === "none" ? null : v)}>
                            <SelectTrigger className="h-8 w-[130px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Demote to user</SelectItem>
                              {ROLES.map(role => <SelectItem key={role} value={role}>{role}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        : <Badge variant="outline">User</Badge>}
                    </td>
                    <td className="px-4 py-3">
                      {r.suspended
                        ? <Badge variant="destructive">Suspended</Badge>
                        : <Badge variant="secondary">Active</Badge>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-1">
                        {!r.role && (
                          <Button size="sm" variant="outline" className="gap-1" title="Invite as admin"
                            onClick={() => { setInviteFor(r); setInviteRole("moderator"); }}>
                            <Send size={12} /> Invite
                          </Button>
                        )}
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
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Invite dialog */}
      {inviteFor && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur flex items-center justify-center p-4" onClick={() => setInviteFor(null)}>
          <Card className="w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div>
              <h3 className="text-lg font-semibold">Invite as admin</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {inviteFor.email ?? inviteFor.uid} will see a banner asking them to accept. On accept they're signed out and sign back in with admin access.
              </p>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Role</label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as Role)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.filter(r => r !== "readonly").map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setInviteFor(null)}>Cancel</Button>
              <Button onClick={sendInvite} className="gap-2"><Send size={14} /> Send invite</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
