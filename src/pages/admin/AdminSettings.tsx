import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, serverTimestamp, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import BrandEditor from "@/components/admin/BrandEditor";
import FeatureControls from "@/components/admin/FeatureControls";
import MembershipManager from "@/components/admin/MembershipManager";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { getDailyUsage } from "@/lib/spoonacular";
import { useOnline } from "@/hooks/useOnline";
import { useAdmin } from "@/hooks/useAdmin";
import { Palette, Flag, Plus, Trash2, BarChart3, Sparkles, Crown, SlidersHorizontal } from "lucide-react";
interface FlagRecord { id: string; enabled: boolean; rollout: number }
function LegacyFlags() {
  const [flags, setFlags] = useState<FlagRecord[]>([]);
  const [newFlag, setNewFlag] = useState("");
  const [busy, setBusy] = useState(false);
  const { canManageSystem } = useAdmin();
  const online = useOnline();
  const disabled = !canManageSystem || !online || busy;
  useEffect(() => onSnapshot(collection(db, "featureFlags"), snapshot => setFlags(snapshot.docs.map(item => ({ id: item.id, enabled: !!item.data().enabled, rollout: Number(item.data().rollout) || 0 }))), () => toast.error("Custom flags could not load.")), []);
  async function write(id: string, data: Record<string, unknown> | null) {
    if (disabled) return;
    setBusy(true);
    try {
      if (data) await setDoc(doc(db, "featureFlags", id), { ...data, updatedAt: serverTimestamp() }, { merge: true });
      else await deleteDoc(doc(db, "featureFlags", id));
      setNewFlag("");
    } catch { toast.error("Custom flag could not save."); }
    finally { setBusy(false); }
  }
  return <Card className="p-5 space-y-4"><h2 className="text-lg">Custom developer flags</h2><p className="text-xs text-muted-foreground">These existing flags are retained for code that reads them. Use Feature access to control the member app sections.</p><div className="flex gap-2"><Input aria-label="Custom flag name" placeholder="new-flag-name" value={newFlag} disabled={disabled} onChange={event => setNewFlag(event.target.value)} /><Button aria-label="Add custom flag" disabled={disabled || !/^[a-z0-9-]{1,60}$/.test(newFlag) || flags.some(flag => flag.id === newFlag)} onClick={() => write(newFlag, { enabled: false, rollout: 0, createdAt: serverTimestamp() })}><Plus size={16} /></Button></div>{flags.map(flag => <div key={flag.id} className="flex flex-wrap items-center gap-3 border-t border-border pt-4"><span className="font-mono text-sm flex-1">{flag.id}</span><Input type="number" aria-label={`${flag.id} rollout percentage`} className="w-20" min="0" max="100" defaultValue={flag.rollout} disabled={disabled} onBlur={event => { const value = Math.max(0, Math.min(100, Number(event.target.value) || 0)); if (value !== flag.rollout) void write(flag.id, { rollout: value }); }} /><Switch aria-label={`Enable ${flag.id}`} checked={flag.enabled} disabled={disabled} onCheckedChange={enabled => write(flag.id, { enabled })} /><Button size="icon" variant="ghost" aria-label={`Delete ${flag.id}`} disabled={disabled} onClick={() => write(flag.id, null)}><Trash2 size={15} /></Button></div>)}</Card>;
}
export default function AdminSettings() {
  const usage = getDailyUsage();
  return <div className="space-y-6">
    <div className="workspace-hero workspace-card p-6 md:p-8"><p className="text-[10px] uppercase tracking-[.2em] text-primary flex items-center gap-2"><Sparkles size={13} />White-label studio</p><h1 className="text-3xl md:text-4xl mt-3 tracking-tight">Make the experience yours.</h1><p className="text-sm text-muted-foreground mt-3 max-w-2xl">Shape your brand, rewrite the experience and choose which tools members can use. Review your draft, then publish it across the app.</p></div>
    <Tabs defaultValue="brand"><div className="overflow-x-auto scrollbar-hide"><TabsList className="justify-start h-auto min-w-max p-1 gap-1"><TabsTrigger value="brand" className="gap-2"><Palette size={14} />Brand studio</TabsTrigger><TabsTrigger value="access" className="gap-2"><SlidersHorizontal size={14} />Feature access</TabsTrigger><TabsTrigger value="memberships" className="gap-2"><Crown size={14} />Memberships</TabsTrigger><TabsTrigger value="quotas" className="gap-2"><BarChart3 size={14} />API usage</TabsTrigger><TabsTrigger value="flags" className="gap-2"><Flag size={14} />Advanced flags</TabsTrigger></TabsList></div>
      <TabsContent value="brand" forceMount className="mt-5 data-[state=inactive]:hidden"><BrandEditor /></TabsContent>
      <TabsContent value="access" forceMount className="mt-5 data-[state=inactive]:hidden"><FeatureControls /></TabsContent>
      <TabsContent value="memberships" className="mt-5"><MembershipManager /></TabsContent>
      <TabsContent value="quotas" className="mt-5"><Card className="p-6 space-y-4"><h2 className="text-lg">API usage on this device</h2><div className="flex justify-between text-sm"><span>Spoonacular</span><span>{usage.used}/{usage.limit} · resets in {usage.resetIn}</span></div><div className="h-2 bg-secondary rounded-full overflow-hidden"><div className="bg-primary h-full rounded-full" style={{ width: `${Math.min(100, usage.used / usage.limit * 100)}%` }} /></div><p className="text-xs text-muted-foreground">This counter tracks this browser's requests. Full FatSecret, Spoonacular and RapidAPI account usage is available in each provider's dashboard.</p></Card></TabsContent>
      <TabsContent value="flags" className="mt-5"><LegacyFlags /></TabsContent>
    </Tabs>
  </div>;
}
