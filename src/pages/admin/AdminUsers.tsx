import { useEffect, useMemo, useState } from "react";
import {
  collection, deleteDoc, doc, getDoc, onSnapshot, serverTimestamp, setDoc,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Search, ShieldOff, ShieldCheck, Trash2, Send, Users as UsersIcon, Crown,
  Download, MoreHorizontal, Radio, Copy, X, UserCog, Ban,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { logActivity } from "@/lib/activity";
import { toast } from "sonner";
import Papa from "papaparse";
import { ROLE_META, type AdminRole } from "@/lib/permissions";
import { useAdmin } from "@/hooks/useAdmin";

interface UserRow {
  uid: string;
  email?: string;
  name?: string;
  createdAt?: any;
  lastLoginAt?: any;
  suspended?: boolean;
  photoURL?: string;
  memberCode?: string;
  role?: string; // from admins/{uid}
}

const ROLES = ["admin", "moderator", "staff", "readonly"] as const;
type Role = typeof ROLES[number];

type FilterKey = "all" | "staff" | "online" | "suspended";
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Everyone" },
  { key: "staff", label: "Team" },
  { key: "online", label: "Active now" },
  { key: "suspended", label: "Suspended" },
];

function toDate(t: any): Date | null {
  try {
    return t?.toDate?.() ?? (t ? new Date(t) : null);
  } catch { return null; }
}

function fmtDate(t: any): string {
  const d = toDate(t);
  return d ? d.toLocaleString() : "—";
}

function fmtRelative(t: any): string {
  const d = toDate(t);
  if (!d) return "Never";
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return d.toLocaleDateString();
}

function isOnline(lastLoginAt: any): boolean {
  const d = toDate(lastLoginAt);
  return !!d && Date.now() - d.getTime() < 5 * 60 * 1000;
}

function initials(row: UserRow): string {
  const base = row.name || row.email || row.uid;
  const parts = base.replace(/@.*/, "").split(/[\s._-]+/).filter(Boolean);
  return (parts[0]?.[0] ?? "?").concat(parts[1]?.[0] ?? "").toUpperCase();
}

function RoleChip({ role }: { role?: string }) {
  if (!role) return <Badge variant="outline" className="font-medium">Member</Badge>;
  const meta = ROLE_META[role as AdminRole];
  return (
    <Badge className="gap-1 bg-primary/15 text-primary hover:bg-primary/20 border border-primary/25">
      <Crown size={10} /> {meta?.label.split(" ")[0] ?? role}
    </Badge>
  );
}

function StatTile({
  icon: Icon, label, value, tone, loading,
}: { icon: any; label: string; value: number; tone: string; loading: boolean }) {
  return (
    <Card className="relative overflow-hidden p-4 md:p-5">
      <div className={`absolute -right-6 -top-6 h-20 w-20 rounded-full blur-2xl ${tone}`} />
      <div className="relative flex items-center gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary text-foreground/80">
          <Icon size={17} />
        </div>
        <div className="min-w-0">
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
          {loading
            ? <Skeleton className="mt-1.5 h-6 w-10" />
            : <div className="text-2xl font-black leading-tight tabular-nums">{value}</div>}
        </div>
      </div>
    </Card>
  );
}

