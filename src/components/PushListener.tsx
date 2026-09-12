import { useEffect } from "react";
import { toast } from "sonner";
import { listenForForegroundPush } from "@/lib/pushNotifications";

export default function PushListener() {
  useEffect(() => listenForForegroundPush((title, body) => toast(title, { description: body })), []);
  return null;
}