import { useEffect, useMemo, useState } from "react";
import {
  addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Megaphone, Trash2, Info, CheckCircle2, AlertTriangle, AlertOctagon, Send, Eye,
  Pin, Sparkles, Copy, Users, Lock,
} from "lucide-react";
import { logActivity } from "@/lib/activity";
import { useAdmin } from "@/hooks/useAdmin";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { auth } from "@/lib/firebase";
import { supabase } from "@/integrations/supabase/client";

/** Fires a real device push for a broadcast; the in-app announcement is already saved. */
async function sendPush(payload: { title: string; body: string; audience: Audience; path?: string }) {
  try {
    const user = auth.currentUser;
    if (!user) return;
    const idToken = await user.getIdToken();
    const { data, error } = await supabase.functions.invoke("push-broadcast", {
      body: {
        idToken,
        title: payload.title.slice(0, 80),
        body: payload.body.slice(0, 400),
        audience: payload.audience,
        path: payload.path?.startsWith("/") ? payload.path : undefined,
      },
    });
    if (error) throw error;
    if (data?.delivered) toast.success(`Push delivered to ${data.delivered} device${data.delivered === 1 ? "" : "s"}`);
  } catch (e) {
    console.warn("[push-broadcast] failed", e);
  }
}

type Severity = "info" | "success" | "warning" | "critical";
type Audience = "all" | "active" | "admins";

interface Announcement {
  id: string;
  title: string;
  body: string;
  severity: Severity;
  audience?: Audience;
  ctaLabel?: string;
  ctaUrl?: string;
  pinned?: boolean;
  createdAt?: any;
}

