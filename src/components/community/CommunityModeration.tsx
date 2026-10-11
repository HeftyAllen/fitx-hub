import { useEffect, useState } from "react";
import { doc, onSnapshot, serverTimestamp, writeBatch } from "firebase/firestore";
import { Flag, CheckCircle2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useOnline } from "@/hooks/useOnline";
import type { CommunityGroup, CommunityMessage, CommunityReport } from "@/lib/community";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

function ReportCard({ group, report }: { group: CommunityGroup; report: CommunityReport }) {
  const { user } = useAuth();
  const online = useOnline();
  const [message, setMessage] = useState<CommunityMessage | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => onSnapshot(doc(db, "communityGroups", group.id, "messages", report.messageId), snap => { setMessage(snap.exists() ? { ...snap.data(), id: snap.id } as CommunityMessage : null); setLoaded(true); }, () => setLoaded(false)), [group.id, report.messageId]);
  async function resolve(remove: boolean) {
    if (!user || !online || busy || (remove && (!loaded || !message))) return;
    setBusy(true);
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, "communityGroups", group.id, "reports", report.id), { status: "resolved", resolvedBy: user.uid, resolvedAt: serverTimestamp() });
      if (remove && message?.status !== "removed") batch.update(doc(db, "communityGroups", group.id, "messages", report.messageId), { status: "removed", text: "", reactions: {}, removedAt: serverTimestamp(), removedBy: user.uid });
      await batch.commit(); toast.success("Report resolved.");
    } catch { toast.error("This report could not be resolved. Check your moderation access."); } finally { setBusy(false); }
  }
  return <article className="community-activity-card"><p className="text-xs font-semibold flex items-center gap-2"><Flag size={14} />{report.reason}</p>{message && <p className="text-xs text-muted-foreground mt-3">Message from {message.senderName}</p>}<p className="text-sm whitespace-pre-wrap break-words my-3">{!loaded ? "Loading the reported message…" : !message ? "The message no longer exists." : message.status === "removed" ? "Message already removed." : message.text}</p><div className="community-card-actions"><Button size="sm" variant="outline" disabled={!online || busy} onClick={() => void resolve(false)}>Resolve report</Button>{message?.status !== "removed" && <Button size="sm" variant="destructive" disabled={!online || busy || !loaded || !message} onClick={() => void resolve(true)}>Remove message & resolve</Button>}</div></article>;
}
export default function CommunityModeration({ group, reports }: { group: CommunityGroup; reports: CommunityReport[]; messages: CommunityMessage[] }) {
  const open = reports.filter(report => report.status === "open");
  return <section className="community-panel"><h3 className="text-lg font-semibold">A welcoming space, together.</h3><p className="text-xs text-muted-foreground mt-2">Reports are private to administrators and moderators.</p><div className="space-y-3 mt-5">{open.map(report => <ReportCard key={report.id} group={group} report={report} />)}{!open.length && <p className="community-info"><CheckCircle2 size={16} className="inline mr-2" />No open reports in this group.</p>}</div></section>;
}
