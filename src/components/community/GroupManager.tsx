import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { Plus, Users, UserMinus, Archive, RotateCcw, Check } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useAdmin } from "@/hooks/useAdmin";
import { useOnline } from "@/hooks/useOnline";
import type { CoachAssignment } from "@/lib/coaching";
import { groupSchema, type CommunityGroup, type CommunityMember } from "@/lib/community";
import { createCommunityGroup, setCommunityMembership } from "@/lib/community-actions";
import { memberGreetingName } from "@/lib/member-identity";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";

function useCommunityClients(enabled: boolean) {
  const { user } = useAuth();
  const { role } = useAdmin();
  const [clients, setClients] = useState<CoachAssignment[]>([]);
  const [coaches, setCoaches] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    setClients([]); setCoaches([]);
    if (!enabled || !user) return;
    const stops = [onSnapshot(query(collection(db, "coachAssignments"), ...(role === "coach" ? [where("coachId", "==", user.uid)] : [])), snap => setClients(snap.docs.map(item => ({ ...item.data(), id: item.id } as CoachAssignment))), () => toast.error("Assigned clients could not load."))];
    if (role === "admin") stops.push(onSnapshot(query(collection(db, "admins"), where("role", "==", "coach")), snap => setCoaches(snap.docs.map(item => ({ id: item.id, name: `Coach ${item.id.slice(0, 8)}` }))), () => toast.error("Coaches could not load.")));
    return () => stops.forEach(stop => stop());
  }, [enabled, user, role]);
  return { clients: clients.filter(client => client.status === "active"), coaches };
}

export function CreateGroupDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; onCreated: (id: string) => void }) {
  const { user, userProfile } = useAuth();
  const { role } = useAdmin();
  const online = useOnline();
  const { clients, coaches } = useCommunityClients(open);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tone, setTone] = useState("mint");
  const [coach, setCoach] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const coachId = role === "coach" ? user?.uid : coach;
  const eligible = clients.filter(client => client.coachId === coachId);
  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (!user || !online || saving || !coachId) return;
    const parsed = groupSchema.safeParse({ name, description, tone });
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    const recipients = eligible.filter(client => selected.includes(client.id));
    if (recipients.length > 40) { setError("Choose up to 40 clients per group."); return; }
    setSaving(true); setError("");
    try {
      const coachName = coachId === user.uid ? memberGreetingName(userProfile, user.displayName) || "Your coach" : eligible.find(client => client.coachName)?.coachName || "Your coach";
      const result = await createCommunityGroup(db, user.uid, coachName, { name: parsed.data.name, description: parsed.data.description, tone: parsed.data.tone, coachId }, recipients);
      if (result.warning) toast.error(result.warning); else toast.success("Group created. Invited members can find it in Community.");
      setName(""); setDescription(""); setSelected([]); onCreated(result.id); onOpenChange(false);
    } catch { setError("The group could not be created. Check your coaching role and Firebase rules."); }
    finally { setSaving(false); }
  }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="community-dialog max-h-[90dvh] overflow-y-auto">
    <DialogTitle>Create a coach group</DialogTitle><DialogDescription>Invite assigned clients into a shared space for conversations, classes and training.</DialogDescription>
    <form onSubmit={create} className="space-y-4">
      <label className="community-field">Group name<input maxLength={80} required value={name} onChange={event => setName(event.target.value)} placeholder="Saturday strength club" /></label>
      <label className="community-field">About this group<textarea aria-label="About this group" maxLength={500} value={description} onChange={event => setDescription(event.target.value)} placeholder="A little encouragement between sessions." rows={3} /></label>
      {role === "admin" && <label className="community-field">Group coach<select aria-label="Group coach" required value={coach} onChange={event => { setCoach(event.target.value); setSelected([]); }}><option value="">Choose a coach</option>{coaches.map(item => <option key={item.id} value={item.id}>{clients.find(client => client.coachId === item.id)?.coachName || item.name}</option>)}</select></label>}
      <label className="community-field">Group colour<select aria-label="Group colour" value={tone} onChange={event => setTone(event.target.value)}><option value="mint">Fresh mint</option><option value="blue">Electric blue</option><option value="violet">Soft violet</option><option value="amber">Warm amber</option></select></label>
      <fieldset className="community-client-list"><legend>Invite assigned clients · {selected.length} selected</legend>{eligible.length ? eligible.map(client => <label key={client.id}><input type="checkbox" checked={selected.includes(client.id)} onChange={event => setSelected(previous => event.target.checked ? [...previous, client.id] : previous.filter(id => id !== client.id))} /><span>{client.memberName}</span></label>) : <p className="text-xs text-muted-foreground">Assign clients to this coach first. You can also create the group now and add clients later.</p>}</fieldset>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      <Button type="submit" disabled={!online || saving || !coachId} className="w-full"><Plus size={15} />{saving ? "Creating…" : "Create group"}</Button>
    </form>
  </DialogContent></Dialog>;
}

