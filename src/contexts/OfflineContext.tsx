import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  doc,
  setDoc,
  Timestamp,
  disableNetwork,
  enableNetwork,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useOnline } from "@/hooks/useOnline";
import {
  listWorkouts,
  subscribeQueue,
  syncWorkouts,
  type QueuedWorkout,
} from "@/lib/offline/queue";
interface State {
  online: boolean;
  queue: QueuedWorkout[];
  syncing: boolean;
  storageError: boolean;
  retry: () => void;
}
const OfflineContext = createContext<State | null>(null);
export function OfflineProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const online = useOnline();
  const [owner, setOwner] = useState<string>();
  const [queue, setQueue] = useState<QueuedWorkout[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const networkWasDisabled = useRef(false);
  useEffect(() => {
    // Explicitly reconnect the SDK after an offline launch rather than waiting
    // for its failed-network backoff to expire.
    if (!online) {
      networkWasDisabled.current = true;
      void disableNetwork(db).catch(() => {});
    } else if (networkWasDisabled.current) {
      networkWasDisabled.current = false;
      void enableNetwork(db).catch(() => {});
    }
  }, [online]);
  const sync = useCallback(
    async (retryFailed = false) => {
      if (!user || !navigator.onLine) return;
      setSyncing(true);
      try {
        await syncWorkouts(
          user.uid,
          async (entry) => {
            if (auth.currentUser?.uid !== entry.uid)
              throw new Error(
                "Sign in to the account that saved this workout.",
              );
            const { dateMs, ...payload } = entry.payload;
            await setDoc(doc(db, "users", entry.uid, "workoutLogs", entry.id), {
              ...payload,
              date: Timestamp.fromMillis(dateMs),
            });
          },
          retryFailed,
        );
      } catch {
        setStorageError(true);
      } finally {
        setSyncing(false);
      }
    },
    [user],
  );
  useEffect(() => {
    let alive = true;
    setQueue([]);
    setOwner(user?.uid);
    setSyncing(false);
    setStorageError(false);
    const refresh = async () => {
      if (!user) return;
      try {
        const entries = await listWorkouts(user.uid);
        if (alive) {
          setQueue(entries);
          setStorageError(false);
        }
      } catch {
        if (alive) setStorageError(true);
      }
    };
    void refresh();
    const stop = subscribeQueue(() => {
      void refresh();
    });
    // Pick up changes from other open tabs without moving private data into messages.
    const timer = window.setInterval(() => {
      void refresh();
    }, 5000);
    return () => {
      alive = false;
      stop();
      clearInterval(timer);
    };
  }, [user]);
  const pendingIds = queue
    .filter((r) => !r.error)
    .map((r) => r.id)
    .join(",");
  useEffect(() => {
    if (online && pendingIds) void sync();
  }, [online, pendingIds, sync]);
  const value = {
    online,
    queue: owner === user?.uid ? queue : [],
    syncing,
    storageError,
    retry: () => {
      void sync(true);
    },
  };
  return (
    <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>
  );
}
export function useOffline() {
  const value = useContext(OfflineContext);
  if (!value) throw new Error("OfflineProvider is missing");
  return value;
}
