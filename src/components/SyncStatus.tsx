import { Cloud, CloudOff, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { useOffline } from "@/contexts/OfflineContext";
import { Button } from "@/components/ui/button";
export default function SyncStatus({ compact = false }: { compact?: boolean }) {
  const { online, queue, syncing, storageError, retry } = useOffline();
  const failed = queue.some((r) => r.error);
  const Icon =
    storageError || failed
      ? AlertCircle
      : !online
        ? CloudOff
        : syncing
          ? Loader2
          : Cloud;
  const label = storageError
    ? "Offline storage unavailable"
    : !online
      ? `Offline${queue.length ? ` · ${queue.length} saved` : ""}`
      : syncing
        ? "Syncing workouts…"
        : failed
          ? `${queue.length} workout${queue.length === 1 ? "" : "s"} need sync`
          : queue.length
            ? `${queue.length} workout${queue.length === 1 ? "" : "s"} waiting`
            : "Workout queue clear";
  return (
    <div className="flex items-center gap-2" role="status" aria-live="polite">
      <span
        className={`inline-flex items-center gap-2 text-[11px] rounded-full px-3 py-2 border border-border ${failed || storageError ? "text-destructive" : "text-muted-foreground"}`}
      >
        <Icon size={14} className={syncing ? "animate-spin" : ""} />
        <span className={compact ? "hidden sm:inline" : ""}>{label}</span>
      </span>
      {online && failed && (
        <Button
          size="sm"
          variant="outline"
          onClick={retry}
          disabled={syncing}
          aria-label="Retry workout sync"
        >
          <RefreshCw size={13} />
          {!compact && <span className="ml-1">Retry</span>}
        </Button>
      )}
    </div>
  );
}