export default function AdminUsers() {
  const { canManageSystem } = useAdmin();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [admins, setAdmins] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [loading, setLoading] = useState(true);
  const [inviteFor, setInviteFor] = useState<UserRow | null>(null);
  const [inviteRole, setInviteRole] = useState<Role>("moderator");
  const [deleteFor, setDeleteFor] = useState<UserRow | null>(null);
  const [profileFor, setProfileFor] = useState<(UserRow & { role?: string }) | null>(null);
  const [profileData, setProfileData] = useState<any | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // Full profile loader for the drawer
  useEffect(() => {
    if (!profileFor) { setProfileData(null); return; }
    setProfileLoading(true);
    getDoc(doc(db, "users", profileFor.uid, "profile", "data"))
      .then(snap => setProfileData(snap.exists() ? snap.data() : {}))
      .catch(() => setProfileData({}))
      .finally(() => setProfileLoading(false));
  }, [profileFor]);

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
            photoURL: data.photoURL,
            memberCode: data.memberCode,
          };
        });
        out.sort((a, b) => {
          const at = toDate(a.lastLoginAt)?.getTime() ?? 0;
          const bt = toDate(b.lastLoginAt)?.getTime() ?? 0;
          return bt - at;
        });
        setRows(out);
        setLoading(false);
      },
      (err) => { toast.error(err.message); setLoading(false); },
    );
    return unsub;
  }, []);

  const withRoles = useMemo(
    () => rows.map(r => ({ ...r, role: admins[r.uid] })),
    [rows, admins],
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return withRoles
      .filter(r => {
        if (filter === "staff") return !!r.role;
        if (filter === "online") return isOnline(r.lastLoginAt);
        if (filter === "suspended") return !!r.suspended;
        return true;
      })
      .filter(r => !q
        || r.email?.toLowerCase().includes(q)
        || r.name?.toLowerCase().includes(q)
        || r.uid.toLowerCase().includes(q)
        || r.memberCode?.toLowerCase().includes(q));
  }, [withRoles, search, filter]);

  const stats = useMemo(() => ({
    total: rows.length,
    admins: Object.keys(admins).length,
    online: rows.filter(r => isOnline(r.lastLoginAt)).length,
    suspended: rows.filter(r => r.suspended).length,
  }), [rows, admins]);

  const counts: Record<FilterKey, number> = {
    all: stats.total, staff: stats.admins, online: stats.online, suspended: stats.suspended,
  };

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
    try {
      await deleteDoc(doc(db, "users", uid, "profile", "data"));
      await deleteDoc(doc(db, "users", uid));
      logActivity("admin.user.delete", { uid });
      toast.success("User data removed");
    } catch (e: any) { toast.error(e.message); }
    setDeleteFor(null);
  }

  function exportCsv() {
    const csv = Papa.unparse(filtered.map(r => ({
      uid: r.uid, memberCode: r.memberCode ?? "", email: r.email, name: r.name, role: r.role ?? "",
      lastLogin: fmtDate(r.lastLoginAt),
      suspended: r.suspended ? "yes" : "no",
    })));
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `users-${Date.now()}.csv`;
    a.click();
  }

  const rowActions = (r: UserRow & { role?: string }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="More actions">
          <MoreHorizontal size={16} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="truncate text-xs">{r.email ?? r.uid}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setProfileFor(r)}>
          <UserCog size={14} /> View profile
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => { navigator.clipboard?.writeText(r.memberCode ?? r.uid); toast.success("Member ID copied"); }}>
          <Copy size={14} /> Copy member ID
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => { navigator.clipboard?.writeText(r.uid); toast.success("UID copied"); }}>
          <Copy size={14} /> Copy UID
        </DropdownMenuItem>
        {r.email && (
          <DropdownMenuItem onClick={() => { navigator.clipboard?.writeText(r.email!); toast.success("Email copied"); }}>
            <Copy size={14} /> Copy email
          </DropdownMenuItem>
        )}
        {canManageSystem && !r.role && (
          <DropdownMenuItem onClick={() => { setInviteFor(r); setInviteRole("moderator"); }}>
            <Send size={14} /> Invite to team
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => suspend(r.uid, !r.suspended)}>
          {r.suspended ? <><ShieldCheck size={14} /> Reinstate</> : <><ShieldOff size={14} /> Suspend</>}
        </DropdownMenuItem>
        {canManageSystem && (
          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteFor(r)}>
            <Trash2 size={14} /> Delete data
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const roleControl = (r: UserRow & { role?: string }) =>
    r.role ? (
      canManageSystem ? (
        <Select value={r.role} onValueChange={(v) => setRole(r.uid, v === "none" ? null : v)}>
          <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Demote to member</SelectItem>
            {ROLES.map(role => (
              <SelectItem key={role} value={role}>{ROLE_META[role].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : <RoleChip role={r.role} />
    ) : <RoleChip />;

  return (
    <div className="space-y-6">
      {/* Hero header */}
      <Card className="relative overflow-hidden border-primary/20 p-5 md:p-7">
        <div className="pointer-events-none absolute inset-0 opacity-70">
          <div className="absolute -left-10 -top-16 h-52 w-52 rounded-full bg-primary/25 blur-3xl" />
          <div className="absolute right-0 top-10 h-40 w-40 rounded-full bg-accent/20 blur-3xl" />
        </div>
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-primary">
              <Radio size={10} className="animate-pulse" /> Live directory
            </div>
            <h1 className="text-3xl font-black tracking-tight md:text-4xl">People</h1>
            <p className="mt-1 max-w-lg text-sm text-muted-foreground">
              Every account in one place — search, promote, suspend and audit in real time.
            </p>
          </div>
          <Button variant="outline" size="sm" className="gap-2" onClick={exportCsv}>
            <Download size={14} /> Export CSV
          </Button>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={UsersIcon} label="Total accounts" value={stats.total} tone="bg-primary/30" loading={loading} />
        <StatTile icon={Crown} label="Team members" value={stats.admins} tone="bg-accent/30" loading={loading} />
        <StatTile icon={Radio} label="Active now" value={stats.online} tone="bg-success/30" loading={loading} />
        <StatTile icon={Ban} label="Suspended" value={stats.suspended} tone="bg-destructive/30" loading={loading} />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name, email or UID…"
            className="h-11 rounded-xl pl-9 pr-9"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-card/50 p-1">
          {FILTERS.map(f => {
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`relative shrink-0 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                  active ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="users-filter-pill"
                    className="absolute inset-0 rounded-lg bg-primary"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <span className="relative flex items-center gap-1.5">
                  {f.label}
                  <span className={`rounded-md px-1.5 py-0.5 text-[10px] tabular-nums ${active ? "bg-primary-foreground/20" : "bg-secondary"}`}>
                    {counts[f.key]}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Desktop table */}
      <Card className="hidden overflow-hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-3 text-left font-semibold">Member</th>
                <th className="px-5 py-3 text-left font-semibold">Last seen</th>
                <th className="px-5 py-3 text-left font-semibold">Access</th>
                <th className="px-5 py-3 text-left font-semibold">Status</th>
                <th className="px-5 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && [...Array(5)].map((_, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="px-5 py-4" colSpan={5}><Skeleton className="h-9 w-full" /></td>
                </tr>
              ))}

              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-16 text-center">
                    <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-secondary text-muted-foreground">
                      <UsersIcon size={20} />
                    </div>
                    <p className="mt-3 font-semibold">No members match</p>
                    <p className="text-sm text-muted-foreground">Try a different search or filter.</p>
                  </td>
                </tr>
              )}

              {!loading && filtered.map((r, i) => {
                const online = isOnline(r.lastLoginAt);
                return (
                  <motion.tr
                    key={r.uid}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18, delay: Math.min(i * 0.02, 0.2) }}
                    className="group border-t border-border transition-colors hover:bg-secondary/40"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <Avatar className="h-9 w-9 border border-border">
                            {r.photoURL && <AvatarImage src={r.photoURL} alt={r.name || r.email || "Member"} />}
                            <AvatarFallback className="bg-primary/15 text-xs font-bold text-primary">
                              {initials(r)}
                            </AvatarFallback>
                          </Avatar>
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card ${
                              online ? "bg-success" : "bg-muted-foreground/40"
                            }`}
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-semibold">{r.name || r.email?.split("@")[0] || r.uid.slice(0, 8)}</div>
                          <div className="truncate text-xs text-muted-foreground">{r.email ?? r.uid}</div>
                          <div className="mt-0.5 font-mono text-[10px] text-muted-foreground/70">{r.memberCode ?? r.uid.slice(0, 10)}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-xs text-muted-foreground">{fmtRelative(r.lastLoginAt)}</span>
                        </TooltipTrigger>
                        <TooltipContent>{fmtDate(r.lastLoginAt)}</TooltipContent>
                      </Tooltip>
                    </td>
                    <td className="px-5 py-3.5">{roleControl(r)}</td>
                    <td className="px-5 py-3.5">
                      {r.suspended
                        ? <Badge variant="destructive" className="gap-1"><Ban size={10} /> Suspended</Badge>
                        : <Badge className="gap-1 border border-success/25 bg-success/15 text-success hover:bg-success/20">
                            <ShieldCheck size={10} /> Active
                          </Badge>}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        {canManageSystem && !r.role && (
                          <Button
                            size="sm" variant="outline"
                            className="h-8 gap-1.5 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                            onClick={() => { setInviteFor(r); setInviteRole("moderator"); }}
                          >
                            <UserCog size={13} /> Promote
                          </Button>
                        )}
                        {rowActions(r)}
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {loading && [...Array(4)].map((_, i) => (
          <Card key={i} className="p-4"><Skeleton className="h-16 w-full" /></Card>
        ))}
        {!loading && filtered.length === 0 && (
          <Card className="p-10 text-center">
            <p className="font-semibold">No members match</p>
            <p className="text-sm text-muted-foreground">Try a different search or filter.</p>
          </Card>
        )}
        {!loading && filtered.map(r => {
          const online = isOnline(r.lastLoginAt);
          return (
            <Card key={r.uid} className="p-4">
              <div className="flex items-start gap-3">
                <div className="relative">
                  <Avatar className="h-10 w-10 border border-border">
                    {r.photoURL && <AvatarImage src={r.photoURL} alt={r.name || r.email || "Member"} />}
                    <AvatarFallback className="bg-primary/15 text-xs font-bold text-primary">{initials(r)}</AvatarFallback>
                  </Avatar>
                  <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card ${online ? "bg-success" : "bg-muted-foreground/40"}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{r.name || r.email?.split("@")[0] || r.uid.slice(0, 8)}</div>
                  <div className="truncate text-xs text-muted-foreground">{r.email ?? r.uid}</div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <RoleChip role={r.role} />
                    {r.suspended
                      ? <Badge variant="destructive" className="gap-1"><Ban size={10} /> Suspended</Badge>
                      : <Badge className="gap-1 border border-success/25 bg-success/15 text-success">Active</Badge>}
                    <span className="text-[11px] text-muted-foreground">{fmtRelative(r.lastLoginAt)}</span>
                  </div>
                </div>
                {rowActions(r)}
              </div>
              {canManageSystem && r.role && (
                <div className="mt-3">{roleControl(r)}</div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Invite dialog */}
      <Dialog open={!!inviteFor} onOpenChange={(o) => !o && setInviteFor(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><UserCog size={18} /> Promote to team</DialogTitle>
            <DialogDescription>
              {inviteFor?.email ?? inviteFor?.uid} will see a banner asking them to accept. On accept they sign back in with console access.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Role</label>
            <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as Role)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLES.filter(r => r !== "readonly").map(r => (
                  <SelectItem key={r} value={r}>{ROLE_META[r].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{ROLE_META[inviteRole]?.blurb}</p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setInviteFor(null)}>Cancel</Button>
            <Button onClick={sendInvite} className="gap-2"><Send size={14} /> Send invite</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Profile viewer */}
      <Dialog open={!!profileFor} onOpenChange={(o) => !o && setProfileFor(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <Avatar className="h-10 w-10 border border-border">
                {profileFor?.photoURL && <AvatarImage src={profileFor.photoURL} alt="Member avatar" />}
                <AvatarFallback className="bg-primary/15 text-xs font-bold text-primary">
                  {profileFor ? initials(profileFor) : "?"}
                </AvatarFallback>
              </Avatar>
              <span className="min-w-0">
                <span className="block truncate">{profileFor?.name || profileFor?.email || profileFor?.uid}</span>
                <span className="block font-mono text-[11px] font-normal text-muted-foreground">
                  {profileFor?.memberCode ?? profileFor?.uid}
                </span>
              </span>
            </DialogTitle>
            <DialogDescription>Read-only snapshot of this member's stored profile.</DialogDescription>
          </DialogHeader>

          {profileLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                ["Email", profileFor?.email ?? "—"],
                ["Access", profileFor?.role ? (ROLE_META[profileFor.role as AdminRole]?.label ?? profileFor.role) : "Member"],
                ["Status", profileFor?.suspended ? "Suspended" : "Active"],
                ["Joined", fmtDate(profileFor?.createdAt)],
                ["Last seen", fmtRelative(profileFor?.lastLoginAt)],
                ["Goal", profileData?.goal ?? profileData?.goalType ?? "—"],
                ["Activity level", profileData?.activityLevel ?? "—"],
                ["Units", profileData?.units ?? "metric"],
                ["Height", profileData?.height ?? "—"],
                ["Weight", profileData?.weight ?? "—"],
                ["Gender", profileData?.gender ?? "—"],
                ["Daily calories", profileData?.targets?.calories ?? profileData?.calorieTarget ?? "—"],
              ].map(([k, v]) => (
                <div key={String(k)} className="rounded-xl border border-border bg-secondary/40 p-3">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{k}</div>
                  <div className="mt-0.5 truncate font-medium">{String(v)}</div>
                </div>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setProfileFor(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteFor} onOpenChange={(o) => !o && setDeleteFor(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this member's data?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the stored profile and activity for {deleteFor?.email ?? deleteFor?.uid}. Their sign-in account remains until removed from authentication.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteFor && removeUser(deleteFor.uid)}
            >
              Delete data
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
