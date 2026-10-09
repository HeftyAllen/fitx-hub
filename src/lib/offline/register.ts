export async function registerOfflineShell() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  try {
    const current = await navigator.serviceWorker.getRegistration("/");
    const script = current?.active?.scriptURL;
    // Keep an existing FCM registration and its token; both workers import the app-shell cache.
    const target =
      script && new URL(script).pathname === "/firebase-messaging-sw.js"
        ? script
        : "/sw.js";
    await navigator.serviceWorker.register(target, {
      scope: "/",
      updateViaCache: "none",
    });
  } catch (error) {
    console.warn("[offline] App shell caching is unavailable", error);
  }
}
