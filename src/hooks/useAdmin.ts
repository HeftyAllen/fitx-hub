import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import {
  canAccess,
  canManageSystem,
  canWrite,
  canPerform,
  isAdminRole,
  ROLE_SECTIONS,
  type AdminRole,
  type AdminSection,
  type Capability,
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
  canPerform: (capability: Capability) => boolean;
}

function useAdminState(): AdminInfo {
  const { user } = useAuth();
  const [state, setState] = useState<{
    loading: boolean;
    role: AdminRole | null;
    uid?: string;
  }>({
    loading: true,
    role: null,
  });

  useEffect(() => {
    if (!user) {
      setState({ loading: false, role: null });
      return;
    }

    setState({ loading: true, role: null, uid: user.uid });
    const unsub = onSnapshot(
      doc(db, "admins", user.uid),
      { includeMetadataChanges: true },
      (snap) => {
        if (snap.metadata.fromCache && !snap.exists() && navigator.onLine) return;
        const role = snap.data()?.role;
        setState({
          loading: false,
          role: isAdminRole(role) ? role : null,
          uid: user.uid,
        });
      },
      () => setState({ loading: false, role: null, uid: user.uid }),
    );
    return unsub;
  }, [user]);

  const role = state.uid === user?.uid ? state.role : null;
  return {
    loading: !!user && (state.loading || state.uid !== user.uid),
    role,
    isAdmin: !!role,
    sections: role ? ROLE_SECTIONS[role] : [],
    can: (section: AdminSection) => canAccess(role, section),
    canWrite: canWrite(role),
    canManageSystem: canManageSystem(role),
    canPerform: (capability) => canPerform(role, capability),
  };
}

const AdminContext = createContext<AdminInfo | null>(null);
export function AdminProvider({ children }: { children: ReactNode }) {
  const value = useAdminState();
  return createElement(AdminContext.Provider, { value }, children);
}
export function useAdmin(): AdminInfo {
  const value = useContext(AdminContext);
  if (!value) throw new Error("AdminProvider is missing");
  return value;
}
