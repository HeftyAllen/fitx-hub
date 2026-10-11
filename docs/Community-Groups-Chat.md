# Community groups and live conversations

## Enable Community

1. Publish the entire repository `firestore.rules` in **Firebase → fit-x-journey → Firestore Database → Rules**. This release does not require a change to `storage.rules`; community conversations contain text and emoji.
2. As a full administrator, open **Platform settings → Feature access → Community**.
3. Select **Free**, **Premium** (Plus or Pro), or **Disabled** and publish feature access. Community starts Disabled when no policy has been published.

Free exposes Community under **Keep exploring**, accessible through the single mobile **More** menu. Disabled removes it from member navigation and displays an unavailable notice on direct links. Premium keeps a locked entry and displays membership information for members without the required plan or an individual Community grant. Changes sync to signed-in sessions. Disabling the feature retains existing data, and re-enabling restores access to active memberships.

Admin, coach and moderator workspaces have a Community section. Support staff and analysts retain their existing workspaces. The team can prepare and moderate groups while the member feature is disabled. Only full administrators can change feature access or membership grants.

## Groups and privacy

- Administrators assign coaches through the existing Coaching section. A coach then creates a named, coloured group and invites their active assigned clients. Administrators can create groups for registered coaches.
- Creation supports up to 40 invitations at once, sent in small atomic batches. If an invitation cannot sync, the UI reports it and the host can add missing clients in Members.
- Hosts can add or remove assigned clients, archive a group and reopen it. Moderators can remove members, but cannot add members or replace the coach.
- Conversations and group activity feedback are shared with active participants and authorised moderators. Private member health records, individual programmes and private coach notes retain their existing permissions. Use **My coach** or **Support** for private details.
- Group access also depends on the referenced coaching assignment staying active. Removed members cannot rejoin themselves. Membership indexes are protected separately from owner-editable personal data.

## Conversation

Conversations sync through Firebase listeners. The UI includes message bubbles, sender labels, day dividers, emoji insertion, per-person reactions, replies, typing indicators, sent/read indicators, a jump to new messages and earlier history. Loaded history continues to receive edits, reactions and removals. Members can edit their own messages for 15 minutes and delete their own messages. Hosts and moderators can remove inappropriate content. Reporting is private to administrators and moderators, including when the reported message is in older history.

Read indicators represent active participants viewing the conversation, not proof that a person understood a message. Text drafts are stored for the current account and group in the browser tab and survive a reload. Sending, reacting and shared updates require a connection; offline status is shown and unsent drafts are kept. No attachment uploads, voice notes, hosted calls or end-to-end encryption are included in this release.

## Shared activities

| Activity | Coach/admin | Members |
| --- | --- | --- |
| Workout | Share or edit exercises; approve drafts; withdraw/republish | Create and collaboratively edit drafts; start approved workouts; save to Training; share completion/feedback |
| Class | Publish local date/time, instructions and optional HTTPS meeting link | Book/cancel, see group bookings, open the class link, save a Calendar reminder |
| Nutrition | Share meal and portion guidance | Read guidance and share updates, subject to Nutrition access |
| Challenge | Share group challenge instructions | Join and self-report completion, subject to Records or Rewards access |
| Announcement | Share group-specific updates | Read and acknowledge or comment through the conversation |

Members' draft edits detect conflicting revisions and ask the editor to reopen the latest version rather than overwrite someone else's changes. Activity completion is self-reported. Group challenges do not automatically grant XP or verify attendance. Classes use an external meeting service or a location supplied by the coach. Calendar reminders are personal saved copies; members should check the group for later schedule changes.

## Phone layout fixes

The member top-left menu button has been removed; the bottom More menu provides the same navigation. Account settings use a bounded grid and wrapping action rows. Calendar uses bounded grid tracks, non-shrinking meal thumbnails and wrapping nutrition summaries, including days with meals only. Class reminders link back to the shared activity.

## Checks

`npm run typecheck`, `npm test`, `npm run test:rules`, `npm run test:e2e` and `npm run test:pages` cover typing, activity validation, original permission regressions, community privacy, enrolment/role forgery, disabled/paid access, chat and presence integrity, shared drafts, bookings, moderation and phone layouts. These checks use demo emulators and never publish production Firebase rules.
