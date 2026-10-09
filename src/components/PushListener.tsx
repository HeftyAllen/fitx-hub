import { useEffect } from "react";
import { toast } from "sonner";
import { listenForForegroundPush } from "@/lib/pushNotifications";
import { useBrand } from "@/contexts/SiteSettingsContext";

export default function PushListener() {
  const { name } = useBrand();
  useEffect(() => listenForForegroundPush((title, body) => toast(title, { description: body }), name), [name]);
  return null;
}
