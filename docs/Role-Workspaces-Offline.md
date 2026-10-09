# Role workspaces and offline workouts

This update builds on the existing React / TypeScript web app.

## Role responsibilities

| Role stored in `admins/{uid}` | Workspace | Actions |
| --- | --- | --- |
| `admin` | Control room | Manage members and team roles, assign coaches, publish plans and announcements, answer support, review reports, change platform settings |
| `moderator` | Community desk | Review member summaries and activity, suspend or reinstate members, answer support; cannot edit private fitness data or team roles |
| `staff` | Support desk | Answer and close support tickets, read announcements |
| `coach` | Coaching studio | Read assigned members, record check-ins, create and publish workout and meal plans |
| `readonly` | Insights desk | Read summary reports and activity; cannot change team resources |

Every role lands on a tailored `/admin` dashboard. Navigation and direct routes use the same role matrix, and Firestore / Storage rules enforce the corresponding data boundaries. Roles are taken from the protected Firestore registry; email addresses no longer grant administrative access.

Existing `staff` accounts remain support staff. Grant `coach` to people who should author plans and work with assigned members. No automatic migration can determine which existing staff accounts were actually coaches.

An administrator connects a member to a coach at **Coach assignments**. The coach sees only their assignments at **My members**. Check-ins live under `coachAssignments/{assignmentId}/checkIns`. These notes are accessible to that coach and administrators. They do not expose the member's private food logs, weight, progress photos or other fitness records.

## Offline behavior

- Production builds precache the app shell and bundled assets. A returning visitor can reopen previously visited routes offline after the first successful cache installation.
- Firestore retains previously loaded user data on the device. Unvisited records and external exercise / recipe searches need internet access.
- Workout session sets, notes, exercise position and elapsed active time are saved as a draft scoped to the signed-in user. Use **Resume workout** in the planner to recover after a reload or restart. Time spent with the app closed is not counted, and rest timers restart rather than resuming an old countdown.
- **Finish** first stores the completed workout in IndexedDB. A global sync queue submits it when connected. Retries use the same document ID, so repeating a request cannot create another log.
- The status indicator reports a clear queue, pending workouts, sync in progress or rejected writes. Failed entries stay on the device and can be retried. Only the signed-in account's queue is processed.
- Team actions, role changes, check-ins, broadcasts and publishing require a connection. They are not stored in the workout queue.
- Authentication requires a prior successful sign-in; a new account cannot sign in offline. Clearing browser storage removes drafts and unsynced workouts. Signing out keeps the account-scoped workout queue for that account's next sign-in.
- Firestore data is retained locally on this device. Use a personal device for offline access. This release does not add a shared-device cache-clearing flow.

The Firebase messaging worker imports the same app-shell worker. Existing messaging registrations are retained rather than replaced at startup. New app builds wait for existing tabs to close before taking control.

## Deployment

1. Review and merge the pull request into the branch connected to Lovable or the current hosting pipeline.
2. Verify that at least one trusted administrator already has an `admins/{uid}` document. The first administrator must be created through the Firebase console or trusted server tooling; ordinary users cannot create their own role.
3. Publish the updated `firestore.rules` and `storage.rules` to the existing Firebase project. These files are required for the access separation and new coaching collection to work.
4. Redeploy the changed Supabase `push-broadcast` function. Its backend allowlist now permits only administrators, matching announcement publishing in the UI.
5. Grant coaching roles explicitly and create assignments from the administrator workspace.

No production rules or Supabase function are deployed by the development checks. The local test commands use the isolated `demo-fitx-workspaces` project and Firebase emulators.

## Verification commands

Use Node 22 or later. The pinned Firebase CLI used by these scripts supports Java 17; Java 21 also works.

```sh
npm ci
npm run typecheck
npm test
npm run test:rules
npx playwright install chromium
npm run test:e2e
npm run build
```

`test:e2e` builds in the explicit `e2e` mode. Only that mode, served from localhost, connects to the emulators. Use the ordinary `build` command for production.

The dashboard labels its bounded samples (up to 500 members, 100 tickets / events / assignments, or 200 workout plans) rather than claiming platform-wide totals. Reports use member summary timestamps and the latest 1,000 activity events; analysts do not fetch private member profiles.

Verified: production build and type check pass, along with 9 unit tests, 9 Firebase rules tests and 7 browser tests. Browser tests cover all five desktop / mobile workspaces, direct-route permissions, coach check-ins, offline recovery and exactly one server log after reconnecting.

The repository-wide lint check still reports 220 errors (the original revision reports 224). Targeted lint for the new modules has no errors and two React Fast Refresh export warnings. The production build also retains a large-bundle warning.
