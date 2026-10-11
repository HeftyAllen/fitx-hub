# Firestore rules compatibility

The complete `firestore.rules` file supports the current member and role-specific console screens. Publish it in the `fit-x-journey` project's **Firestore Database → Rules** tab. Publishing these rules changes permissions; it does not migrate, rename or delete existing documents.

## Existing flows checked

- New-account profile creation and onboarding; existing-account sign-in, profile/directory sync, settings, membership interest and account-deletion markers. Existing `role` and `suspended` fields survive ordinary merged profile edits.
- Owner reads, queries, creates, updates and deletes for workout plans/logs, food/nutrition logs, all existing meal-plan paths, groceries, weight, measurements, progress photos, records, challenges, calendar, library opt-ins, streaks and XP. Personal nested collections remain covered by the owner rule.
- Full-admin member management, role changes, content library publishing, announcements, custom flags and console queries.
- Full-admin invitations for all five roles, exact-role atomic acceptance, and member decline. The previous proposed rules omitted the UI's `readonly` invitation option; it is now supported.
- Member ticket history, text replies and attachment-only replies, plus administrator/moderator/staff responses and status changes. An attachment-only reply needs an HTTPS attachment URL; empty messages and access to someone else's ticket remain denied.
- Moderator suspension/reinstatement of existing members, including older accounts without a profile document. Moderators may create only the missing suspension record, without adding or reading health fields.
- Coach assignment creation, archive/re-enable, and cleanup. Administrators can archive stale assignments after the member or coach is removed; re-enabling requires a valid coach and member.
- Shared coach workouts/classes/nutrition programmes, client feedback, private coach notes, group publication, branding/history, feature disable/re-enable, membership grants and expiry.

## Intentional differences from the supplied old rules

The supplied old rules allowed a member to create their own `admins/{uid}` row with any role. Its recursive owner rule also allowed members to forge their own admin invitations. The updated rules require an administrator-issued invite and consume it in the same atomic operation as accepting the exact invited role.

Console permissions follow the current UI: full administrators control roles, branding, memberships, flags and announcements; moderators review summaries, suspend members and handle support; staff handle support and read announcements; coaches author content and work with assigned clients; analysts read summaries/reports/activity. The old shared staff/moderator administrator permission is intentionally replaced by these boundaries. An existing `admins/{uid}` record still determines the account's role and is not rewritten.

Existing features default to Free when access settings are absent. The new Community feature defaults to Disabled so members' navigation stays uncluttered. An administrator can intentionally disable or paywall a tool; the rules then block its new writes while preserving owner access to existing personal history for export and deletion. Shared community reads require current group membership and Community access, including membership expiry.

Community groups use protected `communityGroups` and `communityMemberships` collections. Coaches can enrol only active assigned clients. Membership and the member's group index change atomically; members cannot self-enrol or reinstate themselves. Archiving the underlying coaching assignment, removing the group membership, suspending the member or disabling/paywalling Community revokes shared access. Moderators can review private reports and remove content or members, but cannot add clients, publish activities or edit access policies.

Chat writes validate the authenticated sender, group role, server timestamp, replies, text length and each person's own emoji reaction. Presence updates cannot change membership fields or forge future read receipts. Member workouts remain drafts until a coach publishes them; members can improve each other's drafts, while bookings and feedback remain owned by their authenticated author. Nutrition and training activity actions also respect their existing feature policies. These rules add shared collaboration without exposing private health records or private coach notes.

The emulator suite includes positive regression checks for these workflows and negative checks for cross-member access, self-promotion and role spoofing. It does not publish rules to production. Firebase Authentication/email settings and Firebase Storage rules are configured separately.
