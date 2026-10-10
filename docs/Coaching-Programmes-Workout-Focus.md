# Shared coaching and focused workout sessions

The workout screen keeps the active exercise and set controls in the main column, with progress and the exercise lineup alongside. It uses the shared brand colours, light/dark theme, and motion preference. Reps and weights have explicit labels; a logged set can be reopened to correct it. Rest is an inline card. Pausing freezes both elapsed time and an active rest countdown. Draft recovery and the durable, idempotent completion queue are retained.

## Coach and member workflow

1. An administrator grants the Coach role and assigns clients in **Coach assignments**. Coaches see only their own assignments; moderators do not receive coaching access.
2. In **My members**, select a client and create a programme:
   - **Home workout:** exercise names, equipment, sets, reps, rest, duration, and instructions.
   - **Gym / online class:** date/time, duration, optional exercises, and an optional HTTPS meeting link. Dates are stored in UTC and displayed in each member's local time. The app shares a link; it does not create or host a video room.
   - **Nutrition plan:** coach-written meals, portions, substitutions, and daily guidance. Instructions do not automatically populate the food diary or generate nutrition totals.
3. Publish atomically to up to ten active assigned clients. A failed publication does not leave a partial roster. Each client receives a separate programme document and private feedback record.
4. Members open **My coach** from their menu, start the supplied workout, save it to Training, open a class link, or read nutrition guidance. An existing workout draft is preserved by sending the member to Training to resume or discard it before starting a different workout.
5. Members share feedback and explicitly mark a programme complete. Updates appear live in the coach's selected-client view. This is member-reported completion; it does not claim verified attendance or expose private workout, food, weight, or photo records.
6. Withdraw a programme for the selected client, or archive an assignment as administrator to end further sharing and feedback. Previously copied personal workouts remain the member's own plans.

Team check-ins remain private to the coach and administrators. Shared programmes and feedback are separate from those notes.

## Access and offline behaviour

`/coaching` uses the **Coach library** feature control. Training access also governs shared workouts/classes; Nutrition access governs meal guidance. Member updates require the related feature and an active assignment. Default access is Free. The future Pro preview describes enhanced coaching insights rather than charging for these current programmes.

Previously loaded coaching information can be viewed offline. Publishing, withdrawal, saved-plan writes, and feedback require a connection. Completed workouts use the existing offline queue; programme completion is marked separately after returning to My coach. There is no offline coaching-feedback queue.

## Data boundaries and deployment

- `coachAssignments/{assignmentId}`: administrator-controlled relationships. Coaches read their own relationships; members read their own active relationships.
- `coachAssignments/{assignmentId}/programmes/{programmeId}`: created by the assigned coach or administrator. Members read published programmes for their own active assignment. Withdrawal changes only status and timestamp; members cannot rewrite coach content.
- `coachAssignments/{assignmentId}/responses/{programmeId}`: the assigned member writes bounded feedback and status for an existing published programme. Other clients and coaches cannot forge responses.
- `coachAssignments/{assignmentId}/checkIns/{checkInId}`: private team notes; member read access remains denied.

**Publish the updated Firestore rules to `fit-x-journey` before production shared-programme sync can work.** Local tests and the GitHub Pages workflow do not deploy these rules. From an authenticated Firebase CLI, run:

```sh
npx firebase-tools deploy --only firestore:rules --project fit-x-journey
```

Review the wider rollout in [Member experience, branding and feature access](Member-Experience-Branding-Access.md); this rules file also includes previously authored role and membership protections. No Firebase or Supabase server changes are made by the Pages workflow.

## Verification

Unit checks cover validation, safe links, per-client workout identities, and route access. Emulator rules tests cover role boundaries, private notes, atomic publication, truthful feedback, withdrawal, archived assignments, and feature policies. Browser checks cover set corrections, rest extension/pause, navigation, notes, recovered values, phone layouts, live publication/feedback, group classes, nutrition disable/re-enable, and withdrawal. Earlier role, feature, membership, branding, and exactly-once offline checks remain in the suite.
