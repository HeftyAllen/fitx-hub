import { useEffect, useState } from "react";
import { collection, doc, documentId, limit, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { parseActivity, parseGroup, type ActivityResponse, type CommunityActivity, type CommunityGroup, type CommunityMember, type CommunityMessage, type CommunityReport } from "@/lib/community";
import type { AdminRole } from "@/lib/permissions";

export function useCommunityGroups(uid: string | undefined, role: AdminRole | null, team: boolean) {
  const [groups, setGroups] = useState<CommunityGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    setGroups([]); setLoading(true); setError("");
    if (!uid) { setLoading(false); return; }
    if (team) return onSnapshot(query(collection(db, "communityGroups"), ...(role === "coach" ? [where("coachId", "==", uid)] : []), limit(50)), snap => {
      setGroups(snap.docs.flatMap(item => { const group = parseGroup(item.id, item.data()); return group ? [group] : []; })); setLoading(false); setError("");
    }, () => { setGroups([]); setLoading(false); setError("Groups could not load. Check your connection and publish the latest Firebase rules."); });
    const listeners = new Map<string, () => void>();
    const memberListeners = new Map<string, () => void>();
    const values = new Map<string, CommunityGroup>();
    let membershipIds = new Set<string>();
    let assignmentKey: string | undefined;
    const listenToGroup = (id: string) => {
      if (listeners.has(id)) return;
      listeners.set(id, onSnapshot(doc(db, "communityGroups", id), { includeMetadataChanges: true }, snap => {
        // A permission error terminates a Firestore listener. On reconnection,
        // wait for server confirmation before restoring a cached private group.
        if (navigator.onLine && snap.metadata.fromCache) return;
        const group = snap.exists() ? parseGroup(id, snap.data()) : null;
        if (group?.status === "active") values.set(id, group); else values.delete(id);
        setGroups([...values.values()]); setLoading(false); setError("");
      }, () => { listeners.delete(id); values.delete(id); setGroups([...values.values()]); setLoading(false); }));
    };
    // Restoring an assignment must restart listeners that lost permission even
    // when its member's group index did not change during archival.
    const stopAssignments = onSnapshot(query(collection(db, "coachAssignments"), where("memberId", "==", uid), where("status", "==", "active")), snapshot => {
      const nextKey = snapshot.docs.map(item => `${item.id}:${item.data().coachId}`).sort().join("|");
      if (assignmentKey !== undefined && nextKey !== assignmentKey) {
        listeners.forEach(unsubscribe => unsubscribe()); listeners.clear(); values.clear(); setGroups([]);
        membershipIds.forEach(listenToGroup);
      }
      assignmentKey = nextKey;
    }, () => { /* The group rules still enforce assignment access. */ });
    const stop = onSnapshot(query(collection(db, "communityMemberships", uid, "groups"), where("status", "==", "active"), limit(50)), snapshot => {
      const ids = new Set(snapshot.docs.map(item => item.id));
      membershipIds = ids;
      for (const [id, unsubscribe] of listeners) if (!ids.has(id)) { unsubscribe(); listeners.delete(id); values.delete(id); }
      for (const [id, unsubscribe] of memberListeners) if (!ids.has(id)) { unsubscribe(); memberListeners.delete(id); }
      for (const id of values.keys()) if (!ids.has(id)) values.delete(id);
      for (const id of ids) if (!memberListeners.has(id)) memberListeners.set(id, onSnapshot(doc(db, "communityGroups", id, "members", uid), { includeMetadataChanges: true }, snap => {
        if (navigator.onLine && snap.metadata.fromCache) return;
        if (snap.exists() && snap.data().status === "active") listenToGroup(id);
        else { listeners.get(id)?.(); listeners.delete(id); values.delete(id); setGroups([...values.values()]); setLoading(false); }
      }, () => { listeners.get(id)?.(); listeners.delete(id); values.delete(id); setGroups([...values.values()]); setLoading(false); }));
      setGroups([...values.values()]); if (!ids.size) setLoading(false);
    }, () => { setGroups([]); setLoading(false); setError("Your groups could not load. Reconnect and check Community access."); });
    return () => { stop(); stopAssignments(); listeners.forEach(unsubscribe => unsubscribe()); memberListeners.forEach(unsubscribe => unsubscribe()); };
  }, [uid, role, team]);
  return { groups, loading, error };
}

export function useCommunityRoom(groupId: string, moderator: boolean) {
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [messages, setMessages] = useState<CommunityMessage[]>([]);
  const [activities, setActivities] = useState<CommunityActivity[]>([]);
  const [responses, setResponses] = useState<ActivityResponse[]>([]);
  const [reports, setReports] = useState<CommunityReport[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [cached, setCached] = useState(false);
  useEffect(() => {
    setMembers([]); setMessages([]); setActivities([]); setResponses([]); setReports([]); setErrors({}); setLoading(true);
    const ok = (key: string) => setErrors(previous => { const next = { ...previous }; delete next[key]; return next; });
    const fail = (key: string) => setErrors(previous => ({ ...previous, [key]: `${key} could not sync. Reconnect or check your group access.` }));
    const stops = [
      onSnapshot(collection(db, "communityGroups", groupId, "members"), snap => { setMembers(snap.docs.map(item => ({ ...item.data(), id: item.id } as CommunityMember))); ok("Members"); }, () => { setMembers([]); fail("Members"); }),
      onSnapshot(query(collection(db, "communityGroups", groupId, "messages"), orderBy("createdAt", "desc"), orderBy(documentId(), "desc"), limit(80)), { includeMetadataChanges: true }, snap => {
        setMessages(snap.docs.map(item => ({ ...item.data({ serverTimestamps: "estimate" }), id: item.id, pending: item.metadata.hasPendingWrites } as CommunityMessage)).reverse()); setLoading(false); setCached(snap.metadata.fromCache); ok("Conversation");
      }, () => { setMessages([]); setLoading(false); fail("Conversation"); }),
      onSnapshot(query(collection(db, "communityGroups", groupId, "activities"), orderBy("createdAt", "desc"), limit(60)), snap => { setActivities(snap.docs.flatMap(item => { const activity = parseActivity(item.id, item.data()); return activity ? [activity] : []; })); ok("Activities"); }, () => { setActivities([]); fail("Activities"); }),
      onSnapshot(collection(db, "communityGroups", groupId, "responses"), snap => { setResponses(snap.docs.map(item => ({ ...item.data(), id: item.id } as ActivityResponse))); ok("Responses"); }, () => { setResponses([]); fail("Responses"); }),
    ];
    if (moderator) stops.push(onSnapshot(query(collection(db, "communityGroups", groupId, "reports"), orderBy("createdAt", "desc"), limit(50)), snap => { setReports(snap.docs.map(item => ({ ...item.data(), id: item.id } as CommunityReport))); ok("Reports"); }, () => { setReports([]); fail("Reports"); }));
    return () => stops.forEach(stop => stop());
  }, [groupId, moderator]);
  return { members, messages, activities, responses, reports, loading, cached, error: Object.values(errors).join(" ") };
}
