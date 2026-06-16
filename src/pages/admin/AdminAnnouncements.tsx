import { useEffect, useState } from "react";
import {
  addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Megaphone, Trash2, Info, CheckCircle2, AlertTriangle, AlertOctagon, Send, Eye,
} from "lucide-react";
import { logActivity } from "@/lib/activity";
import { toast } from "sonner";

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
  createdAt?: any;
}

const SEVERITY_META: Record<Severity, { icon: any; color: string; bg: string }> = {
  info:     { icon: Info,         color: "text-sky-400",    bg: "bg-sky-500/10 border-sky-500/30" },
  success:  { icon: CheckCircle2, color: "text-green-400",  bg: "bg-green-500/10 border-green-500/30" },
  warning:  { icon: AlertTriangle,color: "text-amber-400",  bg: "bg-amber-500/10 border-amber-500/30" },
  critical: { icon: AlertOctagon, color: "text-destructive",bg: "bg-destructive/10 border-destructive/30" },
};

export default function AdminAnnouncements() {
  const [list, setList] = useState<Announcement[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [severity, setSeverity] = useState<Severity>("info");
  const [audience, setAudience] = useState<Audience>("all");
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "announcements"), orderBy("createdAt", "desc")),
      (snap) => setList(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))),
    );
    return unsub;
  }, []);

  async function send() {
    if (!title.trim() || !body.trim()) { toast.error("Title and body required"); return; }
    setSaving(true);
    try {
      await addDoc(collection(db, "announcements"), {
        title: title.trim(),
        body: body.trim(),
        severity,
        audience,
        ctaLabel: ctaLabel.trim() || null,
        ctaUrl: ctaUrl.trim() || null,
        createdAt: serverTimestamp(),
      });
      logActivity("admin.announcement.send", { title, severity, audience });
      toast.success("Announcement broadcast");
      setTitle(""); setBody(""); setCtaLabel(""); setCtaUrl("");
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  async function remove(id: string) {
    if (!confirm("Delete this announcement?")) return;
    await deleteDoc(doc(db, "announcements", id));
  }

  const meta = SEVERITY_META[severity];
  const Icon = meta.icon;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold">Announcements</h1>
        <p className="text-sm text-muted-foreground">Broadcast in-app messages with severity, audience, and call-to-action.</p>
      </header>

      <div className="grid lg:grid-cols-[1fr_360px] gap-4">
        <Card className="p-6 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Megaphone size={16} className="text-primary" /> Compose
          </div>
          <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title" />
          <Textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Message body" rows={4} />
          <div className="grid sm:grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Severity</label>
              <Select value={severity} onValueChange={(v) => setSeverity(v as Severity)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Audience</label>
              <Select value={audience} onValueChange={(v) => setAudience(v as Audience)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Everyone</SelectItem>
                  <SelectItem value="active">Active users (7d)</SelectItem>
                  <SelectItem value="admins">Admins only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Input placeholder="CTA label (optional)" value={ctaLabel} onChange={e => setCtaLabel(e.target.value)} />
            <Input placeholder="CTA URL" value={ctaUrl} onChange={e => setCtaUrl(e.target.value)} />
          </div>
          <Button onClick={send} disabled={saving} className="w-full sm:w-auto">
            <Send size={14} className="mr-1" /> {saving ? "Sending…" : "Broadcast"}
          </Button>
        </Card>

        {/* Live preview */}
        <Card className="p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <Eye size={12} /> Live preview
          </div>
          <div className={`rounded-xl border p-4 ${meta.bg}`}>
            <div className={`flex items-start gap-3 ${meta.color}`}>
              <Icon size={18} className="mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-foreground">{title || "Announcement title"}</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {body || "Body of the message appears here. Keep it concise."}
                </p>
                {ctaLabel && (
                  <a href={ctaUrl || "#"} target="_blank" rel="noopener noreferrer"
                    className="inline-block mt-2 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold">
                    {ctaLabel}
                  </a>
                )}
              </div>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground">Audience: <strong>{audience}</strong></p>
        </Card>
      </div>

      <Card>
        <div className="p-4 border-b border-border text-sm font-semibold">Sent ({list.length})</div>
        <ul className="divide-y divide-border">
          {list.map(a => {
            const m = SEVERITY_META[a.severity] || SEVERITY_META.info;
            const I = m.icon;
            return (
              <li key={a.id} className="p-4 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0 flex items-start gap-3">
                  <I size={16} className={`${m.color} mt-1 flex-shrink-0`} />
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={a.severity === "critical" ? "destructive" : "secondary"}>{a.severity}</Badge>
                      {a.audience && <Badge variant="outline" className="text-[10px]">{a.audience}</Badge>}
                      <span className="font-medium">{a.title}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{a.body}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {a.createdAt?.toDate?.()?.toLocaleString?.() ?? "—"}
                    </p>
                  </div>
                </div>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(a.id)}>
                  <Trash2 size={14} />
                </Button>
              </li>
            );
          })}
          {list.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">No announcements yet.</li>}
        </ul>
      </Card>
    </div>
  );
}
