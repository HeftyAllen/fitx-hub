import { collection, doc, serverTimestamp, setDoc, writeBatch, type Firestore } from "firebase/firestore";
import type { CoachAssignment } from "./coaching";
import type { CommunityGroup, CommunityMember } from "./community";

export async function createCommunityGroup(db: Firestore, creatorId: string, coachName: string, input: { name: string; description: string; tone: string; coachId: string }, clients: CoachAssignment[]) {
  const reference = doc(collection(db, "communityGroups"));
  const batch = writeBatch(db);
  batch.set(reference, { ...input, createdBy: creatorId, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), status: "active" });
  const host = { uid: input.coachId, name: coachName, role: "coach", assignmentId: "", status: "active", joinedAt: serverTimestamp() };
  batch.set(doc(db, "communityGroups", reference.id, "members", input.coachId), host);
  batch.set(doc(db, "communityMemberships", input.coachId, "groups", reference.id), { groupId: reference.id, uid: input.coachId, status: "active", joinedAt: serverTimestamp() });
  await batch.commit();
  try {
    // Each batch stays within Firestore's security-rule document access budget.
    for (let offset = 0; offset < clients.length; offset += 4) {
      const enrolment = writeBatch(db);
      for (const client of clients.slice(offset, offset + 4)) {
        enrolment.set(doc(db, "communityGroups", reference.id, "members", client.memberId), { uid: client.memberId, name: client.memberName, role: "member", assignmentId: client.id, status: "active", joinedAt: serverTimestamp() });
        enrolment.set(doc(db, "communityMemberships", client.memberId, "groups", reference.id), { groupId: reference.id, uid: client.memberId, status: "active", joinedAt: serverTimestamp() });
      }
      await enrolment.commit();
    }
  } catch { return { id: reference.id, warning: "The group was created, but some invitations did not sync. Open Members to add the missing clients." }; }
  return { id: reference.id, warning: "" };
}
export async function setCommunityMembership(db: Firestore, group: CommunityGroup, member: CommunityMember | CoachAssignment, active: boolean) {
  const assignment = "memberId" in member;
  const uid = assignment ? member.memberId : member.id;
  const data = assignment ? { uid, name: member.memberName, role: "member", assignmentId: member.id, status: active ? "active" : "removed", joinedAt: serverTimestamp() } : { uid, name: member.name, role: member.role, assignmentId: member.assignmentId, status: active ? "active" : "removed", joinedAt: member.joinedAt };
  const batch = writeBatch(db);
  if (assignment) {
    batch.set(doc(db, "communityGroups", group.id, "members", uid), data, { merge: true });
    batch.set(doc(db, "communityMemberships", uid, "groups", group.id), { groupId: group.id, uid, status: data.status, joinedAt: data.joinedAt });
  } else {
    // Preserve authoritative identity and timestamp fields during moderation.
    batch.update(doc(db, "communityGroups", group.id, "members", uid), { status: data.status });
    batch.update(doc(db, "communityMemberships", uid, "groups", group.id), { status: data.status });
  }
  await batch.commit();
}
export async function markCommunityRead(db: Firestore, groupId: string, uid: string) {
  await setDoc(doc(db, "communityGroups", groupId, "members", uid), { lastReadAt: serverTimestamp() }, { merge: true });
}
