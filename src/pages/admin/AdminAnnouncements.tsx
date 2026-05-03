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
import { Megaphone, Trash2 } from "lucide-react";
import { logActivity } from "@/lib/activity";
import { toast } from "sonner";

type Severity = "info" | "success" | "warning" | "critical";

interface Announcement {
  id: string;
  title: string;
  body: string;
  severity: Severity;
  createdAt?: any;
}

export default function AdminAnnouncements() {
  const [list, setList] = useState<Announcement[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [severity, setSeverity] = useState<Severity>("info");
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
        title: title.trim(), body: body.trim(), severity, createdAt: serverTimestamp(),
      });
      logActivity("admin.announcement.send", { title, severity });
      toast.success("Announcement broadcast");
      setTitle(""); setBody("");
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  async function remove(id: string) {
    if (!confirm("Delete this announcement?")) return;
    await deleteDoc(doc(db, "announcements", id));
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold">Announcements</h1>
        <p className="text-sm text-muted-foreground">Broadcast in-app messages to every signed-in user.</p>
      </header>

      <Card className="p-6 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Megaphone size={16} className="text-primary" /> Compose
        </div>
        <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title" />
        <Textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Message body" rows={4} />
        <div className="flex gap-3 items-center">
          <Select value={severity} onValueChange={(v) => setSeverity(v as Severity)}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="info">Info</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={send} disabled={saving}>{saving ? "Sending…" : "Broadcast"}</Button>
        </div>
      </Card>

      <Card>
        <div className="p-4 border-b border-border text-sm font-semibold">Sent ({list.length})</div>
        <ul className="divide-y divide-border">
          {list.map(a => (
            <li key={a.id} className="p-4 flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Badge variant={a.severity === "critical" ? "destructive" : "secondary"}>{a.severity}</Badge>
                  <span className="font-medium">{a.title}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{a.body}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {a.createdAt?.toDate?.()?.toLocaleString?.() ?? "—"}
                </p>
              </div>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(a.id)}>
                <Trash2 size={14} />
              </Button>
            </li>
          ))}
          {list.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">No announcements yet.</li>}
        </ul>
      </Card>
    </div>
  );
}
