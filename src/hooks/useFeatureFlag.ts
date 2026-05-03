import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface FlagState { enabled: boolean; rollout?: number; loading: boolean; }

export function useFeatureFlag(name: string): FlagState {
  const [state, setState] = useState<FlagState>({ enabled: false, loading: true });

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, "featureFlags", name),
      (snap) => {
        if (!snap.exists()) { setState({ enabled: false, loading: false }); return; }
        const d = snap.data();
        setState({
          enabled: !!d.enabled,
          rollout: typeof d.rollout === "number" ? d.rollout : undefined,
          loading: false,
        });
      },
      () => setState({ enabled: false, loading: false }),
    );
    return unsub;
  }, [name]);

  return state;
}
