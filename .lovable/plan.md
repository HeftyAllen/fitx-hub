# Plan: Security Hardening, Admin Dashboard & Offline Mode

## 1. Move API keys out of source code

Currently hardcoded in repo:
- `src/lib/firebase.ts` — Firebase web config (apiKey etc.)
- `src/lib/spoonacular.ts` — Spoonacular key
- `src/lib/api.ts` — RapidAPI/ExerciseDB key

**Approach:**
- Create `.env` with `VITE_` prefixed variables: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_SENDER_ID`, `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_MEASUREMENT_ID`, `VITE_SPOONACULAR_KEY`, `VITE_RAPIDAPI_KEY`.
- Add `.env.example` with placeholder values committed to repo.
- Add `.env` to `.gitignore`.
- Replace literals in `firebase.ts`, `spoonacular.ts`, `api.ts` with `import.meta.env.VITE_*` reads, with a runtime guard that warns if missing.

**Note (honest caveat):** Firebase web `apiKey` is a public identifier — security comes from Firebase Rules + App Check, not from hiding the key. Spoonacular and RapidAPI keys, however, are real secrets and any client-side usage exposes them in the bundle. The proper long-term fix is to proxy those calls through a backend (Firebase Cloud Function / Lovable Cloud edge function). For this pass we'll move them to env vars (so they're not in git history going forward) and flag the proxy work as a follow-up. I'll mention this clearly to you in chat.

## 2. Firebase security rules

Create three rule files at the project root so you can paste them into the Firebase console (or deploy via CLI):

**`firestore.rules`** — owner-only access pattern:
```
rules_version='2';
service cloud.firestore {
  match /databases/{db}/documents {
    function isSignedIn()  { return request.auth != null; }
    function isOwner(uid)  { return isSignedIn() && request.auth.uid == uid; }
    function isAdmin()     { return isSignedIn() &&
      get(/databases/$(db)/documents/admins/$(request.auth.uid)).data.role in ['admin','moderator']; }

    // All per-user data lives under users/{uid}/...
    match /users/{uid}/{document=**} {
      allow read, write: if isOwner(uid) || isAdmin();
    }

    // Admin registry — only admins can read/write
    match /admins/{uid} {
      allow read:  if isSignedIn() && (isOwner(uid) || isAdmin());
      allow write: if isAdmin();
    }

    // Audit/activity logs — append-only for users, full read for admins
    match /activityLogs/{id} {
      allow create: if isSignedIn() &&
                    request.resource.data.userId == request.auth.uid;
      allow read:   if isAdmin();
      allow update, delete: if false;
    }

    // Announcements — public read, admin write
    match /announcements/{id} {
      allow read:  if isSignedIn();
      allow write: if isAdmin();
    }

    // Support tickets — owner + admin
    match /supportTickets/{id} {
      allow create: if isSignedIn();
      allow read, update: if isSignedIn() &&
        (resource.data.userId == request.auth.uid || isAdmin());
      allow delete: if isAdmin();
    }

    // Feature flags & site settings — public read, admin write
    match /siteSettings/{doc}      { allow read: if true; allow write: if isAdmin(); }
    match /featureFlags/{flag}     { allow read: if true; allow write: if isAdmin(); }

    match /{document=**} { allow read, write: if false; } // default deny
  }
}
```

**`storage.rules`** — users own their `users/{uid}/...` paths; admins can read all:
```
rules_version='2';
service firebase.storage {
  match /b/{bucket}/o {
    function isSignedIn() { return request.auth != null; }
    function isAdmin() { return isSignedIn() &&
      firestore.exists(/databases/(default)/documents/admins/$(request.auth.uid)); }

    match /users/{uid}/{allPaths=**} {
      allow read:  if request.auth.uid == uid || isAdmin();
      allow write: if request.auth.uid == uid &&
                   request.resource.size < 5 * 1024 * 1024 &&
                   request.resource.contentType.matches('image/.*|application/pdf');
    }
    match /public/{allPaths=**} {
      allow read: if true;
      allow write: if isAdmin();
    }
  }
}
```

**`database.rules.json`** (Realtime Database — only if you actually use it; project currently doesn't, but you asked for it):
```
{
  "rules": {
    ".read": false,
    ".write": false,
    "presence": {
      "$uid": {
        ".read":  "auth != null",
        ".write": "auth != null && auth.uid === $uid"
      }
    },
    "admins": { ".read": "auth != null", ".write": false }
  }
}
```

I'll add a short `SECURITY.md` explaining how to deploy these (firebase CLI commands).

## 3. Admin page

Routes: `/admin` (guarded by `AdminRoute` wrapper that checks `admins/{uid}` doc).

**Layout:** sidebar + main content, sub-routes:
- `/admin` — Overview dashboard (KPIs: total users, signups last 7d, active workouts, errors logged, API calls used today)
- `/admin/users` — User table with search/filter, suspend/delete, role assignment (admin/moderator/staff/readonly), "impersonate" link (loads that uid's data read-only into a viewer; we won't actually swap auth tokens — too risky — instead a read-only "view as" mode)
- `/admin/content` — CRUD for announcements + curated workout templates + featured recipes (saved to `siteSettings/featured`)
- `/admin/activity` — Activity log table (filter by user, action, date), CSV export
- `/admin/announcements` — Compose + send in-app banner; writes to `announcements/{id}` which the user navbar listens to and surfaces in the existing NotificationCenter (replaces the "send email to all users" feature, which would need a backend)
- `/admin/support` — Support ticket inbox; users open tickets from a new "Help" link in Settings; admins reply inline (thread stored in `supportTickets/{id}/messages`)
- `/admin/settings` — Site settings (logo, brand colors saved to `siteSettings/branding`), feature flags toggle (`featureFlags/{name}` → readable by client, gates routes/components)
- `/admin/reports` — Charts: signups over time, workout volume, API usage (Spoonacular counter), top features. Export CSV.

**Replacements / removals (since they don't fit a Firebase-only stack):**
- "Email logs / bounces" → removed (no email service wired). Replaced with **In-app announcement log** showing read-rate.
- "Backup & restore" → replaced with **Export user data** (download a uid's Firestore subtree as JSON) + **Bulk JSON export** for admins.
- "Payment failures / Integrations API keys UI" → removed (no payment system). Replaced with **API quota monitor** (Spoonacular daily/monthly counter, RapidAPI status).
- "A/B test controls" → folded into **Feature flags** (single rollout %).
- "Real impersonation" → **Read-only "View as user"** mode (safer; no token swap).

**Bootstrapping the first admin:** Firestore doc `admins/{yourUid}` created manually via the Firebase console (one-line instruction in SECURITY.md), since rules forbid self-promotion.

**Activity logging helper:** new `src/lib/activity.ts` with `logActivity(action, meta)` that writes to `activityLogs/{autoId}` — called from key flows (login, workout complete, plan created, admin actions).

## 4. Offline mode

Two layers:

**A. Firestore offline persistence**
- Update `src/lib/firebase.ts` to use `initializeFirestore` with `persistentLocalCache({ tabManager: persistentMultipleTabManager() })`. This caches reads/writes locally and replays mutations when back online.

**B. App-shell PWA + offline UX**
- Add Vite plugin `vite-plugin-pwa` configured with Workbox to precache the app shell, and runtime-cache exercise GIFs / Spoonacular responses (StaleWhileRevalidate).
- Add `public/manifest.webmanifest` + icons (reuse existing logo).
- New `src/hooks/useOnline.ts` listening to `navigator.onLine` + `online`/`offline` events.
- Global `<OfflineBanner />` mounted in `App.tsx` showing "You're offline — changes will sync when you reconnect."
- Disable network-only actions (Spoonacular search, recipe lookup) when offline with a tooltip; allow viewing cached content, logging workouts, editing plans.
- Settings page: toggle "Enable offline mode" + "Clear offline cache" button.

## 5. File-level changes (technical summary)

**New files**
- `.env.example`, `firestore.rules`, `storage.rules`, `database.rules.json`, `SECURITY.md`
- `src/lib/activity.ts`, `src/lib/admin.ts` (helpers: isAdmin, listUsers, etc.)
- `src/hooks/useAdmin.ts`, `src/hooks/useOnline.ts`, `src/hooks/useFeatureFlag.ts`
- `src/components/admin/AdminLayout.tsx`, `AdminRoute.tsx`, `OfflineBanner.tsx`
- `src/pages/admin/AdminOverview.tsx`, `AdminUsers.tsx`, `AdminContent.tsx`, `AdminActivity.tsx`, `AdminAnnouncements.tsx`, `AdminSupport.tsx`, `AdminSettings.tsx`, `AdminReports.tsx`
- `src/pages/Support.tsx` (user-facing ticket form, linked from Settings)

**Edited files**
- `src/lib/firebase.ts` — env vars + persistent cache
- `src/lib/spoonacular.ts`, `src/lib/api.ts` — env vars
- `src/App.tsx` — add `/admin/*` routes, OfflineBanner, mount announcements listener
- `src/components/layout/Navbar.tsx` — show "Admin" link if `useAdmin()` true; surface announcements in NotificationCenter
- `src/pages/Settings.tsx` — Help/Support link, offline toggle
- `vite.config.ts` — add `vite-plugin-pwa`
- `.gitignore` — add `.env`
- `package.json` — add `vite-plugin-pwa`, `recharts` (already present? will check), `papaparse` for CSV export

## 6. What I need from you

After approval and implementation:
1. Add the env values in **Workspace Settings** (I'll list the exact names).
2. In Firebase console, create `admins/{yourUid}` doc with `{ role: "admin", createdAt: <timestamp> }` so you become the first admin.
3. Deploy the three rules files via Firebase console or `firebase deploy --only firestore:rules,storage,database`.

## 7. Honest limitations
- **Spoonacular/RapidAPI keys** will still be reachable from the bundle until proxied through a backend function. Moving them to env keeps them out of git but does not hide them from a determined user. I'll flag a follow-up to proxy via Lovable Cloud / a Cloud Function.
- **Email sending, real impersonation, scheduled backups** require a backend — replaced with the alternatives above.
- **Realtime Database rules** are included as requested but the app doesn't currently use RTDB; rules are a safe-default deny.
