import { useEffect, useState } from "react";
import { BellRing, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { disablePush, enablePush, getPushStatus, type PushPreferences, type PushStatus } from "@/lib/pushNotifications";
import { toast } from "sonner";

const COPY: Record<PushStatus, string> = {
  checking: "Checking this device…",
  ready: "Receive reminders and announcements when FitX Journey is closed.",
  enabled: "Push notifications are active on this device.",
  denied: "Notifications are blocked. Allow them in your browser's site settings.",
  unsupported: "This browser does not support push notifications.",
  "open-in-new-tab": "Open FitX Journey in its own tab to enable notifications.",
  "not-configured": "Web push needs to be enabled on the Firebase Messaging connection.",
};

export default function PushNotifications({ preferences }: { preferences: PushPreferences }) {
  const [status, setStatus] = useState<PushStatus>("checking");
  const [busy, setBusy] = useState(false);
  useEffect(() => setStatus(getPushStatus()), []);

  const toggle = async () => {
    setBusy(true);
    try {
      if (status === "enabled") {
        await disablePush();
        setStatus("ready");
        toast.success("Push notifications disabled on this device");
      } else {
        const next = await enablePush(preferences);
        setStatus(next);
        if (next === "enabled") toast.success("Push notifications enabled");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update push notifications");
    } finally {
      setBusy(false);
    }
  };

  const actionable = status === "ready" || status === "enabled";
  return (
    <div className="flex flex-col gap-3 border-b border-border py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span className="rounded-lg bg-primary/10 p-2 text-primary"><BellRing size={16} /></span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">Push notifications</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{COPY[status]}</p>
        </div>
      </div>
      {status === "open-in-new-tab" ? (
        <Button asChild size="sm" variant="outline" className="w-full shrink-0 sm:w-auto">
          <a href={window.location.href} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Open tab</a>
        </Button>
      ) : actionable ? (
        <Button onClick={toggle} disabled={busy} size="sm" variant={status === "enabled" ? "outline" : "default"} className="w-full shrink-0 sm:w-auto">
          {busy && <Loader2 size={14} className="animate-spin" />}
          {status === "enabled" ? "Disable" : "Enable"}
        </Button>
      ) : null}
    </div>
  );
}