import { useEffect, useRef, useState } from "react";
import { collection, doc, onSnapshot, serverTimestamp, setDoc, deleteDoc } from "firebase/firestore";
import { ref as sref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { logActivity } from "@/lib/activity";
import { toast } from "sonner";
import { getDailyUsage } from "@/lib/spoonacular";
import { useAdmin } from "@/hooks/useAdmin";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import {
  Palette, Flag, Wrench, ShieldAlert, Save, Plus, Trash2, BarChart3,
  UploadCloud, Sparkles, Lock, Dumbbell, Bell,
} from "lucide-react";

interface Branding {
  logoUrl?: string;
  faviconUrl?: string;
  primaryHsl?: string;
  accentHsl?: string;
  radius?: number;
  businessName?: string;
  tagline?: string;
  supportEmail?: string;
  maintenanceMode?: boolean;
  maintenanceMessage?: string;
  signupEnabled?: boolean;
}

interface FeatureFlag { id: string; enabled: boolean; rollout?: number; description?: string; }

const COLOR_PRESETS = [
  { name: "Ocean Blue", hsl: "210 90% 55%" },
  { name: "Royal Purple", hsl: "262 83% 58%" },
  { name: "Forest Green", hsl: "142 71% 45%" },
  { name: "Sunset Orange", hsl: "24 95% 53%" },
  { name: "Crimson", hsl: "346 87% 50%" },
  { name: "Cyan", hsl: "189 94% 43%" },
  { name: "Lime", hsl: "84 81% 44%" },
  { name: "Magenta", hsl: "316 80% 56%" },
];

/* ── hsl string <-> hex for the native colour picker ─────────────── */
function hslToHex(hsl?: string) {
  if (!hsl) return "#3b82f6";
  const m = hsl.match(/([\d.]+)\s+([\d.]+)%\s+([\d.]+)%/);
  if (!m) return "#3b82f6";
  const h = +m[1] / 360, s = +m[2] / 100, l = +m[3] / 100;
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    const v = l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    return Math.round(255 * v).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}
function hexToHsl(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export default function AdminSettings() {
  const { canManageSystem } = useAdmin();
  const live = useSiteSettings();
  const [branding, setBranding] = useState<Branding>({});
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [newFlag, setNewFlag] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const usage = getDailyUsage();

  useEffect(() => {
    const u1 = onSnapshot(doc(db, "siteSettings", "branding"), (s) => setBranding(s.exists() ? (s.data() as Branding) : {}));
    const u2 = onSnapshot(collection(db, "featureFlags"), (s) => setFlags(s.docs.map(d => ({ id: d.id, ...(d.data() as any) }))));
    return () => { u1(); u2(); };
  }, []);

  const readOnly = !canManageSystem;

  async function patch(p: Partial<Branding>, silent = false) {
    if (readOnly) { toast.error("Your role can't change system settings"); return; }
    setBranding(b => ({ ...b, ...p }));
    try {
      await setDoc(doc(db, "siteSettings", "branding"), { ...p, updatedAt: serverTimestamp() }, { merge: true });
      logActivity("admin.settings.update", { keys: Object.keys(p).join(",") });
      if (!silent) toast.success("Live for every user");
    } catch (e: any) { toast.error(e.message); }
  }

  async function saveAll() {
    setSaving(true);
    await patch({
      businessName: branding.businessName, tagline: branding.tagline,
      supportEmail: branding.supportEmail, logoUrl: branding.logoUrl,
      primaryHsl: branding.primaryHsl, accentHsl: branding.accentHsl,
      radius: branding.radius, maintenanceMessage: branding.maintenanceMessage,
    });
    setSaving(false);
  }

  async function uploadLogo(file: File) {
    if (readOnly) { toast.error("Your role can't change branding"); return; }
    if (!file.type.startsWith("image/")) { toast.error("Images only"); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error("Keep it under 2 MB"); return; }
    setUploading(true);
    try {
      const path = `public/branding/logo-${Date.now()}-${file.name.replace(/[^\w.]+/g, "_")}`;
      const r = sref(storage, path);
      await uploadBytes(r, file, { contentType: file.type, cacheControl: "public,max-age=3600" });
      const url = await getDownloadURL(r);
      await patch({ logoUrl: url, faviconUrl: url });
      toast.success("Logo updated everywhere");
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally { setUploading(false); }
  }

  async function addFlag() {
    if (!newFlag.trim() || readOnly) return;
    await setDoc(doc(db, "featureFlags", newFlag.trim()), { enabled: false, rollout: 0, createdAt: serverTimestamp() });
    setNewFlag("");
    toast.success("Flag added");
  }
  async function updateFlag(id: string, p: Partial<FeatureFlag>) {
    if (readOnly) return;
    await setDoc(doc(db, "featureFlags", id), p, { merge: true });
    logActivity("admin.flag.toggle", { id, ...p });
  }
  async function delFlag(id: string) {
    if (readOnly) return;
    if (!confirm(`Delete flag "${id}"?`)) return;
    await deleteDoc(doc(db, "featureFlags", id));
  }

  const usagePct = (usage.used / usage.limit) * 100;
  const primary = branding.primaryHsl ?? "";
  const accent = branding.accentHsl ?? "";

  return (
    <div className="space-y-6">
      {/* HERO */}
      <div className="relative overflow-hidden rounded-3xl border border-border p-6 md:p-8">
        <div className="absolute inset-0 -z-10 opacity-70"
          style={{ background: "radial-gradient(900px 300px at 10% -20%, hsl(var(--primary)/0.35), transparent 60%), radial-gradient(600px 260px at 90% 120%, hsl(var(--accent)/0.35), transparent 60%)" }} />
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Badge variant="outline" className="mb-2 gap-1 text-[10px]"><Sparkles size={10} /> White-label controls</Badge>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight">Brand & System</h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-xl">
              Everything here writes straight through to every screen — logo, colours, corners, sign-ups and feature gates.
            </p>
          </div>
          <Button onClick={saveAll} disabled={saving || readOnly}>
            <Save size={14} className="mr-1" /> {saving ? "Saving…" : "Save all"}
          </Button>
        </div>
        {readOnly && (
          <div className="mt-4 flex items-center gap-2 text-xs text-amber-400">
            <Lock size={12} /> Your role can view these settings but not change them.
          </div>
        )}
      </div>

      <Tabs defaultValue="brand">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="brand" className="gap-1"><Palette size={13} /> Brand</TabsTrigger>
          <TabsTrigger value="ops" className="gap-1"><ShieldAlert size={13} /> Operations</TabsTrigger>
          <TabsTrigger value="flags" className="gap-1"><Flag size={13} /> Feature flags</TabsTrigger>
          <TabsTrigger value="quotas" className="gap-1"><BarChart3 size={13} /> Quotas</TabsTrigger>
        </TabsList>

        {/* ── BRAND ── */}
        <TabsContent value="brand" className="mt-4 grid lg:grid-cols-[1fr_340px] gap-4">
          <div className="space-y-4">
            <Card className="p-6 space-y-4">
              <div className="text-sm font-bold flex items-center gap-2"><UploadCloud size={16} className="text-primary" /> Logo</div>
              <div className="flex flex-wrap items-center gap-4">
                <div className="h-20 w-20 rounded-2xl border border-border bg-secondary/40 flex items-center justify-center overflow-hidden">
                  {branding.logoUrl
                    ? <img src={branding.logoUrl} alt="logo" className="h-full w-full object-contain p-2" />
                    : <Dumbbell size={22} className="text-muted-foreground" />}
                </div>
                <div className="space-y-2">
                  <input ref={fileRef} type="file" accept="image/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadLogo(f); e.target.value = ""; }} />
                  <Button variant="outline" size="sm" disabled={uploading || readOnly} onClick={() => fileRef.current?.click()}>
                    <UploadCloud size={14} className="mr-1" /> {uploading ? "Uploading…" : "Upload logo"}
                  </Button>
                  {branding.logoUrl && !readOnly && (
                    <Button variant="ghost" size="sm" className="text-destructive"
                      onClick={() => patch({ logoUrl: "", faviconUrl: "" })}>
                      <Trash2 size={14} className="mr-1" /> Remove
                    </Button>
                  )}
                  <p className="text-[11px] text-muted-foreground">PNG/SVG, under 2 MB. Also used as favicon.</p>
                </div>
              </div>
              <Input placeholder="…or paste a logo URL" value={branding.logoUrl ?? ""} disabled={readOnly}
                onChange={e => setBranding(b => ({ ...b, logoUrl: e.target.value }))}
                onBlur={() => patch({ logoUrl: branding.logoUrl, faviconUrl: branding.logoUrl }, true)} />
            </Card>

            <Card className="p-6 space-y-4">
              <div className="text-sm font-bold flex items-center gap-2"><Sparkles size={16} className="text-primary" /> Identity</div>
              <div className="grid sm:grid-cols-2 gap-2">
                <Input placeholder="Business name" value={branding.businessName ?? ""} disabled={readOnly}
                  onChange={e => setBranding(b => ({ ...b, businessName: e.target.value }))}
                  onBlur={() => patch({ businessName: branding.businessName }, true)} />
                <Input placeholder="Support email" value={branding.supportEmail ?? ""} disabled={readOnly}
                  onChange={e => setBranding(b => ({ ...b, supportEmail: e.target.value }))}
                  onBlur={() => patch({ supportEmail: branding.supportEmail }, true)} />
                <Input className="sm:col-span-2" placeholder="Tagline (shown on landing & auth)" value={branding.tagline ?? ""} disabled={readOnly}
                  onChange={e => setBranding(b => ({ ...b, tagline: e.target.value }))}
                  onBlur={() => patch({ tagline: branding.tagline }, true)} />
              </div>
            </Card>

            <Card className="p-6 space-y-5">
              <div className="text-sm font-bold flex items-center gap-2"><Palette size={16} className="text-primary" /> Theme</div>

              <div className="grid sm:grid-cols-2 gap-4">
                {[
                  { label: "Primary", value: primary, key: "primaryHsl" as const },
                  { label: "Accent", value: accent, key: "accentHsl" as const },
                ].map(({ label, value, key }) => (
                  <div key={key} className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground">{label}</p>
                    <div className="flex items-center gap-2">
                      <input type="color" value={hslToHex(value)} disabled={readOnly}
                        onChange={e => setBranding(b => ({ ...b, [key]: hexToHsl(e.target.value) }))}
                        onBlur={e => patch({ [key]: hexToHsl(e.target.value) } as any, true)}
                        className="h-10 w-14 rounded-lg bg-transparent border border-border cursor-pointer" />
                      <Input placeholder="210 90% 55%" value={value} disabled={readOnly}
                        onChange={e => setBranding(b => ({ ...b, [key]: e.target.value }))}
                        onBlur={() => patch({ [key]: (branding as any)[key] } as any, true)} />
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">Primary presets</p>
                <div className="flex flex-wrap gap-2">
                  {COLOR_PRESETS.map(p => (
                    <button key={p.name} disabled={readOnly} onClick={() => patch({ primaryHsl: p.hsl }, true)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                        primary === p.hsl ? "border-primary ring-1 ring-primary" : "border-border hover:border-primary/50"
                      }`}>
                      <span className="w-3 h-3 rounded-full" style={{ background: `hsl(${p.hsl})` }} />
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground mb-2">
                  <span>Corner radius</span>
                  <span className="font-mono">{(branding.radius ?? 0.75).toFixed(2)}rem</span>
                </div>
                <Slider value={[branding.radius ?? 0.75]} min={0} max={2} step={0.05} disabled={readOnly}
                  onValueChange={([v]) => setBranding(b => ({ ...b, radius: v }))}
                  onValueCommit={([v]) => patch({ radius: v }, true)} />
              </div>
            </Card>
          </div>

          {/* LIVE PREVIEW */}
          <Card className="p-4 space-y-3 lg:sticky lg:top-6 h-fit">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Live preview</p>
            <div className="rounded-2xl border border-border overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-card">
                {branding.logoUrl
                  ? <img src={branding.logoUrl} alt="" className="h-6 w-auto object-contain" />
                  : <span className="text-sm font-black">{branding.businessName || "FitX Journey"}</span>}
              </div>
              <div className="p-4 space-y-3" style={{ background: "hsl(var(--background))" }}>
                <div className="text-sm font-bold">{branding.businessName || "FitX Journey"}</div>
                <p className="text-xs text-muted-foreground">{branding.tagline || "Your tagline appears here."}</p>
                <div className="flex gap-2">
                  <button className="px-3 py-1.5 text-xs font-bold text-primary-foreground"
                    style={{ background: `hsl(${primary || "var(--primary)"})`, borderRadius: `${branding.radius ?? 0.75}rem` }}>
                    Start workout
                  </button>
                  <button className="px-3 py-1.5 text-xs font-bold border border-border"
                    style={{ background: `hsl(${accent || "var(--accent)"} / 0.4)`, borderRadius: `${branding.radius ?? 0.75}rem` }}>
                    Log meal
                  </button>
                </div>
                <div className="p-3 border border-border" style={{ borderRadius: `${branding.radius ?? 0.75}rem` }}>
                  <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full w-2/3" style={{ background: `hsl(${primary || "var(--primary)"})` }} />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2">Daily calories · 2 040 / 3 060</p>
                </div>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Saved values are already applied app-wide{live.businessName ? ` for “${live.businessName}”` : ""}.
            </p>
          </Card>
        </TabsContent>

        {/* ── OPS ── */}
        <TabsContent value="ops" className="mt-4 space-y-4">
          <Card className="p-6 space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold">
              <ShieldAlert size={16} className="text-destructive" /> Operational controls
            </div>

            <div className="flex items-start justify-between gap-4 p-4 rounded-2xl border border-border bg-secondary/30">
              <div className="flex-1">
                <p className="text-sm font-semibold flex items-center gap-2">
                  <Wrench size={14} /> Maintenance mode
                  {branding.maintenanceMode && <Badge variant="destructive" className="text-[10px]">LIVE</Badge>}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Shows a banner at the top of every page for all users.</p>
                <Input className="mt-2" placeholder="Maintenance message" disabled={readOnly}
                  value={branding.maintenanceMessage ?? ""}
                  onChange={e => setBranding(b => ({ ...b, maintenanceMessage: e.target.value }))}
                  onBlur={() => patch({ maintenanceMessage: branding.maintenanceMessage }, true)} />
              </div>
              <Switch checked={!!branding.maintenanceMode} disabled={readOnly}
                onCheckedChange={(v) => patch({ maintenanceMode: v })} />
            </div>

            <div className="flex items-center justify-between gap-4 p-4 rounded-2xl border border-border bg-secondary/30">
              <div>
                <p className="text-sm font-semibold flex items-center gap-2"><Bell size={14} /> Allow new sign-ups</p>
                <p className="text-xs text-muted-foreground">Turn off to freeze account creation.</p>
              </div>
              <Switch checked={branding.signupEnabled !== false} disabled={readOnly}
                onCheckedChange={(v) => patch({ signupEnabled: v })} />
            </div>
          </Card>
        </TabsContent>

        {/* ── FLAGS ── */}
        <TabsContent value="flags" className="mt-4">
          <Card className="p-6 space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold"><Flag size={16} className="text-amber-400" /> Feature flags</div>
            <div className="flex gap-2">
              <Input placeholder="new-flag-name" value={newFlag} disabled={readOnly} onChange={e => setNewFlag(e.target.value)} />
              <Button onClick={addFlag} disabled={readOnly}><Plus size={14} /></Button>
            </div>
            <ul className="divide-y divide-border">
              {flags.map(f => (
                <li key={f.id} className="py-3 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium font-mono text-sm flex items-center gap-2">
                      {f.id}
                      <Badge variant={f.enabled ? "default" : "outline"} className="text-[10px]">{f.enabled ? "ON" : "OFF"}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Rollout: {f.rollout ?? 0}%</div>
                    <Slider value={[f.rollout ?? 0]} min={0} max={100} step={5} disabled={readOnly}
                      onValueChange={([v]) => updateFlag(f.id, { rollout: v })} className="mt-2 max-w-md" />
                  </div>
                  <Switch checked={!!f.enabled} disabled={readOnly} onCheckedChange={(v) => updateFlag(f.id, { enabled: v })} />
                  <Button size="sm" variant="ghost" disabled={readOnly} onClick={() => delFlag(f.id)}><Trash2 size={14} /></Button>
                </li>
              ))}
              {flags.length === 0 && <li className="py-4 text-sm text-muted-foreground">No flags yet — add one to gate new features.</li>}
            </ul>
          </Card>
        </TabsContent>

        {/* ── QUOTAS ── */}
        <TabsContent value="quotas" className="mt-4">
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
            <p className="text-xs text-muted-foreground">FatSecret & RapidAPI usage is tracked on their dashboards.</p>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
