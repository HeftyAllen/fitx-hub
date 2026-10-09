import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "./AuthContext";
import { useAdmin } from "@/hooks/useAdmin";
import { DEFAULT_ACCESS, expiryMillis, normalizeAccessConfig, normalizeMemberAccess, resolveFeatureAccess, type AccessConfig, type FeatureId, type MemberAccess } from "@/lib/feature-access";
const CACHE_KEY = "fitx-feature-access:v1";
function cachedConfig() {
  try { const saved = localStorage.getItem(CACHE_KEY); return saved ? normalizeAccessConfig(JSON.parse(saved)) : null; } catch { return null; }
}
type Decision = ReturnType<typeof resolveFeatureAccess> & { loading: boolean; error: string };
interface FeatureContext { config: AccessConfig; member: MemberAccess; loading: boolean; error: string; fromCache: boolean; getAccess: (id: FeatureId) => Decision }
const FeatureAccessContext = createContext<FeatureContext | null>(null);
export function FeatureAccessProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const uid = user?.uid;
  const { role, loading: roleLoading } = useAdmin();
  const [configState, setConfigState] = useState(() => {
    const config = cachedConfig();
    return { config: config || DEFAULT_ACCESS, loading: !config, error: "", fromCache: !!config };
  });
  const [entitlement, setEntitlement] = useState({ uid: "", member: normalizeMemberAccess({}), loading: true, error: "", fromCache: false });
  const [now, setNow] = useState(Date.now);
  useEffect(() => onSnapshot(doc(db, "siteSettings", "access"), { includeMetadataChanges: true }, snap => {
    if (snap.metadata.fromCache && !snap.exists()) {
      if (!navigator.onLine) setConfigState(previous => ({ ...previous, loading: false, fromCache: true, error: cachedConfig() ? "" : "Connect once to load your app's feature settings." }));
      return;
    }
    const config = normalizeAccessConfig(snap.data() || {});
    setConfigState({ config, loading: false, error: "", fromCache: snap.metadata.fromCache });
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(config)); } catch { /* optional public cache */ }
  }, () => setConfigState(prev => ({ ...prev, loading: false, error: "Feature settings are unavailable. Reconnect and try again." }))), []);
  useEffect(() => {
    if (!uid) return;
    setEntitlement({ uid, member: normalizeMemberAccess({}), loading: true, error: "", fromCache: false });
    return onSnapshot(doc(db, "memberAccess", uid), { includeMetadataChanges: true }, snap => {
      if (snap.metadata.fromCache && !snap.exists() && navigator.onLine) return;
      setEntitlement({ uid, member: normalizeMemberAccess(snap.data()), loading: false, error: "", fromCache: snap.metadata.fromCache });
    }, () => setEntitlement({ uid, member: normalizeMemberAccess({}), loading: false, error: "Membership could not be verified.", fromCache: false }));
  }, [uid]);
  const identityReady = !!user && entitlement.uid === user.uid;
  const member = useMemo(() => identityReady ? entitlement.member : normalizeMemberAccess({}), [identityReady, entitlement.member]);
  const deadline = expiryMillis(member.expiresAt);
  useEffect(() => {
    const remaining = deadline === null ? 0 : deadline - Date.now();
    const timer = remaining > 0 ? window.setTimeout(() => setNow(Date.now()), Math.min(remaining + 1, 2147483647)) : undefined;
    const refresh = () => setNow(Date.now());
    document.addEventListener("visibilitychange", refresh);
    return () => { if (timer) window.clearTimeout(timer); document.removeEventListener("visibilitychange", refresh); };
  }, [deadline, now]);
  const getAccess = useCallback((id: FeatureId): Decision => {
    const decision = resolveFeatureAccess(id, configState.config, member, Math.max(now, Date.now()));
    if (role === "admin") return { ...decision, state: "allowed", loading: false, error: "" };
    const premium = configState.config.features[id].mode === "premium" || decision.state === "premium";
    const loading = configState.loading || roleLoading || (premium && !!user && (!identityReady || entitlement.loading));
    const error = configState.error || (premium ? entitlement.error : "");
    return { ...decision, loading, error };
  }, [configState, member, now, role, roleLoading, user, identityReady, entitlement.loading, entitlement.error]);
  const value = useMemo(() => ({ config: configState.config, member, getAccess, loading: configState.loading, error: configState.error, fromCache: configState.fromCache || (identityReady && entitlement.fromCache) }), [configState, member, getAccess, identityReady, entitlement.fromCache]);
  return <FeatureAccessContext.Provider value={value}>{children}</FeatureAccessContext.Provider>;
}
export function useFeatureAccess() {
  const context = useContext(FeatureAccessContext);
  if (!context) throw new Error("FeatureAccessProvider is missing");
  return context;
}
