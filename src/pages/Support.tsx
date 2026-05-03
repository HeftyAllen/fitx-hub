import { useEffect, useState } from "react";
import {
  addDoc, collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/layout/Navbar";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { logActivity } from "@/lib/activity";
import { toast } from "sonner";

interface Ticket { id: string; subject: string; status: string; createdAt?: any; }
interface Message { id: string; authorRole: "user" | "admin"; body: string; createdAt?: any; }

export default function Support() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [reply, setReply] = useState("");

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
      (snap) => setMsgs(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))),
    );
    return unsub;
  }, [active]);

  async function open() {
    if (!user || !subject.trim() || !body.trim()) return;
    try {
      const ref = await addDoc(collection(db, "supportTickets"), {
        userId: user.uid, userEmail: user.email ?? null,
        subject: subject.trim(), status: "open",
        createdAt: serverTimestamp(), lastMessageAt: serverTimestamp(),
      });
      await addDoc(collection(db, "supportTickets", ref.id, "messages"), {
        authorId: user.uid, authorRole: "user", body: body.trim(), createdAt: serverTimestamp(),
      });
      logActivity("support.ticket.open", { ticketId: ref.id });
      setSubject(""); setBody(""); setActive(ref.id);
      toast.success("Ticket opened");
    } catch (e: any) { toast.error(e.message); }
  }

  async function send() {
    if (!user || !active || !reply.trim()) return;
    await addDoc(collection(db, "supportTickets", active, "messages"), {
      authorId: user.uid, authorRole: "user", body: reply.trim(), createdAt: serverTimestamp(),
    });
    await updateDoc(doc(db, "supportTickets", active), { lastMessageAt: serverTimestamp(), status: "open" });
    setReply("");
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-20 md:pt-24 pb-24 px-4 md:px-8 max-w-5xl mx-auto space-y-6">
        <header>
          <h1 className="text-3xl font-bold">Support</h1>
          <p className="text-sm text-muted-foreground">Open a ticket and we'll reply in-app.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4">
          <div className="space-y-4">
            <Card className="p-4 space-y-2">
              <h2 className="font-semibold text-sm">New ticket</h2>
              <Input placeholder="Subject" value={subject} onChange={e => setSubject(e.target.value)} />
              <Textarea placeholder="Describe your issue" value={body} onChange={e => setBody(e.target.value)} rows={4} />
              <Button onClick={open} className="w-full">Open ticket</Button>
            </Card>

            <Card className="overflow-hidden">
              <div className="p-3 border-b border-border text-xs uppercase tracking-wider text-muted-foreground">My tickets</div>
              <ul className="divide-y divide-border max-h-96 overflow-y-auto">
                {tickets.map(t => (
                  <li key={t.id}>
                    <button onClick={() => setActive(t.id)}
                      className={`w-full text-left p-3 hover:bg-muted/50 ${active === t.id ? "bg-primary/10" : ""}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-sm truncate">{t.subject}</span>
                        <Badge variant="outline">{t.status}</Badge>
                      </div>
                    </button>
                  </li>
                ))}
                {tickets.length === 0 && <li className="p-4 text-sm text-muted-foreground text-center">None yet.</li>}
              </ul>
            </Card>
          </div>

          <Card className="flex flex-col min-h-[60vh]">
            {!active ? (
              <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">Select a ticket</div>
            ) : (
              <>
                <div className="flex-1 p-4 space-y-3 overflow-y-auto">
                  {msgs.map(m => (
                    <div key={m.id} className={`flex ${m.authorRole === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                        m.authorRole === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                      }`}>
                        <div>{m.body}</div>
                        <div className="text-[10px] opacity-70 mt-1">{m.createdAt?.toDate?.()?.toLocaleString?.() ?? "sending…"}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-3 border-t border-border flex gap-2">
                  <Textarea value={reply} onChange={e => setReply(e.target.value)} placeholder="Reply…" rows={2} className="flex-1 resize-none" />
                  <Button onClick={send}>Send</Button>
                </div>
              </>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
}