export function GroupMembers({ group, members, host, moderator }: { group: CommunityGroup; members: CommunityMember[]; host: boolean; moderator: boolean }) {
  const { user } = useAuth();
  const online = useOnline();
  const { clients } = useCommunityClients(host);
  const [busy, setBusy] = useState("");
  const available = clients.filter(client => client.coachId === group.coachId && !members.some(member => member.id === client.memberId && member.status === "active"));
  async function membership(member: CommunityMember | CoachAssignment, active: boolean) {
    setBusy(member.id);
    try { await setCommunityMembership(db, group, member, active); toast.success(active ? "Member added" : "Member removed from the group"); }
    catch { toast.error("Membership could not sync. Check the active coaching assignment."); }
    finally { setBusy(""); }
  }
  async function archive() {
    setBusy(group.id);
    try { await updateDoc(doc(db, "communityGroups", group.id), { status: group.status === "active" ? "archived" : "active", updatedAt: serverTimestamp() }); }
    catch { toast.error("The group status could not change."); } finally { setBusy(""); }
  }
  return <div className="community-panel space-y-5"><div><p className="member-eyebrow">Train together</p><h3 className="text-lg font-semibold">Group members</h3><p className="text-xs text-muted-foreground mt-2">Conversations and shared activity responses are visible to this group. Private fitness records stay in each member’s account.</p></div>
    <div className="space-y-2">{members.filter(member => member.status === "active").map(member => <div key={member.id} className="community-member-row"><span className="community-person-avatar">{member.name?.[0] || "?"}</span><div className="min-w-0 flex-1"><p className="text-sm font-semibold truncate">{member.name}{member.id === user?.uid ? " · You" : ""}</p><p className="text-xs text-muted-foreground">{member.role === "coach" ? "Group coach" : "Member"}</p></div>{(host || moderator) && member.role !== "coach" && <button disabled={!online || !!busy} aria-label={`Remove ${member.name} from group`} className="community-icon-button" onClick={() => void membership(member, false)}><UserMinus size={17} /></button>}</div>)}</div>
    {host && group.status === "active" && <section className="border-t border-border pt-5"><h4 className="text-sm font-semibold flex gap-2 items-center"><Users size={16} />Add assigned clients</h4><div className="space-y-2 mt-3">{available.map(client => <div key={client.id} className="community-member-row"><span className="min-w-0 flex-1 text-sm truncate">{client.memberName}</span><Button size="sm" variant="outline" disabled={!online || !!busy} onClick={() => void membership(client, true)}><Plus size={14} />Add</Button></div>)}{!available.length && <p className="text-xs text-muted-foreground"><Check size={13} className="inline mr-1" />All active assigned clients are already in this group.</p>}</div></section>}
    {host && <Button variant="outline" disabled={!online || !!busy} onClick={() => void archive()}>{group.status === "active" ? <Archive size={15} /> : <RotateCcw size={15} />}{group.status === "active" ? "Archive group" : "Reopen group"}</Button>}
  </div>;
}
