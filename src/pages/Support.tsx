import { useEffect, useMemo, useRef, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import {
  addDoc, collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where,
} from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { logActivity } from "@/lib/activity";
import { toast } from "sonner";
import {
  LifeBuoy, Plus, Paperclip, Send, Bug, Lightbulb, User as UserIcon, HelpCircle, Loader2, MessageCircle,
} from "lucide-react";

const CATEGORIES = [
  { id: "bug",     label: "Bug",        icon: Bug,         color: "text-red-400" },
  { id: "feature", label: "Feature",    icon: Lightbulb,   color: "text-amber-400" },
  { id: "account", label: "Account",    icon: UserIcon,    color: "text-blue-400" },
  { id: "other",   label: "Other",      icon: HelpCircle,  color: "text-muted-foreground" },
] as const;

type Category = typeof CATEGORIES[number]["id"];

interface Ticket {
  id: string; subject: string; status: "open" | "pending" | "closed";
  category?: Category; createdAt?: any; lastMessageAt?: any;
}
interface Message {
  id: string; authorRole: "user" | "admin"; body: string;
  attachmentURL?: string; createdAt?: any;
}

export default function Support() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const replyFileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(
      query(collection(db, "supportTickets"), where("userId", "==", user.uid), orderBy("createdAt", "desc")),
      (snap) => setTickets(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))),
    );
    return unsub;
  }, [user]);

  useEffect(() => {
    if (!active) { setMsgs([]); return; }
    const unsub = onSnapshot(
      query(collection(db, "supportTickets", active, "messages"), orderBy("createdAt", "asc")),
      (snap) => {
        setMsgs(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
        setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }), 50);
      },
    );
    return unsub;
  }, [active]);

  const activeTicket = useMemo(() => tickets.find(t => t.id === active), [tickets, active]);

  async function uploadAttachment(ticketId: string, file: File): Promise<string | null> {
    if (!user) return null;
    try {
      const path = `users/${user.uid}/support/${ticketId}/${Date.now()}_${file.name}`;
      const r = storageRef(storage, path);
      await uploadBytes(r, file, { contentType: file.type || "image/jpeg" });
      return await getDownloadURL(r);
    } catch (e: any) {
      console.warn(e); toast.error("Attachment upload failed");
      return null;
    }
  }

  async function send() {
    if (!user || !active || (!reply.trim() && !replyFileRef.current?.files?.[0])) return;
    setSending(true);
    try {
      const file = replyFileRef.current?.files?.[0];
      const attachmentURL = file ? await uploadAttachment(active, file) : null;
      await addDoc(collection(db, "supportTickets", active, "messages"), {
        authorId: user.uid, authorRole: "user", body: reply.trim(),
        ...(attachmentURL ? { attachmentURL } : {}),
        createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, "supportTickets", active), {
        lastMessageAt: serverTimestamp(), status: "open",
      });
      logActivity("support.ticket.reply", { ticketId: active });
      setReply("");
      if (replyFileRef.current) replyFileRef.current.value = "";
    } catch (e: any) {
      toast.error(e?.message || "Send failed");
    } finally { setSending(false); }
  }

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto px-4 md:px-6 pt-20 pb-24 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center">
              <LifeBuoy className="text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-heading font-bold">Support</h1>
              <p className="text-sm text-muted-foreground">We typically reply within 24 hours.</p>
            </div>
          </div>
          <NewTicketDialog open={newOpen} onOpenChange={setNewOpen} onCreated={(id) => setActive(id)} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
          {/* Inbox */}
          <Card className="overflow-hidden h-fit lg:max-h-[70vh] flex flex-col">
            <div className="p-3 border-b border-border flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-muted-foreground font-bold">My tickets</span>
              <span className="text-xs text-muted-foreground">{tickets.length}</span>
            </div>
            <ul className="divide-y divide-border overflow-y-auto">
              {tickets.map(t => {
                const cat = CATEGORIES.find(c => c.id === t.category) || CATEGORIES[3];
                const Icon = cat.icon;
                return (
                  <li key={t.id}>
                    <button onClick={() => setActive(t.id)}
                      className={`w-full text-left p-3 hover:bg-muted/50 transition-colors ${active === t.id ? "bg-primary/10" : ""}`}>
                      <div className="flex items-start gap-2.5">
                        <Icon size={14} className={`${cat.color} mt-0.5 flex-shrink-0`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold truncate">{t.subject}</span>
                            <Badge variant={t.status === "open" ? "default" : t.status === "pending" ? "secondary" : "outline"} className="text-[10px] capitalize">
                              {t.status}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5 capitalize">{cat.label} · {t.lastMessageAt?.toDate?.()?.toLocaleDateString?.() ?? ""}</p>
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
              {tickets.length === 0 && (
                <li className="p-8 text-center">
                  <MessageCircle size={28} className="mx-auto text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">No tickets yet</p>
                  <button onClick={() => setNewOpen(true)} className="text-xs text-primary font-bold mt-2 hover:underline">
                    Open your first ticket
                  </button>
                </li>
              )}
            </ul>
          </Card>

          {/* Conversation */}
          <Card className="flex flex-col min-h-[60vh]">
            {!active || !activeTicket ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                <MessageCircle size={40} className="text-muted-foreground/30 mb-3" />
                <p className="text-sm font-semibold text-muted-foreground">Select a ticket to view the conversation</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Or open a new one to get help.</p>
              </div>
            ) : (
              <>
                <div className="p-4 border-b border-border">
                  <h2 className="font-bold">{activeTicket.subject}</h2>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <Badge variant="outline" className="capitalize">{activeTicket.category || "other"}</Badge>
                    <span>·</span>
                    <span>Opened {activeTicket.createdAt?.toDate?.()?.toLocaleDateString?.() ?? ""}</span>
                  </div>
                </div>
                <div ref={scrollRef} className="flex-1 p-4 space-y-3 overflow-y-auto max-h-[55vh]">
                  {msgs.map(m => (
                    <div key={m.id} className={`flex ${m.authorRole === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                        m.authorRole === "user"
                          ? "bg-primary text-primary-foreground rounded-br-md"
                          : "bg-muted rounded-bl-md"
                      }`}>
                        {m.attachmentURL && (
                          <a href={m.attachmentURL} target="_blank" rel="noreferrer">
                            <img src={m.attachmentURL} alt="" className="rounded-lg mb-2 max-h-48 object-cover" />
                          </a>
                        )}
                        {m.body && <div className="whitespace-pre-wrap">{m.body}</div>}
                        <div className="text-[10px] opacity-70 mt-1">
                          {m.createdAt?.toDate?.()?.toLocaleString?.() ?? "sending…"}
                        </div>
                      </div>
                    </div>
                  ))}
                  {msgs.length === 0 && (
                    <p className="text-center text-xs text-muted-foreground py-8">No messages yet.</p>
                  )}
                </div>
                {activeTicket.status !== "closed" ? (
                  <div className="p-3 border-t border-border space-y-2">
                    <Textarea value={reply} onChange={e => setReply(e.target.value)}
                      placeholder="Type your reply…" rows={2}
                      onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send(); }}
                      className="resize-none" />
                    <div className="flex items-center justify-between gap-2">
                      <button onClick={() => replyFileRef.current?.click()}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-xs text-muted-foreground">
                        <Paperclip size={13} /> Attach
                      </button>
                      <input ref={replyFileRef} type="file" accept="image/*" className="hidden" />
                      <Button onClick={send} disabled={sending} size="sm" className="gap-1.5">
                        {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                        Send
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 border-t border-border text-center text-xs text-muted-foreground">
                    This ticket is closed. Open a new one if you need more help.
                  </div>
                )}
              </>
            )}
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}

function NewTicketDialog({ open, onOpenChange, onCreated }: {
  open: boolean; onOpenChange: (o: boolean) => void; onCreated: (id: string) => void;
}) {
  const { user } = useAuth();
  const [category, setCategory] = useState<Category>("bug");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!user || !subject.trim() || !body.trim()) {
      toast.error("Subject and message are required");
      return;
    }
    setBusy(true);
    try {
      const ticketRef = await addDoc(collection(db, "supportTickets"), {
        userId: user.uid, userEmail: user.email ?? null,
        subject: subject.trim(), status: "open", category,
        createdAt: serverTimestamp(), lastMessageAt: serverTimestamp(),
      });
      let attachmentURL: string | null = null;
      const file = fileRef.current?.files?.[0];
      if (file) {
        try {
          const path = `users/${user.uid}/support/${ticketRef.id}/${Date.now()}_${file.name}`;
          const r = storageRef(storage, path);
          await uploadBytes(r, file, { contentType: file.type || "image/jpeg" });
          attachmentURL = await getDownloadURL(r);
        } catch { /* ignore */ }
      }
      await addDoc(collection(db, "supportTickets", ticketRef.id, "messages"), {
        authorId: user.uid, authorRole: "user", body: body.trim(),
        ...(attachmentURL ? { attachmentURL } : {}),
        createdAt: serverTimestamp(),
      });
      logActivity("support.ticket.open", { ticketId: ticketRef.id, category });
      toast.success("Ticket opened — we'll reply soon");
      onCreated(ticketRef.id);
      onOpenChange(false);
      setSubject(""); setBody(""); setCategory("bug");
      if (fileRef.current) fileRef.current.value = "";
    } catch (e: any) {
      toast.error(e?.message || "Failed to open ticket");
    } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button className="gap-2"><Plus size={15} /> New Ticket</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Open a new ticket</DialogTitle>
          <DialogDescription>Help us help you — pick a category and give us the details.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Category</label>
            <div className="grid grid-cols-4 gap-2">
              {CATEGORIES.map(c => {
                const Icon = c.icon;
                const active = category === c.id;
                return (
                  <button key={c.id} onClick={() => setCategory(c.id)}
                    className={`flex flex-col items-center gap-1 py-3 rounded-xl text-xs font-semibold border transition-all ${
                      active ? "gradient-bg text-primary-foreground border-transparent" : "bg-secondary border-border text-muted-foreground hover:text-foreground"
                    }`}>
                    <Icon size={16} />
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Subject</label>
            <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Short summary" />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Details</label>
            <Textarea value={body} onChange={e => setBody(e.target.value)} rows={5}
              placeholder="Describe what happened, what you expected, and steps to reproduce." />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Screenshot (optional)</label>
            <input ref={fileRef} type="file" accept="image/*" className="text-xs file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-secondary file:text-foreground file:font-semibold" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy} className="gap-1.5">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Submit ticket
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
