# Security & Deployment

## 1. Environment variables

API keys are no longer in the codebase. Copy `.env.example` to `.env.local` and fill in:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_MEASUREMENT_ID=...
VITE_SPOONACULAR_KEY=...
VITE_RAPIDAPI_KEY=...
```

> **Note:** Firebase web `apiKey` is a public identifier — it's safe in the bundle as long as Firestore/Storage rules are restrictive (they are, see below) and you enable **Firebase App Check** in production.
>
> **Spoonacular and RapidAPI keys are real secrets** and are still visible in the JS bundle even when read from env. The proper fix is to proxy these calls through a Cloud Function. Treat this env-var move as the *first step* in that hardening.

## 2. Deploy Firebase rules

Install the CLI once: `npm i -g firebase-tools` then `firebase login` and `firebase use fit-x-journey`.

Deploy from project root:

```bash
firebase deploy --only firestore:rules
firebase deploy --only storage
firebase deploy --only database          # only if RTDB is in use
```

Or paste the contents of `firestore.rules`, `storage.rules`, `database.rules.json` directly into the Firebase Console → respective product → Rules tab.

## 3. Bootstrap the first admin

Rules forbid self-promotion. To create the first admin, open the Firebase console → Firestore → create:

```
Collection: admins
Document ID: <your-auth-uid>
Fields:
  role: "admin"      (string)
  email: "you@..."   (string)
  createdAt: <serverTimestamp>
```

After that, additional admins can be added from the in-app `/admin/users` page.

## 4. Recommended next hardening steps

1. **Enable Firebase App Check** (reCAPTCHA v3) — blocks calls from non-app origins.
2. **Proxy Spoonacular & RapidAPI** through a Cloud Function so the keys never ship to the browser.
3. **Enable Firestore audit logging** in GCP for full forensic trails.
4. Rotate the API keys that were previously committed (treat them as compromised).
