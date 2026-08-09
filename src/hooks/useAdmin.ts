import { useEffect, useState } from "react";
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import {
  canAccess, canManageSystem, canWrite, ROLE_SECTIONS,
  type AdminRole, type AdminSection,
} from "@/lib/permissions";

export type { AdminRole } from "@/lib/permissions";

export interface AdminInfo {
  loading: boolean;
  /** has any console access (including read-only) */
  isAdmin: boolean;
  role: AdminRole | null;
  sections: AdminSection[];
  can: (section: AdminSection) => boolean;
  canWrite: boolean;
  canManageSystem: boolean;
}

// Hardcoded admin emails — always treated as full admin regardless of Firestore.
const ADMIN_EMAILS = ["admin1@gmail.com", "admin101@gmail.com"];

export function useAdmin(): AdminInfo {
  const { user } = useAuth();
  const [state, setState] = useState<{ loading: boolean; role: AdminRole | null }>({
    loading: true,
    role: null,
  });

  useEffect(() => {
    if (!user) {
      setState({ loading: false, role: null });
      return;
    }

    // Email allowlist short-circuit — also self-heals the admins/{uid} doc so
    // Firestore/Storage rules (which read that doc) grant write access too.
    if (user.email && ADMIN_EMAILS.includes(user.email.toLowerCase())) {
      setState({ loading: false, role: "admin" });
      (async () => {
        try {
          const ref = doc(db, "admins", user.uid);
          const snap = await getDoc(ref);
          if (!snap.exists()) {
            await setDoc(ref, { role: "admin", grantedAt: serverTimestamp(), source: "allowlist" });
          }
        } catch { /* rules may block — allowlist UI access still works */ }
      })();
      return;
    }

    const unsub = onSnapshot(
      doc(db, "admins", user.uid),
      (snap) => {
        if (!snap.exists()) { setState({ loading: false, role: null }); return; }
        const role = (snap.data().role ?? "readonly") as AdminRole;
        setState({ loading: false, role: ROLE_SECTIONS[role] ? role : "readonly" });
      },
      () => setState({ loading: false, role: null }),
    );
    return unsub;
  }, [user]);

  const role = state.role;
  return {
    loading: state.loading,
    role,
    isAdmin: !!role,
    sections: role ? ROLE_SECTIONS[role] : [],
    can: (section: AdminSection) => canAccess(role, section),
    canWrite: canWrite(role),
    canManageSystem: canManageSystem(role),
  };
}
