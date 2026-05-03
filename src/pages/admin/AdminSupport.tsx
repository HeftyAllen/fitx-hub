import { useEffect, useMemo, useState } from "react";
import {
  addDoc, collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { logActivity } from "@/lib/activity";
import { toast } from "sonner";

interface Ticket {
  id: string;
  userId: string;
  userEmail?: string;
  subject: string;
  status: "open" | "pending" | "closed";
  createdAt?: any;
  lastMessageAt?: any;
}

interface Message {
  id: string;
  authorId: string;
  authorRole: "user" | "admin";
  body: string;
  createdAt?: any;
}

export default function AdminSupport() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState("");

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "supportTickets"), orderBy("createdAt", "desc")),
      (snap) => setTickets(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })))
    );
    return unsub;
  }, []);

  useEffect(() => {
    if (!activeId) { setMessages([]); return; }
    const unsub = onSnapshot(
      query(collection(db, "supportTickets", activeId, "messages"), orderBy("createdAt", "asc")),
      (snap) => setMessages(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })))
    );
    return unsub;
  }, [activeId]);

  const active = useMemo(() => tickets.find(t => t.id === activeId) ?? null, [tickets, activeId]);

  async function send() {
    if (!reply.trim() || !activeId || !user) return;
    try {
      await addDoc(collection(db, "supportTickets", activeId, "messages"), {
        authorId: user.uid,
        authorRole: "admin",
        body: reply.trim(),
        createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, "supportTickets", activeId), {
        lastMessageAt: serverTimestamp(),
        status: "pending",
      });
      logActivity("support.ticket.reply", { ticketId: activeId });
      setReply("");
    } catch (e: any) { toast.error(e.message); }
  }

  async function setStatus(s: Ticket["status"]) {
    if (!activeId) return;
    await updateDoc(doc(db, "supportTickets", activeId), { status: s });
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold">Support</h1>
        <p className="text-sm text-muted-foreground">{tickets.length} tickets</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4">
        <Card className="overflow-hidden">
          <div className="p-3 border-b border-border text-xs uppercase tracking-wider text-muted-foreground">Inbox</div>
          <ul className="divide-y divide-border max-h-[60vh] overflow-y-auto">
            {tickets.map(t => (
              <li key={t.id}>
                <button
                  onClick={() => setActiveId(t.id)}
                  className={`w-full text-left p-3 hover:bg-muted/50 ${activeId === t.id ? "bg-primary/10" : ""}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm truncate">{t.subject}</span>
                    <Badge variant={t.status === "open" ? "destructive" : t.status === "pending" ? "secondary" : "outline"}>
                      {t.status}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{t.userEmail ?? t.userId.slice(0, 8)}</div>
                </button>
              </li>
            ))}
            {tickets.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">Inbox empty.</li>}
          </ul>
        </Card>

        <Card className="flex flex-col min-h-[60vh]">
          {!active ? (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">Select a ticket</div>
          ) : (
            <>
              <div className="p-4 border-b border-border flex items-center justify-between">
                <div>
                  <div className="font-semibold">{active.subject}</div>
                  <div className="text-xs text-muted-foreground">{active.userEmail ?? active.userId}</div>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => setStatus("open")}>Open</Button>
                  <Button size="sm" variant="outline" onClick={() => setStatus("pending")}>Pending</Button>
                  <Button size="sm" variant="outline" onClick={() => setStatus("closed")}>Close</Button>
                </div>
              </div>
              <div className="flex-1 p-4 space-y-3 overflow-y-auto">
                {messages.map(m => (
                  <div key={m.id} className={`flex ${m.authorRole === "admin" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                      m.authorRole === "admin" ? "bg-primary text-primary-foreground" : "bg-muted"
                    }`}>
                      <div>{m.body}</div>
                      <div className="text-[10px] opacity-70 mt-1">
                        {m.createdAt?.toDate?.()?.toLocaleString?.() ?? "sending…"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-3 border-t border-border flex gap-2">
                <Textarea
                  value={reply}
                  onChange={e => setReply(e.target.value)}
                  placeholder="Reply…"
                  rows={2}
                  className="flex-1 resize-none"
                />
                <Button onClick={send}>Send</Button>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
