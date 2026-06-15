## Scope

Six related fixes across the user app. Admin features are out of scope this round.

### 1. Progress page — seed from onboarding + sync workouts
- On Progress mount, if `users/{uid}/weights` is empty AND `userProfile.weight` exists, auto-insert a starting weight entry so "Current Weight" / chart aren't blank.
- "Total Workouts" + "kg lifted" read from `users/{uid}/workoutLogs` (completed sessions). Wire `WorkoutSession` completion to write a log doc `{ planId, exercises, totalVolume, durationMin, completedAt }` and bump a `users/{uid}/stats/summary` counter. Progress page subscribes to that stats doc.
- "Personal Records" reads from existing `records` collection (already used by Records page).

### 2. Merge Workout + Library
- Keep `/workout-planner` route. Add a Tabs header: **My Plans | Library**. Library tab embeds the existing `Library.tsx` content (published admin plans + "Add to my plans").
- Remove Library link from `Navbar` (workout dropdown / single tab now covers it). `/library` route stays for back-compat.

### 3. Nutrition — "Adjust Goals" works
- Wire the button to open a dialog with editable `calorieTarget / protein / carbs / fat / fiber`. Save to `users/{uid}/profile/data`. "Reset to recommended" button recomputes via `computeTargets`.
- Verify Meal Planner add/save works (currently buttons are no-ops) — make cells open a small picker that saves to `users/{uid}/mealPlan/{weekKey}`.
- Barcode scanner: hook up to `@zxing/browser` via dynamic import on the existing scan button in Nutrition; on detect → Open Food Facts lookup → log meal.

### 4. Settings / Profile cleanup
- Remove the "Bio" field entirely (or replace with a short "Goal note" tied to `goalType` — going with remove for simplicity).
- Make Body Metrics editable (height, weight, dob, gender) and save to profile.
- Add Fitness Preferences card with `units: "metric" | "imperial"` toggle.

### 5. App-wide units
- New `useUnits()` hook reading `userProfile.units` (default `metric`).
- Helpers `formatWeight(kg, units)` and `formatHeight(cm, units)`.
- Apply on Progress (weight cards, chart axis), Records (lift weights), Nutrition (water already ml — leave), Settings display.
- All stored values stay canonical (kg / cm); only display converts. Input forms accept the user's unit and convert on save.

### 6. Support — proper ticket UX
- `Support.tsx` becomes a real two-pane interface: left = list of my tickets (status badges), right = open conversation with admin replies (already powered by `supportTickets/{id}/messages`).
- New ticket dialog: subject + category (Bug / Feature / Account / Other) + message + optional screenshot upload to `users/{uid}/support/{ticketId}/...`.
- Real-time updates via `onSnapshot`. Shows "Admin replied" toast + unread dot.

## Files to edit / create

- `src/pages/Progress.tsx` (seed weight, read stats)
- `src/pages/WorkoutSession.tsx` (log on complete)
- `src/pages/WorkoutPlanner.tsx` (tabs: My / Library)
- `src/pages/Library.tsx` (export inner component for embedding)
- `src/pages/Nutrition.tsx` (Adjust Goals dialog, barcode wiring)
- `src/pages/MealPlanner.tsx` (clickable cells, persistence)
- `src/pages/Settings.tsx` (remove bio, metrics + units)
- `src/pages/Support.tsx` (two-pane ticketing)
- `src/components/layout/Navbar.tsx` (drop Library link)
- `src/hooks/useUnits.ts` (new)
- `src/lib/units.ts` (new — converters/formatters)
- `src/lib/barcode.ts` (new — zxing + OFF lookup)
- `firestore.rules` (add `workoutLogs`, `stats`, `mealPlan` paths if missing)

## Out of scope (next round)
- Admin promotion notification UX polish
- Admin per-user plan assignment UI
- Admin analytics charts
