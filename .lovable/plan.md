# Dashboard & Nutrition Overhaul — Phase 1

## Pre-work: Secrets & Backend

Right now the app is Firebase-only (client SDK) with API keys baked into the bundle. FatSecret OAuth2 requires a **server-side** token exchange — the Client Secret cannot ship in the browser.

**Required:** Enable **Lovable Cloud** so we get an edge-function runtime + secret storage. Without it, FatSecret cannot be integrated securely.

You should also **rotate the FatSecret Client Secret you posted in chat** — treat the one you sent as burned.

Once Cloud is on, I'll store `FATSECRET_CLIENT_ID` and `FATSECRET_CLIENT_SECRET` via the secrets tool and proxy all FatSecret calls through an edge function (`/fatsecret-proxy`) that caches OAuth tokens.

---

## Workstream A — Dashboard Redesign

1. Remove "Today's Macros" card from `Dashboard.tsx`.
2. Compact "Quick Actions" — move to top, reduce padding, single horizontal row on desktop / 2-row grid on mobile.
3. Remove standalone "Daily Motivation" card.
4. New **Suggestions card** (see Workstream B).
5. Sync fix pass: Active Challenges, Recent Workouts, Volume This Week, Today's Workout — all read from the same Firestore collections used elsewhere (audit + dedupe).

## Workstream B — Intelligent Suggestions Engine

New module `src/lib/suggestions.ts` producing a ranked list of insight cards:
- **Motivation** — quote bank (`src/lib/quotes.ts`, ~150 entries), deterministic daily pick by date+uid hash, last-7-days exclusion.
- **Workout calorie prediction** — MET-based estimator using today's planned exercises (sets × reps × est. MET × bodyweight).
- **Nutrition suggestion** — branches on `goalType` + today's workout intensity.
- **Recovery alert** — streak detector on workout logs (≥6 consecutive days → warn).
- **Calorie compliance** — time-of-day aware (after 6pm, flag >300 kcal gap).
- **Performance insights** — PR detection, volume trend over last 4 weeks.
- **Plateau detection** — 3–4 week weight stagnation vs. goal direction.

Rendered in `Dashboard.tsx` as a single carousel/stack with up to 4 active suggestions, motivation always pinned.

## Workstream C — Onboarding & Goal Targets

- Add weight-pace selector to `Onboarding.tsx` (lose/gain 0.25, 0.5, 1.0 kg/wk + maintain).
- Update `src/lib/nutrition.ts` `computeTargets` to use pace (1 kg/wk ≈ ±1100 kcal/day, 0.5 ≈ ±550, etc.) instead of fixed deltas.
- Persist `weeklyPace` and `nutritionPreference` (high-protein / balanced / low-carb / high-carb / higher-fat / custom split) on profile.
- All consumers (Dashboard, Nutrition, MealPlanner, Suggestions, Progress) read from one helper.

## Workstream D — Nutrition Module Fixes

- Fix **Copy Yesterday**: pull full `foodLog/{yesterday}` doc, write to today preserving meal buckets + macros.
- **Meal target distribution**: default 25/30/30/15 split (breakfast/lunch/dinner/snack), user-adjustable in goals dialog, totals must equal daily target.
- Surface per-meal target + progress in each meal section.

## Workstream E — FatSecret Migration (Food Logging + Barcode)

- Edge function `fatsecret-proxy` with endpoints: `search`, `barcode`, `food` (details), `autocomplete`.
- Client `src/lib/fatsecret.ts` wraps the proxy.
- Replace Spoonacular calls in `Nutrition.tsx` food search + portion editor.
- Replace ZXing → FatSecret barcode lookup on scan.
- Keep Spoonacular for **recipes only** (Workstream F).
- Map FatSecret servings into portion editor (branded, generic, restaurant where available).

## Workstream F — Recipes & Meal Planning

- Broaden Spoonacular search params (drop overly strict filters, raise `number` to 24, add cuisine/meal-type/keyword).
- Reliable diet filters: Paleo, Vegan, Vegetarian, Whole30, Keto, Mediterranean, High-Protein, Low-Carb.
- **Saved presets** under `users/{uid}/recipePresets`.
- Meal plan generator auto-seeds from onboarding (calories, diet, intolerances) with manual override.

## Workstream G — Barcode + Grocery List

- Remove dedicated UPC page.
- Unified scan workflow inside Nutrition: scan → show product → buttons "Add to Diary" + "Add to Grocery List".
- New page `src/pages/GroceryList.tsx` backed by `users/{uid}/groceryList`.

---

## Suggested Execution Order

Because each workstream is large, I recommend shipping in **three sub-phases** rather than one mega-commit:

1. **Phase 1a** — Cloud enablement + FatSecret edge function + Onboarding pace/goals refactor + nutrition targets sync. (Foundations everything else depends on.)
2. **Phase 1b** — Dashboard redesign + Suggestions engine + sync fixes.
3. **Phase 1c** — Nutrition fixes (Copy Yesterday, meal targets), FatSecret swap in Food Log + Barcode, Grocery List, recipe filter improvements.

## Confirmations needed before I start

1. **Approve enabling Lovable Cloud?** (Required for FatSecret.)
2. **Confirm you've rotated the FatSecret secret** you pasted — I'll request the new one via a secure form, not chat.
3. **Proceed sub-phase by sub-phase** (1a → 1b → 1c) as above, or do you want me to attempt it all in one pass?
