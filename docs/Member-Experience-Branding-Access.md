# Member experience, branding and feature access

The member app now has a responsive sidebar, phone navigation and consistent page headers. Today shows the member's recorded sessions, weekly target, training streak, weight, records, food diary totals, hydration, challenges and existing smart suggestions. Workout planning, session recovery, profile editing, meal tools, support and account actions remain available by default. The grocery page accepts both `/grocery` and `/grocery-list`.

Page entrances, the active navigation indicator, chart bars, cards and buttons have motion. The operating system's reduced-motion preference is respected. Administrators can also select reduced motion for the app.

## Brand studio

Administrators open **Platform settings → Brand studio** to edit:

- App name, installed-app short name, tagline, footer and support links.
- Main and dark-mode logos, browser icon and landing image. Upload PNG, JPEG, WebP or ICO files up to 2 MB, or enter an HTTPS URL or an app-relative image path.
- Primary and accent colours, light and dark backgrounds, fonts, corner radius and motion.
- Landing headline, description and button; sign-in copy; Today welcome copy; sidebar notes.
- A member announcement, a maintenance notice and visibility of new-account registration.

Changes stay in the draft until **Publish brand**. Switching between Brand studio and Feature access preserves the draft. A preview can be switched between light and dark. **Discard** reloads the current published version. Previous publications can be loaded into a draft and published again; an administrator cannot silently overwrite a newer publication from another administrator.

The published settings are a single shared Firestore document. Connected member, team, landing and sign-in screens subscribe to it. Theme variables, document title, favicon, notification fallback title and web-app manifest update from the same settings. Public brand settings are cached for returning offline visitors. Remote image URLs still depend on the browser's image cache. Browsers may take time to refresh an already installed app's name or icon; reinstalling can refresh those operating-system shortcuts.

The maintenance switch displays a notice and leaves existing sessions usable. Registration visibility controls this app's interface; it does not disable Firebase Auth account creation through another client. Enforcing a provider-wide signup pause requires trusted Firebase authentication configuration or a blocking function.

## Feature access

In **Platform settings → Feature access**, every tool can be **Free**, **Premium** or **Disabled**. Premium tools require an active Plus or Pro plan, or an explicit feature grant. The administrator can rename member-facing features and write the unavailable or upgrade message.

| Control | Includes | Parent requirement |
| --- | --- | --- |
| Training | Workout planner, workout session, exercise library | None |
| Nutrition | Food diary, water and nutrition targets | None |
| Recipes | Recipe search and saved recipes | Nutrition |
| Meal planner | Meal plans and meal entries | Nutrition |
| Barcode scanner | Barcode food lookup | Nutrition |
| Grocery list | Shopping lists and ingredient additions | Nutrition |
| Progress | Weight, measurements and progress-photo records | None |
| Personal records | Achievements and challenges | None |
| Calendar | Workout scheduling and events | None |
| Rewards | Badges and member rewards | None |
| Coach library | Published workout and meal templates | Related Training or Meal planner access also required |

For example, publishing **Nutrition → Disabled** hides Nutrition and its child tools from menus and blocks their direct routes and embedded tabs. Re-enabling Nutrition restores the saved data. If Nutrition becomes Premium, free members see the upgrade experience; a child cannot bypass the parent's plan requirement. Disabling any feature overrides all memberships and individual grants. Full administrators retain preview access; other team roles do not bypass member paywalls.

Profile, Today, membership information, support, exports and account actions remain available. Existing private history can still be read and deleted by its owner for data export and cleanup. Firestore rules reject new or updated records for controlled tools without access. Published library templates are also protected by their feature requirements. Firebase-authenticated food API calls check Nutrition and barcode access on the server. External exercise and recipe APIs remain third-party services; their client-side API keys do not become protected secrets through these controls.

All features default to Free when the access settings document is absent, preserving existing accounts. Public configuration and membership updates sync to connected screens. Returning offline members use the last verified device cache, and access expires locally at its timestamp. A device that is offline cannot learn about a subsequent revocation or disable until it reconnects; the server still rejects unauthorized writes. Unsynced workout completions remain on the device if access changes before synchronization.

## Memberships and payment links

**Platform settings → Memberships** lets administrators find a member and assign Free, Plus or Pro, add individual feature grants, choose an optional expiry date, or revoke premium access. Expiry applies to both the plan and grants. A Nutrition child needs the parent grant or appropriate parent plan as well. Memberships are protected in `memberAccess/{uid}`; members cannot set their own entitlement by editing their profile.

The member's **Membership** page shows the verified plan and effective included tools. Plan names, display prices, upgrade text and an HTTPS membership or checkout link are configurable. If no link is configured, the app directs members to support.

Prices and a checkout link do not charge a card or automatically grant membership. This release uses administrator-confirmed memberships. Automated subscription billing needs a payment-provider integration with a verified server webhook that updates the protected entitlement; a browser return URL is not proof of payment.

## Rollout

1. Retain a trusted `admin` document in the protected `admins/{uid}` registry.
2. Publish `firestore.rules` and `storage.rules` to the existing Firebase project. This enables protected memberships, settings history, branded uploads and feature write enforcement.
3. Publish the ordinary frontend production build through the existing hosting pipeline. Use `npm run build`; the `e2e` build connects only to local test emulators.
4. Redeploy Supabase `fatsecret` with its shared Firebase authentication/access modules. The frontend supplies its Firebase ID token in `x-firebase-token`; Supabase Auth is not the identity provider. Deploy with `--no-verify-jwt`, because the function verifies Firebase tokens itself. Its shared authentication module currently targets the existing Firebase project `fit-x-journey`; keep the existing FatSecret credentials.
5. Also redeploy the previously changed `push-broadcast` function described in [Role workspaces and offline workouts](Role-Workspaces-Offline.md).
6. Publish the desired brand and feature configuration, then assign confirmed member plans.

No production rules or functions are changed by the local verification. Deploy the new frontend before enforcing the new food-proxy header, so old clients are not unexpectedly rejected. Default-free access allows the rollout without pre-populating membership documents.

## Verification

`npm test`, `npm run typecheck`, `npm run test:rules`, `npm run test:e2e` and `npm run build` cover the shared policy, expiry and parent relationships; protected entitlements and storage; the five team workspaces; member routes and real profile/grocery/hydration writes; offline workout recovery; cross-tab branding and manifest caching; disable/re-enable/paywall behavior; and live membership grant/revoke behavior. Browser screenshots in `docs/screenshots` show the finished screens.

New branding and access modules have no ESLint errors. The repository retains older lint issues and the production build's existing large-bundle warning.
