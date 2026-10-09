import { useState } from "react";
import { useSettingsEditor } from "@/hooks/useSettingsEditor";
import { FEATURES, normalizeAccessConfig, type FeatureId, type FeatureMode, type FeaturePolicy } from "@/lib/feature-access";
import { safeExternalUrl } from "@/lib/site-settings";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Save, Check, Crown, PauseCircle, RotateCcw } from "lucide-react";
import { toast } from "sonner";
export default function FeatureControls() {
  const editor = useSettingsEditor("access", normalizeAccessConfig);
  const { draft, edit, readOnly, saving } = editor;
  const [restoring, setRestoring] = useState("");
  function patchFeature(id: FeatureId, patch: Partial<FeaturePolicy>) { edit({ features: { ...draft.features, [id]: { ...draft.features[id], ...patch } } }); }
  async function publish() {
    if (!safeExternalUrl(draft.membership.upgradeUrl)) { toast.error("Use an HTTPS membership link."); return; }
    await editor.publish(normalizeAccessConfig(draft));
  }
  if (editor.loading) return <p role="status">Loading feature controls…</p>;
  return <div className="space-y-5">
    <div className="workspace-card p-5 flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-lg">Choose what members can use</h2><p className="text-xs text-muted-foreground mt-1">{editor.dirty ? "Unpublished changes" : "All sections are free until you change their access."} · Profile, Today and support always stay available.</p></div><div className="flex gap-2"><Button variant="outline" disabled={!editor.dirty || saving} onClick={editor.discard}>Discard</Button><Button onClick={publish} disabled={readOnly || saving || editor.conflict}><Save size={15} className="mr-2" />{saving ? "Publishing…" : "Publish feature access"}</Button></div></div>
    {(editor.error || editor.conflict) && <p role="alert" className="border border-destructive/30 rounded-xl p-4 text-sm">{editor.error || "Another administrator changed these settings. Discard to reload the published version."}</p>}
    <div className="grid sm:grid-cols-3 gap-3">{[{ title: "Free", icon: Check, description: "Available to every signed-in member." }, { title: "Premium", icon: Crown, description: "Requires an active plan or a feature grant." }, { title: "Disabled", icon: PauseCircle, description: "Hidden from menus. Saved data is retained." }].map(item => <div className="workspace-card p-4" key={item.title}><item.icon size={19} className="text-primary mb-3" /><h3 className="text-sm">{item.title}</h3><p className="text-xs text-muted-foreground mt-2">{item.description}</p></div>)}</div>
    <section className="workspace-card overflow-hidden">
      <div className="p-5 border-b border-border"><h2 className="text-lg">Feature catalogue</h2><p className="text-xs text-muted-foreground mt-2">Nutrition controls its recipes, meal planner, grocery list and scanner too. Child features can add a further restriction. Administrators retain preview access.</p></div>
      <div className="divide-y divide-border">{FEATURES.map(feature => {
        const policy = draft.features[feature.id];
        const parent = "parent" in feature ? draft.features[feature.parent] : null;
        return <article key={feature.id} aria-label={`${feature.label} controls`} className="p-5 md:p-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center gap-4 md:justify-between"><div><h3 className="text-base">{feature.label}<span className="text-xs text-muted-foreground font-normal ml-2">{parent ? "Part of Nutrition" : "App section"}</span></h3><p className="text-xs text-muted-foreground mt-1">{feature.description}</p>{parent && parent.mode !== "free" && <p className="text-xs text-primary mt-2">Inherits Nutrition's {parent.mode === "disabled" ? "disabled" : "membership"} restriction.</p>}</div>
            <div className="flex gap-3 flex-wrap"><div className="space-y-1.5"><Label htmlFor={`mode-${feature.id}`} className="text-xs">Access</Label><select id={`mode-${feature.id}`} className="admin-select min-w-36" disabled={readOnly} value={policy.mode} onChange={event => patchFeature(feature.id, { mode: event.target.value as FeatureMode })}><option value="free">Free</option><option value="premium">Premium</option><option value="disabled">Disabled</option></select></div>{policy.mode === "premium" && <div className="space-y-1.5"><Label htmlFor={`plan-${feature.id}`} className="text-xs">Minimum plan</Label><select id={`plan-${feature.id}`} className="admin-select" disabled={readOnly} value={policy.requiredPlan} onChange={event => patchFeature(feature.id, { requiredPlan: event.target.value as "plus" | "pro" })}><option value="plus">{draft.membership.plusName}</option><option value="pro">{draft.membership.proName}</option></select></div>}</div>
          </div>
          <div className="grid sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-3"><div className="space-y-1.5"><Label htmlFor={`label-${feature.id}`} className="text-xs">Member-facing name</Label><Input id={`label-${feature.id}`} placeholder={feature.label} disabled={readOnly} maxLength={60} value={policy.label} onChange={event => patchFeature(feature.id, { label: event.target.value })} /></div><div className="space-y-1.5"><Label htmlFor={`message-${feature.id}`} className="text-xs">Unavailable / upgrade message</Label><Input id={`message-${feature.id}`} placeholder="Use the default message" maxLength={300} value={policy.message} disabled={readOnly} onChange={event => patchFeature(feature.id, { message: event.target.value })} /></div></div>
        </article>;
      })}</div>
    </section>
    <section className="workspace-card p-5 md:p-6 space-y-5"><h2 className="text-lg">Membership & upgrade experience</h2><div className="grid sm:grid-cols-2 gap-4">
      {([{ key: "plusName", label: "Plus plan name", max: 40 }, { key: "proName", label: "Pro plan name", max: 40 }, { key: "plusPrice", label: "Plus display price", max: 50 }, { key: "proPrice", label: "Pro display price", max: 50 }, { key: "paywallTitle", label: "Upgrade heading", max: 120 }, { key: "upgradeLabel", label: "Membership link label", max: 50 }, { key: "upgradeUrl", label: "Membership / checkout URL (HTTPS)", max: 2000 }] as const).map(field => <div className="space-y-2" key={field.key}><Label htmlFor={`membership-${field.key}`}>{field.label}</Label><Input id={`membership-${field.key}`} value={draft.membership[field.key]} disabled={readOnly} maxLength={field.max} placeholder={field.key.endsWith("Price") ? "e.g. R99 / month" : undefined} onChange={event => edit({ membership: { ...draft.membership, [field.key]: event.target.value } })} /></div>)}
      <div className="space-y-2"><Label htmlFor="membership-description">Upgrade description</Label><Textarea id="membership-description" maxLength={400} value={draft.membership.paywallDescription} disabled={readOnly} onChange={event => edit({ membership: { ...draft.membership, paywallDescription: event.target.value } })} /></div>
    </div><p className="text-xs text-muted-foreground">Prices are display text. Use Memberships to confirm access; automatic payments require a verified billing integration. Without a membership link, members are directed to support.</p></section>
    <section className="workspace-card p-5 flex flex-wrap gap-3 items-center"><Label htmlFor="access-history">Restore access settings</Label><select id="access-history" className="admin-select sm:max-w-xs" value={restoring} onChange={event => setRestoring(event.target.value)}><option value="">Select a previous version</option>{editor.history.map(item => <option key={item.id} value={item.id}>{item.date}</option>)}</select><Button variant="outline" disabled={readOnly || !restoring} onClick={() => { const previous = editor.history.find(item => item.id === restoring); if (previous) edit(previous.settings); }}><RotateCcw size={14} className="mr-2" />Load into draft</Button><Button variant="ghost" disabled={readOnly} onClick={() => edit({ ...draft, features: normalizeAccessConfig({}).features })}>Make all features free</Button></section>
  </div>;
}
