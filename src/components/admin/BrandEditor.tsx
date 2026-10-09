import { useRef, useState } from "react";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "@/lib/firebase";
import { useSettingsEditor } from "@/hooks/useSettingsEditor";
import { DEFAULT_SETTINGS, normalizeSiteSettings, safeAssetUrl, safeExternalUrl, validHsl, hexToHsl, hslToHex, contrastForeground, type SiteSettings } from "@/lib/site-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Save, UploadCloud, RotateCcw, Palette, Dumbbell, Eye, ArrowRight } from "lucide-react";
import { toast } from "sonner";
const PRESETS = [
  { name: "Forest", primaryHsl: "165 76% 29%", accentHsl: "145 45% 45%" },
  { name: "Ocean", primaryHsl: "221 83% 53%", accentHsl: "187 76% 38%" },
  { name: "Violet", primaryHsl: "262 65% 53%", accentHsl: "316 70% 45%" },
  { name: "Ember", primaryHsl: "24 90% 45%", accentHsl: "346 75% 45%" },
];
type AssetKey = "logoUrl" | "darkLogoUrl" | "faviconUrl" | "heroImageUrl";
type TextKey = "businessName" | "shortName" | "tagline" | "supportEmail" | "supportUrl" | "heroTitle" | "heroHighlight" | "heroDescription" | "heroCta" | "loginTitle" | "loginDescription" | "dashboardSubtitle" | "welcomeTitle" | "sidebarTitle" | "sidebarDescription" | "footerText" | "announcementBanner" | "maintenanceMessage";
export default function BrandEditor() {
  const editor = useSettingsEditor("branding", normalizeSiteSettings);
  const { draft, edit, readOnly, loading, saving, dirty } = editor;
  const [uploading, setUploading] = useState<AssetKey | null>(null);
  const [previewDark, setPreviewDark] = useState(false);
  const [restoring, setRestoring] = useState("");
  const uploadRef = useRef<HTMLInputElement>(null);
  const uploadTarget = useRef<AssetKey>("logoUrl");
  const text = (key: TextKey, label: string, multiline = false, maxLength = 250) => <div className="space-y-2" key={key}>
    <Label htmlFor={`brand-${key}`}>{label}</Label>
    {multiline ? <Textarea id={`brand-${key}`} value={draft[key]} maxLength={maxLength} disabled={readOnly} onChange={event => edit({ [key]: event.target.value })} /> : <Input id={`brand-${key}`} value={draft[key]} maxLength={maxLength} disabled={readOnly} onChange={event => edit({ [key]: event.target.value })} />}
  </div>;
  function validate(value: SiteSettings) {
    if (!value.businessName.trim()) return "Enter an app name.";
    for (const key of ["logoUrl", "darkLogoUrl", "faviconUrl", "heroImageUrl"] as const) if (!safeAssetUrl(value[key])) return "Use an HTTPS image URL or a path starting with /.";
    if (!safeExternalUrl(value.supportUrl)) return "Use an HTTPS support link.";
    if (value.supportEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.supportEmail)) return "Enter a valid support email.";
    for (const key of ["primaryHsl", "accentHsl", "lightBackgroundHsl", "darkBackgroundHsl"] as const) if (value[key] && !validHsl(value[key])) return "Use an HSL colour such as 165 76% 29%.";
    return "";
  }
  async function publish() { const issue = validate(draft); if (issue) { toast.error(issue); return; } await editor.publish(normalizeSiteSettings(draft)); }
  async function upload(file: File) {
    const key = uploadTarget.current;
    if (readOnly || !["image/png", "image/jpeg", "image/webp", "image/x-icon", "image/vnd.microsoft.icon"].includes(file.type) || file.size > 2 * 1024 * 1024) { toast.error("Choose a PNG, JPEG, WebP or ICO image under 2 MB."); return; }
    setUploading(key);
    try {
      const asset = ref(storage, `public/branding/${key}-${crypto.randomUUID()}.${file.name.split(".").pop()?.replace(/[^a-z0-9]/gi, "") || "png"}`);
      await uploadBytes(asset, file, { contentType: file.type, cacheControl: "public,max-age=86400" });
      edit({ [key]: await getDownloadURL(asset) });
      toast.success("Image ready in your draft. Publish to apply it.");
    } catch { toast.error("Image could not upload. Your published brand is unchanged."); }
    finally { setUploading(null); }
  }
  if (loading) return <p role="status">Loading published brand…</p>;
  const primary = draft.primaryHsl || (previewDark ? "158 63% 62%" : "165 76% 29%");
  const accent = draft.accentHsl || primary;
  const previewStyle = {
    "--primary": primary, "--accent": accent, "--primary-foreground": contrastForeground(primary),
    "--background": (previewDark ? draft.darkBackgroundHsl : draft.lightBackgroundHsl) || (previewDark ? "160 16% 7%" : "150 18% 97%"),
    "--card": previewDark ? "160 13% 11%" : "0 0% 100%", "--foreground": previewDark ? "140 12% 94%" : "160 20% 13%",
    "--muted-foreground": previewDark ? "155 7% 62%" : "160 8% 43%", "--border": previewDark ? "160 10% 20%" : "155 12% 87%",
    "--radius": `${draft.radius}rem`, fontFamily: draft.fontFamily === "system" ? "system-ui" : draft.fontFamily === "syne" ? "Syne, sans-serif" : "Inter, sans-serif",
  } as React.CSSProperties;
  return <div className="space-y-5">
    <div className="flex flex-wrap justify-between items-center gap-3 rounded-2xl border border-border p-4 bg-card">
      <div><p className="font-semibold">Your app, your identity</p><p className="text-xs text-muted-foreground mt-1">{dirty ? "Unpublished changes · preview before saving" : "Published brand · changes sync to all connected screens"}</p></div>
      <div className="flex gap-2"><Button variant="outline" disabled={!dirty || saving} onClick={editor.discard}>Discard</Button><Button disabled={readOnly || saving || !!uploading || editor.conflict} onClick={publish}><Save size={15} className="mr-2" />{saving ? "Publishing…" : "Publish brand"}</Button></div>
    </div>
    {(editor.error || editor.conflict) && <div role="alert" className="rounded-xl border border-destructive/30 p-4 text-sm">{editor.error || "A new version was published while you were editing. Discard to reload it, then reapply your changes."}</div>}
    <div className="grid xl:grid-cols-[minmax(0,1fr)_340px] gap-5">
      <div className="space-y-5">
        <section className="workspace-card p-5 md:p-6 space-y-5"><h2 className="text-lg">App identity</h2><div className="grid sm:grid-cols-2 gap-4">{text("businessName", "App name", false, 60)}{text("shortName", "Short name / installed app", false, 20)}{text("tagline", "Tagline", false, 160)}{text("supportEmail", "Support email")}{text("supportUrl", "Support website")}{text("footerText", "Footer text")}</div></section>
        <section className="workspace-card p-5 md:p-6 space-y-5"><h2 className="text-lg">Brand assets</h2>
          <input ref={uploadRef} type="file" accept="image/png,image/jpeg,image/webp,image/x-icon,image/vnd.microsoft.icon" className="hidden" aria-label="Brand asset file" onChange={event => { const file = event.target.files?.[0]; if (file) void upload(file); event.target.value = ""; }} />
          {([{ key: "logoUrl", label: "Main logo" }, { key: "darkLogoUrl", label: "Dark mode logo" }, { key: "faviconUrl", label: "Favicon / browser icon" }, { key: "heroImageUrl", label: "Landing hero image" }] as const).map(asset => <div key={asset.key} className="space-y-2">
            <Label htmlFor={`brand-${asset.key}`}>{asset.label}</Label><div className="flex gap-2 items-center"><span className="w-12 h-12 border border-border rounded-xl flex items-center justify-center shrink-0 bg-secondary/40 overflow-hidden">{draft[asset.key] && safeAssetUrl(draft[asset.key]) ? <img src={draft[asset.key]} alt={`${asset.label} preview`} className="w-full h-full object-contain p-1" /> : <Dumbbell size={17} className="text-muted-foreground" />}</span><Input id={`brand-${asset.key}`} value={draft[asset.key]} disabled={readOnly} placeholder="https://… or /image.png" onChange={event => edit({ [asset.key]: event.target.value })} /><Button variant="outline" size="icon" aria-label={`Upload ${asset.label}`} disabled={readOnly || !!uploading} onClick={() => { uploadTarget.current = asset.key; uploadRef.current?.click(); }}><UploadCloud size={17} /></Button></div>
          </div>)}<p className="text-xs text-muted-foreground">PNG, JPEG, WebP or ICO · under 2 MB. A square PNG of at least 192px works best for installed app icons. Clear a URL to restore its default.</p>
        </section>
        <section className="workspace-card p-5 md:p-6 space-y-5"><h2 className="text-lg flex gap-2 items-center"><Palette size={19} /> Colours & appearance</h2><div className="flex flex-wrap gap-2">{PRESETS.map(preset => <button key={preset.name} className="border border-border rounded-full py-2 px-3 text-xs flex items-center gap-2 hover:bg-secondary transition-colors" disabled={readOnly} onClick={() => edit({ primaryHsl: preset.primaryHsl, accentHsl: preset.accentHsl })}><span className="w-3 h-3 rounded-full" style={{ background: `hsl(${preset.primaryHsl})` }} />{preset.name}</button>)}</div>
          <div className="grid sm:grid-cols-2 gap-4">{([{ key: "primaryHsl", label: "Primary colour" }, { key: "accentHsl", label: "Accent colour" }, { key: "lightBackgroundHsl", label: "Light background" }, { key: "darkBackgroundHsl", label: "Dark background" }] as const).map(color => <div className="space-y-2" key={color.key}><Label htmlFor={`brand-${color.key}`}>{color.label}</Label><div className="flex gap-2"><input aria-label={`${color.label} picker`} type="color" value={hslToHex(draft[color.key] || primary)} disabled={readOnly} onChange={event => edit({ [color.key]: hexToHsl(event.target.value) })} className="w-12 h-10 border border-border rounded-lg bg-transparent" /><Input id={`brand-${color.key}`} value={draft[color.key]} disabled={readOnly} placeholder="Use app default" onChange={event => edit({ [color.key]: event.target.value })} /></div></div>)}
            <div className="space-y-2"><Label htmlFor="brand-font">Typeface</Label><select id="brand-font" className="admin-select" value={draft.fontFamily} disabled={readOnly} onChange={event => edit({ fontFamily: event.target.value as SiteSettings["fontFamily"] })}><option value="inter">Inter</option><option value="syne">Syne</option><option value="system">System font</option></select></div>
            <div className="space-y-2"><Label htmlFor="brand-motion">Animation style</Label><select id="brand-motion" className="admin-select" value={draft.motion} disabled={readOnly} onChange={event => edit({ motion: event.target.value as SiteSettings["motion"] })}><option value="full">Full motion</option><option value="reduced">Reduced motion</option></select></div>
            <div className="sm:col-span-2 space-y-2"><Label htmlFor="brand-radius">Corner radius · {draft.radius.toFixed(2)}rem</Label><input id="brand-radius" className="w-full accent-[hsl(var(--primary))]" type="range" min="0" max="2" step="0.05" value={draft.radius} disabled={readOnly} onChange={event => edit({ radius: Number(event.target.value) })} /></div>
          </div><p className="text-xs text-muted-foreground">Button text adapts to your colour for contrast. Device reduced-motion preferences are always respected.</p>
        </section>
        <section className="workspace-card p-5 md:p-6 space-y-5"><h2 className="text-lg">Rewrite the app experience</h2><div className="grid sm:grid-cols-2 gap-4">{text("heroTitle", "Landing headline", false, 120)}{text("heroHighlight", "Landing highlight", false, 120)}{text("heroDescription", "Landing description", true, 500)}{text("heroCta", "Landing button", false, 50)}{text("loginTitle", "Sign-in heading", false, 100)}{text("loginDescription", "Sign-in description")}{text("dashboardSubtitle", "Today description")}{text("welcomeTitle", "Today welcome card", false, 120)}{text("sidebarTitle", "Sidebar note heading", false, 100)}{text("sidebarDescription", "Sidebar note")}</div></section>
        <section className="workspace-card p-5 md:p-6 space-y-5"><h2 className="text-lg">Announcements & operations</h2>{text("announcementBanner", "Member announcement", true, 300)}{text("maintenanceMessage", "Maintenance message", true, 300)}<div className="flex items-center justify-between gap-4"><div><Label htmlFor="brand-maintenance">Maintenance notice</Label><p className="text-xs text-muted-foreground mt-1">Show the notice; existing sessions remain usable.</p></div><Switch id="brand-maintenance" checked={draft.maintenanceMode} disabled={readOnly} onCheckedChange={checked => edit({ maintenanceMode: checked })} /></div><div className="flex items-center justify-between gap-4"><div><Label htmlFor="brand-signups">Show new account registration</Label><p className="text-xs text-muted-foreground mt-1">Controls registration in this app. Existing members can sign in.</p></div><Switch id="brand-signups" checked={draft.signupEnabled} disabled={readOnly} onCheckedChange={checked => edit({ signupEnabled: checked })} /></div></section>
      </div>
      <aside className="space-y-4 xl:sticky xl:top-24 h-fit"><div className="workspace-card p-4 space-y-3"><div className="flex justify-between items-center"><p className="text-xs font-semibold flex items-center gap-2"><Eye size={14} />Draft preview</p><button className="text-xs text-primary" onClick={() => setPreviewDark(value => !value)}>{previewDark ? "Light preview" : "Dark preview"}</button></div>
        <div className="p-5 border border-border space-y-5" style={{ ...previewStyle, background: "hsl(var(--background))", color: "hsl(var(--foreground))", borderRadius: "var(--radius)" }}>
          <div className="flex items-center gap-3">{((previewDark && draft.darkLogoUrl) || draft.logoUrl) && safeAssetUrl((previewDark && draft.darkLogoUrl) || draft.logoUrl) ? <img src={(previewDark && draft.darkLogoUrl) || draft.logoUrl} alt="Draft logo" className="h-10 max-w-20 object-contain" /> : <span className="p-3 bg-primary/10 rounded-xl text-primary"><Dumbbell size={19} /></span>}<div><p className="text-sm font-semibold">{draft.businessName}</p><p className="text-[10px] text-muted-foreground">{draft.tagline}</p></div></div>
          <div><p className="text-[10px] uppercase tracking-widest text-primary">Today</p><h3 className="text-2xl leading-tight font-semibold mt-3" style={{ fontFamily: "inherit" }}>{draft.welcomeTitle}</h3><p className="text-xs text-muted-foreground mt-3">{draft.dashboardSubtitle}</p></div>
          <button className="member-action w-full" style={{ borderRadius: "var(--radius)" }}>Start workout<ArrowRight size={15} /></button><div className="p-3 border border-border bg-card" style={{ borderRadius: "var(--radius)" }}><p className="text-xs mb-3">A week in motion</p><div className="flex gap-2 h-14 items-end">{[.35, .65, .45, .95, .75, .4, .6].map((height, i) => <span key={i} className="bg-primary flex-1 rounded-t" style={{ height: `${height * 100}%` }} />)}</div></div>
          <p className="text-[10px] text-muted-foreground">Preview illustration · sample data</p>
        </div></div>
        <div className="workspace-card p-4 space-y-3"><p className="text-sm font-semibold">Restore a published version</p><select aria-label="Brand version to restore" className="admin-select" value={restoring} onChange={event => setRestoring(event.target.value)}><option value="">Select a previous version</option>{editor.history.map(item => <option key={item.id} value={item.id}>{item.date}</option>)}</select><Button variant="outline" size="sm" disabled={readOnly || !restoring} onClick={() => { const previous = editor.history.find(item => item.id === restoring); if (previous) edit(previous.settings); }}><RotateCcw size={14} className="mr-2" />Load into draft</Button><Button variant="ghost" size="sm" disabled={readOnly} onClick={() => edit({ ...DEFAULT_SETTINGS })}>Restore app defaults</Button><p className="text-xs text-muted-foreground">Review the draft, then publish. Previous versions are kept for administrators.</p></div>
      </aside>
    </div>
  </div>;
}
