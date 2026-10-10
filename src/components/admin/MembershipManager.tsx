import { useEffect, useRef, useState } from "react";
import { collection, doc, onSnapshot, setDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useAdmin } from "@/hooks/useAdmin";
import { useOnline } from "@/hooks/useOnline";
import { useFeatureAccess } from "@/contexts/FeatureAccessContext";
import { FEATURES, normalizeMemberAccess, expiryMillis, membershipInterestPlan, type PlanId, type FeatureId } from "@/lib/feature-access";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Save, UserRound, Crown } from "lucide-react";
import { logActivity } from "@/lib/activity";
import { toast } from "sonner";
interface Member { uid: string; name: string; email: string; interest: "plus" | "pro" | null }
export default function MembershipManager() {
  const { user } = useAuth();
  const { canManageSystem } = useAdmin();
  const { config } = useFeatureAccess();
  const online = useOnline();
  const [members, setMembers] = useState<Member[]>([]);
  const [search, setSearch] = useState("");
  const [interestFilter, setInterestFilter] = useState<"all" | "plus" | "pro">("all");
  const [selected, setSelected] = useState("");
  const [plan, setPlan] = useState<PlanId>("free");
  const [features, setFeatures] = useState<FeatureId[]>([]);
  const [expiry, setExpiry] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadedUid, setLoadedUid] = useState("");
  const dirty = useRef(false);
  useEffect(() => onSnapshot(collection(db, "users"), snapshot => {
    setMembers(snapshot.docs.map(item => ({ uid: item.id, name: String(item.data().name || "Member"), email: String(item.data().email || ""), interest: membershipInterestPlan(item.data().membershipInterest) })).sort((a, b) => a.name.localeCompare(b.name)));
  }, () => setError("Member list could not load.")), []);
  useEffect(() => {
    if (!selected) return;
    dirty.current = false; setPlan("free"); setFeatures([]); setExpiry(""); setLoading(true); setError(""); setLoadedUid("");
    return onSnapshot(doc(db, "memberAccess", selected), snapshot => {
      if (snapshot.metadata.fromCache && !snapshot.exists() && navigator.onLine) return;
      if (!dirty.current) {
        const access = normalizeMemberAccess(snapshot.data()); setPlan(access.plan); setFeatures(access.features);
        const millis = expiryMillis(access.expiresAt);
        setExpiry(millis ? new Date(millis).toLocaleDateString("en-CA") : "");
      }
      setLoading(false); setLoadedUid(selected);
    }, () => { setLoading(false); setError("Membership could not load. Retry before editing."); });
  }, [selected]);
  const readOnly = !canManageSystem || !online || loading || saving || loadedUid !== selected || !!error;
  async function save(revoke = false) {
    if (readOnly || !selected || !user) return;
    const expiryDate = expiry ? new Date(`${expiry}T23:59:59`) : null;
    if (!revoke && expiryDate && (!Number.isFinite(expiryDate.getTime()) || expiryDate.getTime() <= Date.now())) { toast.error("Choose a future expiry date."); return; }
    setSaving(true);
    try {
      await setDoc(doc(db, "memberAccess", selected), { plan: revoke ? "free" : plan, features: revoke ? [] : features, expiresAt: revoke || !expiryDate ? null : Timestamp.fromDate(expiryDate), updatedAt: serverTimestamp(), updatedBy: user.uid });
      dirty.current = false;
      if (revoke) { setPlan("free"); setFeatures([]); setExpiry(""); }
      void logActivity(revoke ? "admin.membership.revoke" : "admin.membership.update", { memberId: selected, plan: revoke ? "free" : plan });
      toast.success(revoke ? "Premium access revoked" : "Membership updated for this member");
    } catch { toast.error("Membership could not save. Existing access is unchanged."); }
    finally { setSaving(false); }
  }
  const filtered = members.filter(member => (interestFilter === "all" || member.interest === interestFilter) && `${member.name} ${member.email} ${member.uid}`.toLowerCase().includes(search.toLowerCase()));
  const member = members.find(item => item.uid === selected);
  return <div className="space-y-5">
    <div className="workspace-card p-5 md:p-6"><h2 className="text-xl flex items-center gap-2"><Crown size={22} />Manage member access</h2><p className="text-sm text-muted-foreground mt-2 max-w-2xl">Assign a plan, give access to individual features, or set an expiry date. A disabled feature stays unavailable regardless of membership.</p></div>
    <div className="grid sm:grid-cols-3 gap-3" aria-label="Membership interest"><button onClick={() => setInterestFilter("all")} aria-pressed={interestFilter === "all"} className="workspace-card p-4 text-left"><p className="text-xs text-muted-foreground">All members</p><p className="text-2xl font-semibold mt-2">{members.length}</p></button>{(["plus", "pro"] as const).map(interestPlan => <button key={interestPlan} aria-pressed={interestFilter === interestPlan} onClick={() => setInterestFilter(interestPlan)} data-tone={interestPlan === "plus" ? "violet" : "amber"} className="workspace-card member-tone-card p-4 text-left"><p className="text-xs text-muted-foreground">Interested in {interestPlan === "plus" ? config.membership.plusName : config.membership.proName}</p><p className="text-2xl font-semibold mt-2">{members.filter(item => item.interest === interestPlan).length}</p></button>)}</div>
    {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
    <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] gap-5">
      <section className="workspace-card p-5 space-y-4"><Label htmlFor="member-search">Find a member</Label><Input id="member-search" placeholder="Search name or email" value={search} onChange={event => setSearch(event.target.value)} /><div className="max-h-[450px] overflow-y-auto space-y-1">{filtered.slice(0, 100).map(item => <button key={item.uid} disabled={saving} className={`w-full flex items-center gap-3 text-left p-3 rounded-xl hover:bg-secondary ${selected === item.uid ? "bg-primary/10" : ""}`} onClick={() => setSelected(item.uid)}><UserRound size={17} className="text-primary shrink-0" /><span className="min-w-0"><span className="block text-sm font-semibold truncate">{item.name}</span><span className="text-xs text-muted-foreground block truncate">{item.email}</span>{item.interest && <span className="text-[10px] text-primary block mt-1">Interested in {item.interest === "plus" ? config.membership.plusName : config.membership.proName}</span>}</span></button>)}{filtered.length === 0 && <p className="text-xs text-muted-foreground">No members match your search.</p>}</div></section>
      <section className="workspace-card p-5 md:p-6 space-y-5">
        {!selected ? <p className="text-sm text-muted-foreground">Select a member to view or change access.</p> : <><div><h3 className="text-lg">{member?.name || "Member"}</h3><p className="text-xs text-muted-foreground mt-1">{member?.email}</p></div>{loading && <p role="status">Loading membership…</p>}
          {member?.interest && <div className="rounded-xl bg-primary/10 border border-primary/20 p-4 text-xs"><strong>Registered interest: {member.interest === "plus" ? config.membership.plusName : config.membership.proName}</strong><p className="text-muted-foreground mt-1">An interest request does not grant access or start a subscription.</p></div>}
          <div className="grid sm:grid-cols-2 gap-4"><div className="space-y-2"><Label htmlFor="member-plan">Membership plan</Label><select id="member-plan" className="admin-select" disabled={readOnly} value={plan} onChange={event => { dirty.current = true; setPlan(event.target.value as PlanId); }}><option value="free">Free</option><option value="plus">{config.membership.plusName}</option><option value="pro">{config.membership.proName}</option></select></div><div className="space-y-2"><Label htmlFor="member-expiry">Access expiry (optional)</Label><Input id="member-expiry" type="date" value={expiry} disabled={readOnly} onChange={event => { dirty.current = true; setExpiry(event.target.value); }} /></div></div>
          <fieldset className="space-y-3"><legend className="text-sm font-medium mb-3">Extra feature grants</legend>{FEATURES.map(feature => <label key={feature.id} className="flex items-center gap-3 text-sm"><input type="checkbox" disabled={readOnly} checked={features.includes(feature.id)} onChange={event => { dirty.current = true; setFeatures(previous => event.target.checked ? [...previous, feature.id] : previous.filter(id => id !== feature.id)); }} className="accent-[hsl(var(--primary))] w-4 h-4" />{feature.label}</label>)}</fieldset>
          <p className="text-xs text-muted-foreground">Expiry applies to the plan and extra grants. For a Nutrition child, also grant Nutrition or the required parent membership.</p>
          <div className="flex flex-wrap gap-2"><Button disabled={readOnly} onClick={() => save()}><Save size={15} className="mr-2" />{saving ? "Saving…" : "Save membership"}</Button><Button disabled={readOnly} variant="outline" onClick={() => save(true)}>Revoke premium access</Button></div>
        </>}
      </section>
    </div>
  </div>;
}
