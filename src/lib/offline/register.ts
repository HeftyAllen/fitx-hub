import { APP_BASE, appAsset } from "@/lib/app-paths";

export async function registerOfflineShell() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  try {
    const current = await navigator.serviceWorker.getRegistration(APP_BASE);
    const script = current?.active?.scriptURL;
    // Keep an existing FCM registration and its token; both workers import the app-shell cache.
    const target =
      script && new URL(script).pathname === appAsset("firebase-messaging-sw.js")
        ? script
        : appAsset("sw.js");
    await navigator.serviceWorker.register(target, {
      scope: APP_BASE,
      updateViaCache: "none",
    });
  } catch (error) {
    console.warn("[offline] App shell caching is unavailable", error);
  }
}