const SEVERITY_META: Record<Severity, { icon: any; color: string; bg: string; label: string }> = {
  info:     { icon: Info,          color: "text-sky-400",     bg: "bg-sky-500/10 border-sky-500/30",       label: "Info" },
  success:  { icon: CheckCircle2,  color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/30", label: "Success" },
  warning:  { icon: AlertTriangle, color: "text-amber-400",   bg: "bg-amber-500/10 border-amber-500/30",   label: "Warning" },
  critical: { icon: AlertOctagon,  color: "text-destructive", bg: "bg-destructive/10 border-destructive/30", label: "Critical" },
};

const TEMPLATES: { name: string; title: string; body: string; severity: Severity }[] = [
  { name: "New feature", title: "New: barcode scanning", body: "Scan any packaged food to log it instantly — open Nutrition → Barcode.", severity: "success" },
  { name: "Weekly challenge", title: "This week's challenge", body: "Hit 4 workouts before Sunday to earn bonus XP and a new badge.", severity: "info" },
  { name: "Maintenance", title: "Scheduled maintenance", body: "We'll be doing quick maintenance tonight at 22:00. Logging may pause briefly.", severity: "warning" },
  { name: "Incident", title: "We're on it", body: "Some users can't sync workouts. Our team is fixing it right now — sorry for the disruption.", severity: "critical" },
];

const AUDIENCE_LABEL: Record<Audience, string> = {
  all: "Everyone", active: "Active users (7d)", admins: "Team only",
};

export default function AdminAnnouncements() {
  const { canWrite } = useAdmin();
  const [list, setList] = useState<Announcement[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [severity, setSeverity] = useState<Severity>("info");
  const [audience, setAudience] = useState<Audience>("all");
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [pinned, setPinned] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "announcements"), orderBy("createdAt", "desc")),
      (snap) => setList(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))),
    );
    return unsub;
  }, []);

  const stats = useMemo(() => {
    const now = Date.now();
    return {
      total: list.length,
      week: list.filter(a => a.createdAt?.toDate && now - a.createdAt.toDate().getTime() < 7 * 864e5).length,
      pinned: list.filter(a => a.pinned).length,
      critical: list.filter(a => a.severity === "critical").length,
    };
  }, [list]);

  async function send() {
    if (!canWrite) { toast.error("Your role can't broadcast"); return; }
    if (!title.trim() || !body.trim()) { toast.error("Title and body required"); return; }
    setSaving(true);
    try {
      await addDoc(collection(db, "announcements"), {
        title: title.trim(),
        body: body.trim(),
        severity, audience, pinned,
        ctaLabel: ctaLabel.trim() || null,
        ctaUrl: ctaUrl.trim() || null,
        createdAt: serverTimestamp(),
      });
      logActivity("admin.announcement.send", { title, severity, audience });
      toast.success("Broadcast sent to every notification center");
      void sendPush({ title: title.trim(), body: body.trim(), audience, path: ctaUrl.trim() });
      setTitle(""); setBody(""); setCtaLabel(""); setCtaUrl(""); setPinned(false);
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  async function remove(id: string) {
    if (!canWrite) return;
    if (!confirm("Delete this announcement?")) return;
    await deleteDoc(doc(db, "announcements", id));
  }
  async function togglePin(a: Announcement) {
    if (!canWrite) return;
    await setDoc(doc(db, "announcements", a.id), { pinned: !a.pinned }, { merge: true });
  }
  function reuse(a: Announcement) {
    setTitle(a.title); setBody(a.body); setSeverity(a.severity);
    setAudience(a.audience ?? "all"); setCtaLabel(a.ctaLabel ?? ""); setCtaUrl(a.ctaUrl ?? "");
    toast.success("Loaded into composer");
  }
  function applyTemplate(t: typeof TEMPLATES[number]) {
    setTitle(t.title); setBody(t.body); setSeverity(t.severity);
  }

  const meta = SEVERITY_META[severity];
  const Icon = meta.icon;
  const sorted = useMemo(
    () => [...list].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned)),
    [list],
  );

  return (
    <div className="space-y-6">
      {/* hero */}
      <div className="relative overflow-hidden rounded-3xl border border-border p-6 md:p-8">
        <div className="absolute inset-0 -z-10 opacity-70"
          style={{ background: "radial-gradient(800px 260px at 15% -30%, hsl(var(--primary)/0.35), transparent 60%)" }} />
        <Badge variant="outline" className="mb-2 gap-1 text-[10px]"><Megaphone size={10} /> Broadcast center</Badge>
        <h1 className="text-3xl md:text-4xl font-black tracking-tight">Announcements</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-xl">
          Push in-app messages with severity, audience targeting, pinning and a call-to-action.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          {[
            { k: "Sent total", v: stats.total },
            { k: "Last 7 days", v: stats.week },
            { k: "Pinned", v: stats.pinned },
            { k: "Critical", v: stats.critical },
          ].map(s => (
            <div key={s.k} className="rounded-2xl border border-border bg-card/60 backdrop-blur p-3">
              <div className="text-2xl font-black">{s.v}</div>
              <div className="text-[11px] text-muted-foreground">{s.k}</div>
            </div>
          ))}
        </div>
      </div>

      {!canWrite && (
        <Card className="p-4 flex items-center gap-2 text-xs text-amber-400">
          <Lock size={13} /> Your role can review broadcasts but not send them.
        </Card>
      )}

      <div className="grid lg:grid-cols-[1fr_360px] gap-4">
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold">
            <Sparkles size={16} className="text-primary" /> Compose
          </div>

          <div className="flex flex-wrap gap-2">
            {TEMPLATES.map(t => (
              <button key={t.name} onClick={() => applyTemplate(t)} disabled={!canWrite}
                className="px-3 py-1.5 rounded-full border border-border text-xs font-semibold hover:border-primary/60 hover:text-primary transition-colors">
                {t.name}
              </button>
            ))}
          </div>

          <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title" disabled={!canWrite} maxLength={80} />
          <div>
            <Textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Message body" rows={4} disabled={!canWrite} maxLength={400} />
            <p className="text-[10px] text-muted-foreground mt-1 text-right">{body.length}/400</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Severity</label>
              <div className="flex gap-1.5 mt-1.5">
                {(Object.keys(SEVERITY_META) as Severity[]).map(s => {
                  const m = SEVERITY_META[s]; const I = m.icon;
                  return (
                    <button key={s} onClick={() => setSeverity(s)} disabled={!canWrite}
                      className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-xl border text-[10px] font-bold transition-all ${
                        severity === s ? `${m.bg} ${m.color}` : "border-border text-muted-foreground hover:border-primary/40"
                      }`}>
                      <I size={14} /> {m.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Audience</label>
              <Select value={audience} onValueChange={(v) => setAudience(v as Audience)} disabled={!canWrite}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(AUDIENCE_LABEL) as Audience[]).map(a => (
                    <SelectItem key={a} value={a}>{AUDIENCE_LABEL[a]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Input placeholder="CTA label (optional)" value={ctaLabel} onChange={e => setCtaLabel(e.target.value)} disabled={!canWrite} />
            <Input placeholder="CTA URL" value={ctaUrl} onChange={e => setCtaUrl(e.target.value)} disabled={!canWrite} />
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-secondary/30">
            <div className="flex items-center gap-2 text-sm font-semibold"><Pin size={14} /> Pin to top of notifications</div>
            <Switch checked={pinned} onCheckedChange={setPinned} disabled={!canWrite} />
          </div>

          <Button onClick={send} disabled={saving || !canWrite} className="w-full sm:w-auto">
            <Send size={14} className="mr-1" /> {saving ? "Sending…" : "Broadcast now"}
          </Button>
        </Card>

        {/* preview */}
        <Card className="p-4 space-y-2 h-fit lg:sticky lg:top-6">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <Eye size={12} /> Live preview
          </div>
          <motion.div layout className={`rounded-2xl border p-4 ${meta.bg}`}>
            <div className={`flex items-start gap-3 ${meta.color}`}>
              <Icon size={18} className="mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-foreground flex items-center gap-1.5">
                  {pinned && <Pin size={11} />} {title || "Announcement title"}
                </p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {body || "Body of the message appears here. Keep it concise."}
                </p>
                {ctaLabel && (
                  <span className="inline-block mt-2 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold">
                    {ctaLabel}
                  </span>
                )}
              </div>
            </div>
          </motion.div>
          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Users size={10} /> Going to <strong>{AUDIENCE_LABEL[audience]}</strong>
          </p>
        </Card>
      </div>

      <Card>
        <div className="p-4 border-b border-border text-sm font-bold">History ({list.length})</div>
        <ul className="divide-y divide-border">
          <AnimatePresence initial={false}>
            {sorted.map(a => {
              const m = SEVERITY_META[a.severity] || SEVERITY_META.info;
              const I = m.icon;
              return (
                <motion.li key={a.id} layout initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="p-4 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0 flex items-start gap-3">
                    <div className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 ${m.bg} ${m.color}`}>
                      <I size={14} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {a.pinned && <Badge className="text-[10px] gap-1"><Pin size={9} /> pinned</Badge>}
                        <Badge variant={a.severity === "critical" ? "destructive" : "secondary"} className="text-[10px]">{a.severity}</Badge>
                        <Badge variant="outline" className="text-[10px]">{AUDIENCE_LABEL[a.audience ?? "all"]}</Badge>
                        <span className="font-semibold text-sm">{a.title}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{a.body}</p>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {a.createdAt?.toDate?.()?.toLocaleString?.() ?? "just now"}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" variant="ghost" title="Reuse" onClick={() => reuse(a)}><Copy size={14} /></Button>
                    <Button size="sm" variant="ghost" title="Pin" disabled={!canWrite} onClick={() => togglePin(a)}>
                      <Pin size={14} className={a.pinned ? "text-primary" : ""} />
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive" disabled={!canWrite} onClick={() => remove(a.id)}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
          {list.length === 0 && <li className="p-8 text-center text-sm text-muted-foreground">No announcements yet — start with a template above.</li>}
        </ul>
      </Card>
    </div>
  );
}
