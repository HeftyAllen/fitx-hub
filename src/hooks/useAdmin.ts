import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";

export type AdminRole = "admin" | "moderator" | "staff" | "readonly";

export interface AdminInfo {
  loading: boolean;
  isAdmin: boolean;
  role: AdminRole | null;
}

export function useAdmin(): AdminInfo {
  const { user } = useAuth();
  const [info, setInfo] = useState<AdminInfo>({ loading: true, isAdmin: false, role: null });

  useEffect(() => {
    if (!user) {
      setInfo({ loading: false, isAdmin: false, role: null });
      return;
    }
    const ref = doc(db, "admins", user.uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setInfo({ loading: false, isAdmin: false, role: null });
          return;
        }
        const role = (snap.data().role ?? "readonly") as AdminRole;
        setInfo({ loading: false, isAdmin: role !== "readonly", role });
      },
      () => setInfo({ loading: false, isAdmin: false, role: null }),
    );
    return unsub;
  }, [user]);

  return info;
}
