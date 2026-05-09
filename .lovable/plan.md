# Plan — Onboarding/Storage fix + Admin Library round 2

## 1. Fix the "signup jumps to dashboard then back to onboarding" flicker

**Cause:** When `signUp()` resolves, `onAuthStateChanged` sets `user` immediately. The `/auth` route is `user ? <Navigate to="/dashboard" />` so React redirects to `/dashboard` for one frame *before* `handleSubmit` runs `navigate("/onboarding")`. `DashboardGate` then briefly renders before the second navigation lands.

**Fix:**
- Add an `OnboardingGate` wrapper: if the user is signed in but `users/{uid}/profile/data` has no `goalType` (i.e. onboarding not completed), every protected route — including `/dashboard` — redirects to `/onboarding`.
- `AuthContext` already loads `userProfile`; expose a derived `needsOnboarding` boolean (true when `userProfile?.goalType` is missing).
- In `App.tsx`:
  - `/` → if user && needsOnboarding → `/onboarding`, else if user → `/dashboard`, else `<Landing />`.
  - `/auth` → same logic.
  - `DashboardGate` first checks `needsOnboarding` before checking `isAdmin`.
- In `Auth.tsx` use `navigate(..., { replace: true })` everywhere to remove flicker from history.

## 2. Fix Firebase Storage upload 404 (preflight)

**Cause:** `firebase.ts` uses `storageBucket: "fit-x-journey.appspot.com"`. Firebase projects created after Oct 2024 use the `*.firebasestorage.app` bucket name; the legacy `*.appspot.com` host returns 404 on upload preflight.

**Fix:**
- Update `src/lib/firebase.ts` `storageBucket` to `"fit-x-journey.firebasestorage.app"` (and surface it via `VITE_FIREBASE_STORAGE_BUCKET` env so it's swappable).
- Tighten `storage.rules` so `users/{uid}/...` works for both avatar and progress paths (current rule is fine — just needs to be deployed).
- In `Settings.tsx` avatar path, append a content-type and a deterministic name (`avatar.jpg`) plus a cache-buster on the returned URL so the new image shows immediately.

**You will need to:** confirm the actual bucket name in Firebase Console → Storage (top of page shows `gs://...`). If yours is still `appspot.com`, keep the old value; if it shows `firebasestorage.app`, the new value is correct. I'll wire it through env so flipping is one line.

**Also required:** publish the updated `storage.rules` in the Firebase Console (Storage → Rules → Publish).

## 3. Smarter onboarding — calories that match the goal

Add a final computed step that derives daily targets from the inputs using **Mifflin-St Jeor** + activity multiplier + goal adjustment, and stores them on the profile so Nutrition / MealPlanner can read them.

```text
BMR (male)   = 10*kg + 6.25*cm - 5*age + 5
BMR (female) = 10*kg + 6.25*cm - 5*age - 161
TDEE         = BMR * activityFactor(daysPerWeek)
              1-2 d → 1.375 | 3-4 d → 1.55 | 5-6 d → 1.725 | 7 → 1.9
calorieTarget = TDEE + goalDelta
              lose: -500 | muscle: +300 | endurance: +200 | maintain/general/flex: 0
macros (g)   = protein 1.8*kg (muscle 2.2, lose 2.0)
              fat 25% of cals / 9
              carbs = remaining cals / 4
```

Changes:
- New `src/lib/nutrition.ts` with `computeTargets(profile)` returning `{ calorieTarget, protein, carbs, fat, bmr, tdee }`.
- Onboarding writes these alongside the existing fields.
- Onboarding step 6 (current "all set") becomes a **summary card** showing the computed numbers before "Enter Dashboard" so the user sees the plan was personalised.
- Unit handling: convert lbs→kg and ft→cm before computing.
- Nutrition page reads `calorieTarget` from profile (falls back to old default if missing).

## 4. Admin round 2 — Global library + opt-in (per your earlier choice)

Foundation already shipped (logout, real-time users, invites). This round adds the content side.

### Data model
```text
library/workouts/{planId}     ← admin-authored, world-readable
library/mealPlans/{planId}    ← admin-authored, world-readable
users/{uid}/libraryOptIns/{planId}  ← user accepts → "subscribed"
users/{uid}/workoutPlans/{id} ← copied from library on accept (existing user space)
users/{uid}/mealPlans/{id}    ← copied from library on accept
users/{uid}/notifications/{id} ← "New workout plan available" / etc.
```

### Firestore rules additions
- `library/{type}/{id}`: read = signed-in, write = admin.
- `users/{uid}/notifications/{id}`: owner read/update/delete; admin create.
- `users/{uid}/libraryOptIns/{id}`: owner full access; admin read.

### Admin UI (`/admin/content`)
- Tabs: **Workout Library** | **Meal Plan Library**.
- Each tab: list of plans (real-time), "Create plan" dialog (title, description, days, exercises/meals JSON-friendly form), Edit, Delete.
- "Publish" toggle (`status: draft|published`). Only published plans appear to users.
- On publish: write a notification to **every** active user OR to a chosen subset (defaults to "all users"); checkbox "Notify users now".

### User UX
- New `/library` page (linked in sidebar): shows published plans; "Add to my plans" button.
- Accepting writes the opt-in doc + clones the plan into the user's own `workoutPlans` / `mealPlans` so the existing pages keep working unchanged.
- `NotificationCenter` already exists — surfaces the new "New plan available" alerts with a CTA that opens `/library`.

### Activity log
Add `library.plan.publish`, `library.plan.optIn`, `library.plan.delete` action types.

## 5. Files touched

| File | Change |
|---|---|
| `src/lib/firebase.ts` | bucket via env, default to `firebasestorage.app` |
| `.env.example` | already has var, document new value |
| `src/contexts/AuthContext.tsx` | expose `needsOnboarding` |
| `src/App.tsx` | OnboardingGate + replace navigations |
| `src/pages/Auth.tsx` | `navigate(..., {replace:true})` |
| `src/pages/Onboarding.tsx` | compute + store targets, summary step |
| `src/lib/nutrition.ts` | new — formulas |
| `src/pages/Nutrition.tsx` | read `calorieTarget` from profile |
| `src/pages/Settings.tsx` | cache-buster on avatar URL |
| `firestore.rules` | library + notifications + opt-ins |
| `storage.rules` | unchanged content, just redeploy |
| `src/pages/admin/AdminContent.tsx` | full rewrite — library CRUD + publish |
| `src/pages/Library.tsx` | new — browse + opt-in |
| `src/components/layout/Navbar.tsx` | add "Library" link |
| `src/lib/activity.ts` | new action types |

## 6. After I implement

You must:
1. Verify the bucket name in Firebase Console → Storage and tell me if it's `appspot.com` or `firebasestorage.app` (I'll default to the new format).
2. Publish updated `firestore.rules` and `storage.rules` in Firebase Console.
3. Add "Storage" → set rules → publish if you haven't yet enabled Storage at all.

Reply **approve** to implement, or tell me what to drop/add.
