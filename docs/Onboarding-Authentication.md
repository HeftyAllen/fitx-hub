# Onboarding and sign-in recovery

A successful Firebase sign-in means authentication completed. It does not mean the member finished setup. The directory now shows **Setup incomplete** for a signed-in member whose profile has no goal; the badge disappears when setup is committed. Older completed profiles remain compatible through their existing `goalType`.

## Member flow

- Height and weight accept decimal dots and commas, including `169,5`. Values are normalised before calculating targets and saving the profile.
- Unit buttons convert an entered measurement rather than reinterpret the same number as feet or pounds. Invalid measurements and dates show guidance beside the blocked step.
- Google sign-in pre-fills the member's name. Unfinished answers and the current step survive reloads in the same tab, stored separately for each authenticated UID. The local draft is cleared after completion.
- Completion uses a Firestore transaction for the profile, member directory, and missing starter XP/streak documents. Existing progress and original join timestamps are preserved. A failed save leaves the form and draft available for retry.
- Profile read failures show **Try again** and **Sign out**, rather than treating an unreadable profile as a new member and restarting onboarding. Late callbacks from another account are ignored.
- Sign-in errors explain the next action. A Google-only account should use **Continue with Google**; creating that account does not automatically create an app password. Password recovery remains available for password accounts. Account-existence errors share generic recovery guidance.

## Firebase compatibility

No additional rules change is required for this fix: profile, directory, XP and streak writes use the existing owner permissions. No role, membership grant or feature policy is changed. Production Firebase rules remain a manual publish for the separate Community release.

## Verification

Regression coverage includes comma decimals, unit conversion, exact birthday validation, per-account draft isolation, profile read recovery and stale identity callbacks. Emulator browser tests cover password signup and Google-account onboarding, returning member sessions, live admin completion status, reload recovery, denied reads, denied saves and preserved XP/streaks/join dates. Google's external popup transport is blocked in the isolated test environment; the Google case uses a real emulator-issued Auth SDK session restored through ordinary browser persistence. Existing member, coach, support, moderator and administrator flows are exercised in the same browser suite.
