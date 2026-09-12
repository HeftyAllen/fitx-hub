import { deleteToken, getMessaging, getToken, isSupported, onMessage } from "firebase/messaging";
import { auth } from "@/lib/firebase";
import { supabase } from "@/integrations/supabase/client";

const appId = import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_APP_ID;
const vapidKey = import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_VAPID_KEY;
const firebaseConfig = {
  apiKey: import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_WEB_API_KEY,
  projectId: import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_PROJECT_ID,
  appId,
  messagingSenderId: appId?.split(":")[1] ?? "",
};
const TOKEN_KEY = "fitx-push-token";

export type PushStatus = "checking" | "ready" | "enabled" | "denied" | "unsupported" | "open-in-new-tab" | "not-configured";
export type PushPreferences = Record<string, boolean>;

function configured() {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && appId && vapidKey && firebaseConfig.messagingSenderId);
}

async function invoke(action: "register" | "unregister" | "preferences", token: string, preferences?: PushPreferences) {
  const user = auth.currentUser;
  if (!user) throw new Error("Sign in to manage push notifications.");
  const idToken = await user.getIdToken();
  const { data, error } = await supabase.functions.invoke("push-register", {
    body: { idToken, action, token, preferences },
  });
  if (error) throw new Error(error.message);
  if (!data?.ok) throw new Error(data?.error || "Push setup failed");
}

export function getPushStatus(): PushStatus {
  if (!configured()) return "not-configured";
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return "unsupported";
  if (window.top !== window.self) return "open-in-new-tab";
  if (Notification.permission === "denied") return "denied";
  return localStorage.getItem(TOKEN_KEY) ? "enabled" : "ready";
}

export async function enablePush(preferences: PushPreferences): Promise<PushStatus> {
  if (!configured()) return "not-configured";
  if (!("Notification" in window) || !(await isSupported())) return "unsupported";
  if (window.top !== window.self) return "open-in-new-tab";
  const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (permission !== "granted") return "denied";

  const query = new URLSearchParams(firebaseConfig).toString();
  const registration = await navigator.serviceWorker.register(`/firebase-messaging-sw.js?${query}`, { scope: "/" });
  const token = await getToken(getMessaging(), { vapidKey, serviceWorkerRegistration: registration });
  if (!token) return "denied";
  await invoke("register", token, preferences);
  localStorage.setItem(TOKEN_KEY, token);
  return "enabled";
}

export async function disablePush() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return;
  try { await invoke("unregister", token); } finally {
    try { if (await isSupported()) await deleteToken(getMessaging()); } catch { /* best effort */ }
    localStorage.removeItem(TOKEN_KEY);
  }
}

export async function syncPushPreferences(preferences: PushPreferences) {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) await invoke("preferences", token, preferences);
}

export function listenForForegroundPush(handler: (title: string, body: string) => void) {
  if (!configured()) return () => undefined;
  let unsubscribe = () => undefined;
  isSupported().then((supported) => {
    if (supported) unsubscribe = onMessage(getMessaging(), (payload) => {
      handler(payload.notification?.title ?? "FitX Journey", payload.notification?.body ?? "You have a new notification");
    });
  });
  return () => unsubscribe();
}

export async function unregisterPushBeforeSignOut() {
  try { await disablePush(); } catch (error) { console.warn("[push] cleanup failed", error); }
}