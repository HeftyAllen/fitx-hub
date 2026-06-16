import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, serverTimestamp, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { logActivity } from "@/lib/activity";
import { toast } from "sonner";
import { getDailyUsage } from "@/lib/spoonacular";
import {
  Palette, Flag, Activity, Wrench, ShieldAlert, Save, Plus, Trash2, BarChart3, Image as ImageIcon,
} from "lucide-react";

interface Branding {
  logoUrl?: string;
  primaryHsl?: string;
  businessName?: string;
  supportEmail?: string;
  maintenanceMode?: boolean;
  maintenanceMessage?: string;
  signupEnabled?: boolean;
}

interface Flag { id: string; enabled: boolean; rollout?: number; description?: string; }

const COLOR_PRESETS = [
  { name: "Ocean Blue", hsl: "210 90% 55%" },
  { name: "Royal Purple", hsl: "262 83% 58%" },
  { name: "Forest Green", hsl: "142 71% 45%" },
  { name: "Sunset Orange", hsl: "24 95% 53%" },
  { name: "Crimson", hsl: "346 87% 50%" },
  { name: "Cyan", hsl: "189 94% 43%" },
];

export default function AdminSettings() {
  const [branding, setBranding] = useState<Branding>({});
  const [flags, setFlags] = useState<Flag[]>([]);
  const [newFlag, setNewFlag] = useState("");
  const [savingBrand, setSavingBrand] = useState(false);
  const usage = getDailyUsage();

  useEffect(() => {
    const u1 = onSnapshot(doc(db, "siteSettings", "branding"), (s) => setBranding(s.exists() ? (s.data() as Branding) : {}));
    const u2 = onSnapshot(collection(db, "featureFlags"), (s) => setFlags(s.docs.map(d => ({ id: d.id, ...(d.data() as any) }))));
    return () => { u1(); u2(); };
  }, []);

  async function saveBranding() {
    setSavingBrand(true);
    try {
      await setDoc(doc(db, "siteSettings", "branding"), { ...branding, updatedAt: serverTimestamp() }, { merge: true });
      logActivity("admin.settings.update", { area: "branding" });
      toast.success("Saved — changes are live for all users");
    } catch (e: any) { toast.error(e.message); }
    finally { setSavingBrand(false); }
  }

  async function patchBrand(patch: Partial<Branding>) {
    const next = { ...branding, ...patch };
    setBranding(next);
    await setDoc(doc(db, "siteSettings", "branding"), { ...patch, updatedAt: serverTimestamp() }, { merge: true });
    logActivity("admin.settings.update", { area: "branding", patch: Object.keys(patch).join(",") });
  }

  async function addFlag() {
    if (!newFlag.trim()) return;
    await setDoc(doc(db, "featureFlags", newFlag.trim()), { enabled: false, rollout: 0, createdAt: serverTimestamp() });
    setNewFlag("");
    toast.success("Flag added");
  }

  async function updateFlag(id: string, patch: Partial<Flag>) {
    await setDoc(doc(db, "featureFlags", id), patch, { merge: true });
    logActivity("admin.flag.toggle", { id, ...patch });
  }

  async function delFlag(id: string) {
    if (!confirm(`Delete flag "${id}"?`)) return;
    await deleteDoc(doc(db, "featureFlags", id));
  }

  const usagePct = (usage.used / usage.limit) * 100;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold">System Settings</h1>
        <p className="text-sm text-muted-foreground">Branding, feature flags, maintenance mode & API quotas. Changes apply instantly.</p>
      </header>

      {/* MAINTENANCE / GLOBAL TOGGLES */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-2 text-sm font-bold">
          <ShieldAlert size={16} className="text-destructive" /> Operational controls
        </div>

        <div className="flex items-start justify-between gap-4 p-3 rounded-lg border border-border bg-secondary/30">
          <div className="flex-1">
            <p className="text-sm font-semibold flex items-center gap-2">
              <Wrench size={14} /> Maintenance mode
              {branding.maintenanceMode && <Badge variant="destructive" className="text-[10px]">LIVE</Badge>}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Shows a banner at the top of every page.</p>
            <Input className="mt-2" placeholder="Maintenance message"
              value={branding.maintenanceMessage ?? ""}
              onChange={e => setBranding(b => ({ ...b, maintenanceMessage: e.target.value }))}
              onBlur={() => patchBrand({ maintenanceMessage: branding.maintenanceMessage })}
            />
          </div>
          <Switch checked={!!branding.maintenanceMode}
            onCheckedChange={(v) => patchBrand({ maintenanceMode: v })} />
        </div>

        <div className="flex items-center justify-between gap-4 p-3 rounded-lg border border-border bg-secondary/30">
          <div>
            <p className="text-sm font-semibold">Allow new sign-ups</p>
            <p className="text-xs text-muted-foreground">Turn off to disable account creation.</p>
          </div>
          <Switch checked={branding.signupEnabled !== false}
            onCheckedChange={(v) => patchBrand({ signupEnabled: v })} />
        </div>
      </Card>

      {/* BRANDING */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-2 text-sm font-bold"><Palette size={16} className="text-primary" /> Branding</div>
        <div className="grid sm:grid-cols-2 gap-2">
          <Input placeholder="Business name" value={branding.businessName ?? ""} onChange={e => setBranding(b => ({ ...b, businessName: e.target.value }))} />
          <Input placeholder="Support email" value={branding.supportEmail ?? ""} onChange={e => setBranding(b => ({ ...b, supportEmail: e.target.value }))} />
          <Input placeholder="Logo URL" value={branding.logoUrl ?? ""} onChange={e => setBranding(b => ({ ...b, logoUrl: e.target.value }))} />
          <Input placeholder="Primary color (HSL e.g. 210 90% 55%)" value={branding.primaryHsl ?? ""} onChange={e => setBranding(b => ({ ...b, primaryHsl: e.target.value }))} />
        </div>

        <div>
          <p className="text-xs text-muted-foreground mb-2">Quick color presets</p>
          <div className="flex flex-wrap gap-2">
            {COLOR_PRESETS.map(p => (
              <button key={p.name} onClick={() => setBranding(b => ({ ...b, primaryHsl: p.hsl }))}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  branding.primaryHsl === p.hsl ? "border-primary ring-1 ring-primary" : "border-border hover:border-primary/50"
                }`}>
                <span className="w-3 h-3 rounded-full" style={{ background: `hsl(${p.hsl})` }} />
                {p.name}
              </button>
            ))}
          </div>
        </div>

        {branding.logoUrl && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
            <ImageIcon size={14} className="text-muted-foreground" />
            <img src={branding.logoUrl} alt="" className="h-10 w-auto" />
            <span className="text-xs text-muted-foreground">Logo preview</span>
          </div>
        )}

        <Button onClick={saveBranding} disabled={savingBrand}>
          <Save size={14} className="mr-1" /> {savingBrand ? "Saving…" : "Save branding"}
        </Button>
      </Card>

      {/* FEATURE FLAGS */}
      <Card className="p-6 space-y-3">
        <div className="flex items-center gap-2 text-sm font-bold"><Flag size={16} className="text-amber-400" /> Feature flags</div>
        <div className="flex gap-2">
          <Input placeholder="new-flag-name" value={newFlag} onChange={e => setNewFlag(e.target.value)} />
          <Button onClick={addFlag}><Plus size={14} /></Button>
        </div>
        <ul className="divide-y divide-border">
          {flags.map(f => (
            <li key={f.id} className="py-3 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="font-medium font-mono text-sm flex items-center gap-2">
                  {f.id}
                  <Badge variant={f.enabled ? "default" : "outline"} className="text-[10px]">
                    {f.enabled ? "ON" : "OFF"}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-1">Rollout: {f.rollout ?? 0}%</div>
                <Slider value={[f.rollout ?? 0]} min={0} max={100} step={5}
                  onValueChange={([v]) => updateFlag(f.id, { rollout: v })}
                  className="mt-2 max-w-md" />
              </div>
              <Switch checked={!!f.enabled} onCheckedChange={(v) => updateFlag(f.id, { enabled: v })} />
              <Button size="sm" variant="ghost" onClick={() => delFlag(f.id)}><Trash2 size={14} /></Button>
            </li>
          ))}
          {flags.length === 0 && <li className="py-4 text-sm text-muted-foreground">No flags yet — add one to gate new features.</li>}
        </ul>
      </Card>

      {/* API QUOTAS */}
      <Card className="p-6 space-y-3">
        <div className="flex items-center gap-2 text-sm font-bold"><BarChart3 size={16} /> API quotas</div>
        <div>
          <div className="flex items-center justify-between text-sm mb-1">
            <span>Spoonacular</span>
            <span className="font-mono">{usage.used}/{usage.limit} · resets in {usage.resetIn}</span>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div className={`h-full transition-all ${usagePct > 85 ? "bg-destructive" : usagePct > 60 ? "bg-amber-500" : "bg-primary"}`}
              style={{ width: `${Math.min(usagePct, 100)}%` }} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">RapidAPI ExerciseDB: usage tracked by RapidAPI dashboard.</p>
      </Card>
    </div>
  );
}
