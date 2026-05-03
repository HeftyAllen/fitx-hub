import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, serverTimestamp, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { logActivity } from "@/lib/activity";
import { toast } from "sonner";
import { getDailyUsage } from "@/lib/spoonacular";

interface Branding {
  logoUrl?: string;
  primaryHsl?: string;
  businessName?: string;
  supportEmail?: string;
}

interface Flag { id: string; enabled: boolean; rollout?: number; description?: string; }

export default function AdminSettings() {
  const [branding, setBranding] = useState<Branding>({});
  const [flags, setFlags] = useState<Flag[]>([]);
  const [newFlag, setNewFlag] = useState("");
  const usage = getDailyUsage();

  useEffect(() => {
    const u1 = onSnapshot(doc(db, "siteSettings", "branding"), (s) => setBranding(s.exists() ? (s.data() as Branding) : {}));
    const u2 = onSnapshot(collection(db, "featureFlags"), (s) => setFlags(s.docs.map(d => ({ id: d.id, ...(d.data() as any) }))));
    return () => { u1(); u2(); };
  }, []);

  async function saveBranding() {
    try {
      await setDoc(doc(db, "siteSettings", "branding"), { ...branding, updatedAt: serverTimestamp() }, { merge: true });
      logActivity("admin.settings.update", { area: "branding" });
      toast.success("Saved");
    } catch (e: any) { toast.error(e.message); }
  }

  async function addFlag() {
    if (!newFlag.trim()) return;
    await setDoc(doc(db, "featureFlags", newFlag.trim()), { enabled: false, rollout: 0, createdAt: serverTimestamp() });
    setNewFlag("");
  }

  async function updateFlag(id: string, patch: Partial<Flag>) {
    await setDoc(doc(db, "featureFlags", id), patch, { merge: true });
    logActivity("admin.flag.toggle", { id, ...patch });
  }

  async function delFlag(id: string) {
    if (!confirm(`Delete flag "${id}"?`)) return;
    await deleteDoc(doc(db, "featureFlags", id));
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold">System Settings</h1>
        <p className="text-sm text-muted-foreground">Branding, feature flags, and API quotas.</p>
      </header>

      <Card className="p-6 space-y-3">
        <h2 className="font-semibold">Branding</h2>
        <div className="grid sm:grid-cols-2 gap-2">
          <Input placeholder="Business name" value={branding.businessName ?? ""} onChange={e => setBranding(b => ({ ...b, businessName: e.target.value }))} />
          <Input placeholder="Support email" value={branding.supportEmail ?? ""} onChange={e => setBranding(b => ({ ...b, supportEmail: e.target.value }))} />
          <Input placeholder="Logo URL" value={branding.logoUrl ?? ""} onChange={e => setBranding(b => ({ ...b, logoUrl: e.target.value }))} />
          <Input placeholder="Primary color (HSL e.g. 210 90% 55%)" value={branding.primaryHsl ?? ""} onChange={e => setBranding(b => ({ ...b, primaryHsl: e.target.value }))} />
        </div>
        <Button onClick={saveBranding}>Save branding</Button>
      </Card>

      <Card className="p-6 space-y-3">
        <h2 className="font-semibold">Feature flags</h2>
        <div className="flex gap-2">
          <Input placeholder="new-flag-name" value={newFlag} onChange={e => setNewFlag(e.target.value)} />
          <Button onClick={addFlag}>Add</Button>
        </div>
        <ul className="divide-y divide-border">
          {flags.map(f => (
            <li key={f.id} className="py-3 flex items-center gap-4">
              <div className="flex-1">
                <div className="font-medium font-mono text-sm">{f.id}</div>
                <div className="text-xs text-muted-foreground">Rollout: {f.rollout ?? 0}%</div>
                <Slider
                  value={[f.rollout ?? 0]} min={0} max={100} step={5}
                  onValueChange={([v]) => updateFlag(f.id, { rollout: v })}
                  className="mt-2 max-w-md"
                />
              </div>
              <Switch checked={!!f.enabled} onCheckedChange={(v) => updateFlag(f.id, { enabled: v })} />
              <Button size="sm" variant="ghost" onClick={() => delFlag(f.id)}>Remove</Button>
            </li>
          ))}
          {flags.length === 0 && <li className="py-4 text-sm text-muted-foreground">No flags yet.</li>}
        </ul>
      </Card>

      <Card className="p-6 space-y-2">
        <h2 className="font-semibold">API quotas</h2>
        <div className="text-sm">Spoonacular today: <strong>{usage.used}/{usage.limit}</strong> · resets in {usage.resetIn}</div>
        <p className="text-xs text-muted-foreground">RapidAPI ExerciseDB: free tier — usage tracked by RapidAPI dashboard.</p>
      </Card>
    </div>
  );
}
