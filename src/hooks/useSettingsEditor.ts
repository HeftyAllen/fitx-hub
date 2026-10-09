import { useCallback, useEffect, useRef, useState } from "react";
import { collection, doc, onSnapshot, orderBy, query, limit, runTransaction, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useAdmin } from "./useAdmin";
import { useOnline } from "./useOnline";
import { logActivity } from "@/lib/activity";
import { toast } from "sonner";

export function useSettingsEditor<T extends object>(kind: "branding" | "access", normalize: (raw: unknown) => T) {
  const { user } = useAuth();
  const { canManageSystem } = useAdmin();
  const online = useOnline();
  const [draft, setDraft] = useState<T>(() => normalize({}));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [history, setHistory] = useState<{ id: string; settings: T; date: string }[]>([]);
  const state = useRef({ dirty: false, revision: 0, saved: normalize({}), latest: normalize({}), latestRevision: 0 });
  useEffect(() => {
    const stop = onSnapshot(doc(db, "siteSettings", kind), snapshot => {
      if (snapshot.metadata.fromCache && !snapshot.exists() && navigator.onLine) return;
      const value = normalize(snapshot.data() || {});
      const revision = Number(snapshot.data()?.revision) || 0;
      state.current.latest = value;
      state.current.latestRevision = revision;
      if (!state.current.dirty) {
        state.current.saved = value; state.current.revision = revision;
        setDraft(value); setConflict(false);
      } else if (state.current.revision !== revision) setConflict(true);
      setLoading(false); setError("");
    }, () => { setLoading(false); setError("Settings could not load. Reconnect before editing."); });
    const stopHistory = onSnapshot(query(collection(db, "settingsHistory"), orderBy("createdAt", "desc"), limit(30)), snapshot => {
      setHistory(snapshot.docs.filter(item => item.data().kind === kind).map(item => ({ id: item.id, settings: normalize(item.data().settings), date: item.data().createdAt?.toDate?.().toLocaleString() || "Just now" })));
    }, () => setHistory([]));
    return () => { stop(); stopHistory(); };
  }, [kind, normalize]);
  const edit = useCallback((patch: Partial<T>) => {
    state.current.dirty = true; setDirty(true); setDraft(previous => ({ ...previous, ...patch }));
  }, []);
  const discard = useCallback(() => {
    state.current.dirty = false; state.current.saved = state.current.latest; state.current.revision = state.current.latestRevision;
    setDraft(state.current.latest); setDirty(false); setConflict(false);
  }, []);
  async function publish(value = draft) {
    if (!canManageSystem || !online || loading || error) { toast.error("Reconnect with an administrator account to publish settings."); return false; }
    setSaving(true);
    try {
      const target = doc(db, "siteSettings", kind);
      const historyRef = doc(collection(db, "settingsHistory"));
      await runTransaction(db, async transaction => {
        const current = await transaction.get(target);
        const revision = Number(current.data()?.revision) || 0;
        if (revision !== state.current.revision) throw new Error("Another administrator published an update. Reload the published settings before saving.");
        transaction.set(historyRef, { kind, settings: normalize(current.data() || {}), createdAt: serverTimestamp(), updatedBy: user!.uid });
        transaction.set(target, { ...value, revision: revision + 1, updatedAt: serverTimestamp(), updatedBy: user!.uid });
        return revision + 1;
      }).then(revision => {
        state.current = { dirty: false, revision, saved: value, latest: value, latestRevision: revision };
        setDirty(false); setConflict(false); setDraft(value);
      });
      void logActivity(`admin.${kind}.publish`, { kind });
      toast.success(kind === "branding" ? "Brand published across the app" : "Feature access published across the app");
      return true;
    } catch (failure) { toast.error(failure instanceof Error ? failure.message : "Settings could not be published."); return false; }
    finally { setSaving(false); }
  }
  return { draft, edit, discard, publish, history, loading, saving, error, conflict, dirty, readOnly: !canManageSystem || !online || loading || !!error };
}
