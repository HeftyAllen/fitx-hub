import { useEffect, useState } from "react";
import { collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import type { AdminRole } from "@/lib/permissions";

export interface AdminInvite {
  id: string;
  role: AdminRole;
  invitedByEmail?: string | null;
  invitedAt?: any;
}

export function useAdminInvites() {
  const { user, logout } = useAuth();
  const [invites, setInvites] = useState<AdminInvite[]>([]);

  useEffect(() => {
    if (!user) { setInvites([]); return; }
    const q = query(collection(db, "users", user.uid, "adminInvites"), orderBy("invitedAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setInvites(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
    }, () => setInvites([]));
    return unsub;
  }, [user]);

  const accept = async (invite: AdminInvite) => {
    if (!user) return;
    const batch = writeBatch(db);
    batch.set(doc(db, "admins", user.uid), {
      role: invite.role,
      grantedAt: serverTimestamp(),
      grantedFromInvite: invite.id,
    });
    batch.delete(doc(db, "users", user.uid, "adminInvites", invite.id));
    await batch.commit();
    // Force a fresh sign-in so token + UI rehydrate as admin
    await logout();
  };

  const decline = async (invite: AdminInvite) => {
    if (!user) return;
    await deleteDoc(doc(db, "users", user.uid, "adminInvites", invite.id));
  };

  return { invites, accept, decline };
}
