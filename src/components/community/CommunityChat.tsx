import { useEffect, useRef, useState } from "react";
import { addDoc, collection, deleteField, doc, documentId, FieldPath, limit, onSnapshot, orderBy, query, serverTimestamp, startAfter, Timestamp, updateDoc, writeBatch } from "firebase/firestore";
import { ArrowDown, Check, CheckCheck, Clock3, CornerUpLeft, Flag, Loader2, MoreHorizontal, Send, Smile, Trash2, Video, X } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useAdmin } from "@/hooks/useAdmin";
import { useOnline } from "@/hooks/useOnline";
import { CHAT_EMOJIS, COMMUNITY_EMOJIS, timestampMillis, type CommunityGroup, type CommunityMember, type CommunityMessage } from "@/lib/community";
import { markCommunityRead } from "@/lib/community-actions";
import { memberGreetingName } from "@/lib/member-identity";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function CommunityChat({ group, messages, members, loading, cached, moderator, onClass }: { group: CommunityGroup; messages: CommunityMessage[]; members: CommunityMember[]; loading: boolean; cached: boolean; moderator: boolean; onClass: () => void }) {
  const { user, userProfile } = useAuth();
  const { role } = useAdmin();
  const online = useOnline();
  const uid = user?.uid || "";
  const draftKey = `fitx-chat-draft:v1:${uid}:${group.id}`;
  const [text, setText] = useState(() => { try { return sessionStorage.getItem(draftKey) || ""; } catch { return ""; } });
  const [reply, setReply] = useState<CommunityMessage | null>(null);
  const [sending, setSending] = useState(false);
  const [older, setOlder] = useState<CommunityMessage[]>([]);
  const [paging, setPaging] = useState(false);
  const [historyDone, setHistoryDone] = useState(false);
  const [newMessages, setNewMessages] = useState(false);
  const [now, setNow] = useState(Date.now);
  const [editing, setEditing] = useState<CommunityMessage | null>(null);
  const [messageMenu, setMessageMenu] = useState<string | null>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const nearBottom = useRef(true);
  const lastRead = useRef("");
  const lastTyping = useRef(0);
  const historyListeners = useRef<(() => void)[]>([]);
  const ownMember = members.find(member => member.id === uid);
  const active = group.status === "active";
  const canModerate = moderator || (role === "coach" && group.coachId === uid);
  const allMessages = [...new Map([...older, ...messages].map(message => [message.id, message])).values()].sort((a, b) => timestampMillis(a.createdAt) - timestampMillis(b.createdAt) || a.id.localeCompare(b.id));
  const latestId = allMessages[allMessages.length - 1]?.id || "";
  const byId = new Map(allMessages.map(message => [message.id, message]));
  const typing = members.filter(member => member.id !== uid && timestampMillis(member.typingUntil) > now);
  const persistDraft = (value: string) => { setText(value); try { if (value) sessionStorage.setItem(draftKey, value); else sessionStorage.removeItem(draftKey); } catch { /* optional draft cache */ } };
  const markRead = () => {
    if (!online || !active || !ownMember || !latestId || lastRead.current === latestId || document.visibilityState !== "visible" || !nearBottom.current) return;
    lastRead.current = latestId;
    void markCommunityRead(db, group.id, uid).catch(() => { lastRead.current = ""; });
  };
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => () => historyListeners.current.forEach(stop => stop()), []);
  useEffect(() => {
    if (nearBottom.current && scroll.current) { scroll.current.scrollTop = scroll.current.scrollHeight; setNewMessages(false); } else if (latestId) setNewMessages(true);
    markRead();
    // Presence changes do not create another read-receipt write for the same message.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestId, online, ownMember?.id]);
  useEffect(() => {
    const visible = () => markRead();
    document.addEventListener("visibilitychange", visible);
    return () => document.removeEventListener("visibilitychange", visible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestId, online, ownMember?.id]);
  function changeText(value: string) {
    persistDraft(value);
    if (online && active && ownMember && Date.now() - lastTyping.current > 4000) {
      lastTyping.current = Date.now();
      void updateDoc(doc(db, "communityGroups", group.id, "members", uid), { typingUntil: Timestamp.fromMillis(Date.now() + (value.trim() ? 7000 : 0)) }).catch(() => {});
    }
  }
  async function send(event?: React.FormEvent) {
    event?.preventDefault();
    if (!uid || !text.trim() || !online || !active || sending) return;
    setSending(true);
    try {
      if (editing) await updateDoc(doc(db, "communityGroups", group.id, "messages", editing.id), { text: text.trim(), editedAt: serverTimestamp() });
      else {
        const senderRole = role === "admin" ? "admin" : moderator ? "moderator" : role === "coach" && group.coachId === uid ? "coach" : "member";
        const batch = writeBatch(db);
        batch.set(doc(collection(db, "communityGroups", group.id, "messages")), { senderId: uid, senderName: ownMember?.name || memberGreetingName(userProfile, user?.displayName) || "Team member", senderRole, text: text.trim(), replyTo: reply?.id || "", reactions: {}, status: "visible", createdAt: serverTimestamp() });
        batch.update(doc(db, "communityGroups", group.id), { lastMessageAt: serverTimestamp() });
        await batch.commit();
      }
      persistDraft(""); setReply(null); setEditing(null); nearBottom.current = true;
      if (ownMember) void updateDoc(doc(db, "communityGroups", group.id, "members", uid), { typingUntil: Timestamp.fromMillis(Date.now()) }).catch(() => {});
      input.current?.focus();
    } catch { toast.error("Your message could not sync. Your draft is kept; check your connection and group access."); }
    finally { setSending(false); }
  }
  async function react(message: CommunityMessage, emoji: string) {
    if (!online || !active) return;
    try { await updateDoc(doc(db, "communityGroups", group.id, "messages", message.id), new FieldPath("reactions", uid), message.reactions?.[uid] === emoji ? deleteField() : emoji); }
    catch { toast.error("That reaction could not sync."); }
  }
  async function remove(message: CommunityMessage) {
    try { await updateDoc(doc(db, "communityGroups", group.id, "messages", message.id), { status: "removed", text: "", reactions: {}, removedAt: serverTimestamp(), removedBy: uid }); }
    catch { toast.error("This message could not be removed."); }
  }
  async function report(message: CommunityMessage) {
    try { await addDoc(collection(db, "communityGroups", group.id, "reports"), { messageId: message.id, reporterId: uid, reason: "Please review this message.", status: "open", createdAt: serverTimestamp() }); toast.success("Reported privately to the moderation team."); }
    catch { toast.error("The report could not be sent."); }
  }
  async function loadEarlier() {
    const first = allMessages[0];
    if (!first || paging) return;
    setPaging(true);
    const previousHeight = scroll.current?.scrollHeight || 0;
    try {
      await new Promise<void>((resolve, reject) => {
        let previousIds = new Set<string>();
        let initial = true;
        const stop = onSnapshot(query(collection(db, "communityGroups", group.id, "messages"), orderBy("createdAt", "desc"), orderBy(documentId(), "desc"), startAfter(first.createdAt, first.id), limit(60)), snap => {
          const prior = previousIds;
          const rows = snap.docs.map(item => ({ ...item.data(), id: item.id, pending: item.metadata.hasPendingWrites } as CommunityMessage));
          previousIds = new Set(rows.map(item => item.id));
          setOlder(previous => [...previous.filter(item => !prior.has(item.id)), ...rows]);
          if (initial) { initial = false; setHistoryDone(snap.size < 60); resolve(); }
        }, error => { reject(error); stop(); });
        historyListeners.current.push(stop);
      });
      requestAnimationFrame(() => { if (scroll.current) scroll.current.scrollTop += scroll.current.scrollHeight - previousHeight; });
    } catch { toast.error("Earlier messages could not load."); } finally { setPaging(false); }
  }
  function jumpToLatest() { nearBottom.current = true; if (scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight; setNewMessages(false); markRead(); }
  return <div className="community-chat">
    <div className="community-chat-toolbar"><p><span className="community-status-dot" />{!online ? "Offline · your draft stays on this device" : cached ? "Connecting to live conversation…" : "Connected to your group"}</p><button className="community-toolbar-button" onClick={onClass}><Video size={15} />Classes</button></div>
    <div ref={scroll} className="community-message-scroll" role="log" aria-label="Group conversation" aria-live="polite" aria-relevant="additions text" onScroll={() => { const node = scroll.current; nearBottom.current = !!node && node.scrollHeight - node.scrollTop - node.clientHeight < 90; if (nearBottom.current) { setNewMessages(false); markRead(); } }}>
      {!historyDone && messages.length >= 80 && <button className="community-history-button" disabled={paging} onClick={() => void loadEarlier()}>{paging ? "Loading…" : "Load earlier messages"}</button>}
      {loading && <p role="status" className="community-chat-empty">Loading the conversation…</p>}
      {!loading && !allMessages.length && <div className="community-chat-empty"><span>👋</span><h3>Start something good.</h3><p>Say hello, ask a question or celebrate today’s small win.</p></div>}
      {allMessages.map((message, index) => {
        const mine = message.senderId === uid;
        const removed = message.status === "removed";
        const created = timestampMillis(message.createdAt);
        const date = created ? new Date(created) : null;
        const priorDate = index ? timestampMillis(allMessages[index - 1].createdAt) : 0;
        const showDate = !priorDate || (date && date.toDateString() !== new Date(priorDate).toDateString());
        const quote = byId.get(message.replyTo);
        const seen = members.filter(member => member.id !== uid && timestampMillis(member.lastReadAt) >= created && created > 0).length;
        const reactions = new Map<string, number>();
        Object.values(message.reactions || {}).forEach(emoji => reactions.set(emoji, (reactions.get(emoji) || 0) + 1));
        const canEdit = mine && !removed && created > Date.now() - 15 * 60 * 1000;
        return <div key={message.id}>
          {showDate && <p className="community-day-divider">{date ? date.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }) : "Today"}</p>}
          <div className={`community-message-row ${mine ? "is-own" : ""}`}><article className={`community-message-bubble ${mine ? "is-own" : ""} ${removed ? "is-removed" : ""}`} aria-label={`Message from ${message.senderName}`}>
            {!mine && <p className="community-message-author">{message.senderName}{message.senderRole !== "member" && <span>{message.senderRole}</span>}</p>}
            {message.replyTo && !removed && <button className="community-message-quote" onClick={() => document.getElementById(`community-message-${message.replyTo}`)?.scrollIntoView({ block: "nearest" })}><strong>{quote?.senderName || "Earlier message"}</strong><span>{quote?.status === "removed" ? "Message removed" : quote?.text || "Reply in this conversation"}</span></button>}
            <p id={`community-message-${message.id}`} className="community-message-text">{removed ? "This message was removed." : message.text}</p>
            <div className="community-message-meta">{"editedAt" in message && <span>edited</span>}<time>{date?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) || "Sending"}</time>{mine && !removed && <span className={seen ? "is-read" : ""} aria-label={message.pending ? "Sending message" : seen ? `Read by ${seen} participant${seen === 1 ? "" : "s"}` : "Message sent"}>{message.pending ? <Clock3 size={13} /> : seen ? <CheckCheck size={15} /> : <Check size={14} />}</span>}</div>
            {!!reactions.size && !removed && <div className="community-message-reactions">{[...reactions].map(([emoji, count]) => <button key={emoji} className={message.reactions?.[uid] === emoji ? "is-selected" : ""} disabled={!online || !active} aria-label={`React ${emoji} to message from ${message.senderName}`} onClick={() => void react(message, emoji)}>{emoji}<span>{count}</span></button>)}</div>}
          </article>
          {!removed && <Popover open={messageMenu === message.id} onOpenChange={open => setMessageMenu(open ? message.id : null)}><PopoverTrigger asChild><button className="community-message-menu" aria-label={`Actions for message from ${message.senderName}`}><MoreHorizontal size={16} /></button></PopoverTrigger><PopoverContent className="community-message-actions w-64" align={mine ? "end" : "start"}>
            <div className="community-reaction-picker">{COMMUNITY_EMOJIS.map(emoji => <button key={emoji} disabled={!online || !active} aria-label={`React ${emoji}`} onClick={() => { void react(message, emoji); setMessageMenu(null); }}>{emoji}</button>)}</div>
            <button onClick={() => { setMessageMenu(null); setReply(message); setEditing(null); input.current?.focus(); }}><CornerUpLeft size={15} />Reply</button>
            {canEdit && <button disabled={!online || !active} onClick={() => { setMessageMenu(null); setEditing(message); setReply(null); persistDraft(message.text); input.current?.focus(); }}>Edit message</button>}
            {(mine || canModerate) && <button className="text-destructive" disabled={!online} onClick={() => { setMessageMenu(null); void remove(message); }}><Trash2 size={15} />{mine ? "Delete message" : "Remove message"}</button>}
            {!mine && <button disabled={!online || !active} onClick={() => { setMessageMenu(null); void report(message); }}><Flag size={15} />Report privately</button>}
          </PopoverContent></Popover>}
          </div>
        </div>;
      })}
    </div>
    {newMessages && <button className="community-jump-button" onClick={jumpToLatest}><ArrowDown size={15} />New messages</button>}
    <div className="community-typing-line" role="status">{typing.length ? `${typing.slice(0, 2).map(member => member.name.split(" ")[0]).join(" and ")}${typing.length > 2 ? " and others" : ""} ${typing.length === 1 ? "is" : "are"} typing…` : active ? "Encouragement belongs here." : "This group is archived. Its conversation is kept for the team."}</div>
    <form onSubmit={event => void send(event)} className="community-composer">
      {(reply || editing) && <div className="community-composer-reply"><CornerUpLeft size={17} /><div className="min-w-0 flex-1"><strong>{editing ? "Editing your message" : `Replying to ${reply?.senderName}`}</strong><p>{editing?.text || reply?.text}</p></div><button type="button" className="community-icon-button" aria-label="Cancel reply or edit" onClick={() => { setReply(null); if (editing) persistDraft(""); setEditing(null); }}><X size={15} /></button></div>}
      <div className="community-composer-row"><Popover><PopoverTrigger asChild><button type="button" className="community-icon-button" aria-label="Choose an emoji" disabled={!active}><Smile size={21} /></button></PopoverTrigger><PopoverContent className="community-emoji-picker w-64" align="start">{CHAT_EMOJIS.map(emoji => <button type="button" key={emoji} aria-label={`Insert ${emoji}`} onClick={() => { const caret = input.current?.selectionStart ?? text.length; changeText(text.slice(0, caret) + emoji + text.slice(caret)); input.current?.focus(); }}>{emoji}</button>)}</PopoverContent></Popover>
        <textarea ref={input} aria-label="Message your group" value={text} maxLength={3000} rows={2} placeholder={active ? "Message your group…" : "Group archived"} disabled={!active} onChange={event => changeText(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); } }} />
        <Button type="submit" className="community-send-button" aria-label={editing ? "Save edited message" : "Send message"} disabled={!online || !active || !text.trim() || sending}>{sending ? <Loader2 size={19} className="animate-spin" /> : <Send size={19} />}</Button>
      </div>
    </form>
  </div>;
}
