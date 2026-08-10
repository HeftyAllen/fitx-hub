# Fix: published site keeps showing the old Dashboard/Admin UI

## What's actually happening

The new code *is* live. I fetched the published bundle at fitxjourney.lovable.app and it contains the new Records "Trophy Room" markup, so the deploy succeeded.

What you're seeing is the app's offline service worker (the PWA cache) serving the previously cached app shell from your browser/installed app. The app registers `/sw.js` with `registerType: "autoUpdate"`, but a new version only takes over on a later visit — so right after publishing you keep getting the old screen until every tab of the site is closed.

Quick confirmation you can do now: open the published site in a private window (or on a device that never visited it). If the new dashboard appears there, the diagnosis is confirmed and the fix below is what's needed.

## What to change

1. Add an explicit update flow instead of silent auto-update:
   - Use the PWA register hook to detect when a new version is ready.
   - Show a small toast/banner: "A new version is available - Reload", which activates the waiting service worker and reloads the page.
   - Also check for updates periodically (e.g. on window focus) so returning users pick up new deploys.

2. Stop the cached HTML shell from pinning old builds:
   - Keep hashed assets precached, but let navigations revalidate against the network first so a fresh publish is picked up on the next load rather than the load after.

3. Clean up stale caches on activation so old asset caches from prior deploys don't linger.

## Technical notes

- `vite.config.ts`: keep `VitePWA` but switch to `registerType: "prompt"` with `injectRegister: null`, and configure Workbox so `index.html` is served network-first (leave hashed `assets/*` as cache-first precache).
- New `src/components/PwaUpdatePrompt.tsx`: uses `useRegisterSW` from `virtual:pwa-register/react`, renders the reload prompt, calls `updateServiceWorker(true)`, and polls `registration.update()` on focus/interval.
- Mount it in `src/App.tsx` alongside `OfflineBanner`.
- Add `"vite-plugin-pwa/client"` to `types` in `tsconfig.app.json` for the virtual module typing.
- No changes to Dashboard, Records, or Admin code — those are already correct and deployed.

## After the change

You'll need to publish once more. That publish is the last one that requires a manual hard refresh (or closing all tabs) — from then on every deploy surfaces the "new version available" prompt automatically.
