import { useEffect, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  setDoc,
  serverTimestamp,
  updateDoc,
  type DocumentData,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useAdmin } from "@/hooks/useAdmin";
import { useOnline } from "@/hooks/useOnline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Users, Plus, CheckCircle2, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
type Row = DocumentData & { id: string };
export default function AdminCoaching() {
  const { user } = useAuth();
  const { role, canManageSystem } = useAdmin();
  const online = useOnline();
  const [assignments, setAssignments] = useState<Row[]>([]);
  const [members, setMembers] = useState<Row[]>([]);
  const [coaches, setCoaches] = useState<Row[]>([]);
  const [notes, setNotes] = useState<Row[]>([]);
  const [active, setActive] = useState<string>("");
  const [memberId, setMemberId] = useState("");
  const [coachId, setCoachId] = useState("");
  const [goal, setGoal] = useState("");
  const [note, setNote] = useState("");
  const [nextDate, setNextDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!user || !role) return;
    setAssignments([]);
    setNotes([]);
    setActive("");
    const q = query(
      collection(db, "coachAssignments"),
      ...(canManageSystem ? [] : [where("coachId", "==", user.uid)]),
    );
    const stop = onSnapshot(
      q,
      (snap) => {
        setAssignments(snap.docs.map((d) => ({ ...d.data(), id: d.id })));
        setError("");
      },
      () =>
        setError(
          "Assignments could not load. Check your connection and access.",
        ),
    );
    const stops = [stop];
    if (canManageSystem) {
      stops.push(
        onSnapshot(
          collection(db, "users"),
          (snap) =>
            setMembers(snap.docs.map((d) => ({ ...d.data(), id: d.id }))),
          () => setError("Could not load the member directory."),
        ),
      );
      stops.push(
        onSnapshot(
          query(collection(db, "admins"), where("role", "==", "coach")),
          (snap) =>
            setCoaches(snap.docs.map((d) => ({ ...d.data(), id: d.id }))),
          () => setError("Could not load coaches."),
        ),
      );
    }
    return () => stops.forEach((s) => s());
  }, [user, role, canManageSystem]);
  useEffect(() => {
    setNote("");
    setNextDate("");
    setNotes([]);
    if (!active) return;
    return onSnapshot(
      query(
        collection(db, "coachAssignments", active, "checkIns"),
        orderBy("createdAt", "desc"),
        limit(30),
      ),
      (snap) => setNotes(snap.docs.map((d) => ({ ...d.data(), id: d.id }))),
      () => setError("Could not load these check-ins."),
    );
  }, [active]);
  const selected = assignments.find((r) => r.id === active);
  async function assign() {
    if (!canManageSystem || !online || !memberId || !coachId) return;
    setSaving(true);
    try {
      const member = members.find((m) => m.id === memberId);
      const id = `${coachId}_${memberId}`;
      await setDoc(doc(db, "coachAssignments", id), {
        coachId,
        memberId,
        memberName: member?.name || member?.email || "Member",
        goal: goal.trim(),
        status: "active",
        createdAt: serverTimestamp(),
        assignedBy: user?.uid,
      });
      setActive(id);
      setGoal("");
      toast.success("Member assigned to coach");
    } catch {
      toast.error("Assignment failed. Check your permissions and connection.");
    } finally {
      setSaving(false);
    }
  }
  async function saveNote() {
    if (
      !selected ||
      !user ||
      !note.trim() ||
      !online ||
      (selected.coachId !== user.uid && !canManageSystem)
    )
      return;
    setSaving(true);
    try {
      await setDoc(
        doc(collection(db, "coachAssignments", selected.id, "checkIns")),
        {
          coachId: user.uid,
          body: note.trim(),
          nextDate: nextDate || null,
          createdAt: serverTimestamp(),
        },
      );
      setNote("");
      setNextDate("");
      toast.success("Check-in recorded");
    } catch {
      toast.error("Could not save this check-in.");
    } finally {
      setSaving(false);
    }
  }
  async function archive() {
    if (!selected || !canManageSystem || !online) return;
    try {
      await updateDoc(doc(db, "coachAssignments", selected.id), {
        status: selected.status === "active" ? "archived" : "active",
      });
    } catch {
      toast.error("Could not change this assignment.");
    }
  }
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap justify-between items-end gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-widest workspace-accent mb-2 font-bold">
            Coaching studio
          </p>
          <h1 className="text-3xl md:text-4xl">
            {canManageSystem
              ? "Connect members with coaches."
              : "Your members. Their next milestone."}
          </h1>
          <p className="text-sm text-muted-foreground mt-3">
            {canManageSystem
              ? "Assign a member to a coach and review their check-ins."
              : "Only members assigned to you appear here. Notes stay within the coaching team."}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/admin/content">
            Open plan studio <ArrowUpRight size={15} className="ml-2" />
          </Link>
        </Button>
      </header>
      {!online && (
        <p className="text-sm p-4 rounded-xl bg-secondary">
          You can read previously loaded assignments offline. Reconnect to
          assign members or save check-ins.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {canManageSystem && (
        <section className="workspace-card p-5">
          <h2 className="text-sm mb-4 flex items-center gap-2">
            <Plus size={16} /> Assign a member
          </h2>
          <div className="grid md:grid-cols-4 gap-3">
            <label className="text-xs">
              Member
              <select
                aria-label="Member to assign"
                className="mt-1.5 w-full bg-background border border-border rounded-xl p-2.5 text-sm"
                value={memberId}
                onChange={(e) => setMemberId(e.target.value)}
              >
                <option value="">Select member</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name || m.email || m.id}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs">
              Coach
              <select
                aria-label="Assigned coach"
                className="mt-1.5 w-full bg-background border border-border rounded-xl p-2.5 text-sm"
                value={coachId}
                onChange={(e) => setCoachId(e.target.value)}
              >
                <option value="">Select coach</option>
                {coaches.map((c) => (
                  <option key={c.id} value={c.id}>
                    {members.find((m) => m.id === c.id)?.name ||
                      members.find((m) => m.id === c.id)?.email ||
                      c.id}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs">
              Shared goal
              <Input
                className="mt-1.5"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="e.g. Build a consistent routine"
                maxLength={300}
              />
            </label>
            <Button
              className="md:mt-5 workspace-button"
              onClick={assign}
              disabled={!online || !memberId || !coachId || saving}
            >
              Assign member
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-3">
            Grant a team member the Coach role in Members & team before
            assigning clients.
          </p>
        </section>
      )}
      <div className="grid lg:grid-cols-[320px_1fr] gap-5">
        <section className="workspace-card p-5">
          <div className="flex items-center gap-2 mb-5">
            <Users size={16} className="workspace-accent" />
            <h2 className="text-sm">
              Assignments{" "}
              <span className="text-muted-foreground ml-1">
                {assignments.length}
              </span>
            </h2>
          </div>
          {assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6">
              No members assigned yet.
            </p>
          ) : (
            assignments.map((a) => (
              <button
                key={a.id}
                onClick={() => setActive(a.id)}
                className={`w-full text-left rounded-xl p-3 mb-2 border ${active === a.id ? "border-primary bg-primary/5" : "border-transparent hover:bg-secondary"}`}
              >
                <p className="text-sm font-semibold">{a.memberName}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {a.goal || "No goal added"}
                </p>
                <span className="text-[10px] uppercase tracking-wide workspace-accent mt-2 block">
                  {a.status}
                </span>
              </button>
            ))
          )}
        </section>
        <section className="workspace-card p-5 md:p-6">
          {!selected ? (
            <div className="py-16 text-center text-muted-foreground">
              <CheckCircle2 className="mx-auto mb-3" size={30} />
              <p className="text-sm">
                Choose a member to open their check-ins.
              </p>
            </div>
          ) : (
            <>
              <div className="flex justify-between gap-3 mb-6">
                <div>
                  <h2 className="text-xl">{selected.memberName}</h2>
                  <p className="text-xs text-muted-foreground mt-2">
                    {selected.goal ||
                      "Add a shared goal when assigning this member."}
                  </p>
                </div>
                {canManageSystem && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!online}
                    onClick={archive}
                  >
                    {selected.status === "active" ? "Archive" : "Restore"}
                  </Button>
                )}
              </div>
              {selected.status === "active" && (
                <div className="space-y-3 pb-6 border-b border-border">
                  <label htmlFor="check-in" className="text-xs font-semibold">
                    New check-in
                  </label>
                  <Textarea
                    id="check-in"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Session feedback, next steps and agreed goals…"
                    maxLength={4000}
                  />
                  <div className="flex flex-wrap justify-between gap-3">
                    <label className="text-xs">
                      Next check-in
                      <Input
                        aria-label="Next check-in date"
                        className="mt-1"
                        type="date"
                        value={nextDate}
                        onChange={(e) => setNextDate(e.target.value)}
                      />
                    </label>
                    <Button
                      className="self-end workspace-button"
                      disabled={!online || !note.trim() || saving}
                      onClick={saveNote}
                    >
                      Save check-in
                    </Button>
                  </div>
                </div>
              )}
              <div className="space-y-4 mt-6">
                {notes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No check-ins recorded.
                  </p>
                ) : (
                  notes.map((n) => (
                    <article
                      key={n.id}
                      className="rounded-xl bg-secondary/40 p-4"
                    >
                      <p className="text-sm whitespace-pre-wrap">{n.body}</p>
                      <p className="text-[11px] text-muted-foreground mt-3">
                        {n.createdAt?.toDate?.().toLocaleDateString() ||
                          "Saving…"}
                        {n.nextDate ? ` · Next check-in ${n.nextDate}` : ""}
                      </p>
                    </article>
                  ))
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
