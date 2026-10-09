# FitX Journey — Admin Guide

Guide for the team running the platform: roles, each console section, and how
admin changes reach members. See [Role workspaces and offline workouts](Role-Workspaces-Offline.md) for the current deployment and offline behavior notes.

---

## 1. Access and roles

The console lives at `/admin`. Anyone without an admin record is redirected to
their member dashboard.

| Role | Label | Can open |
| --- | --- | --- |
| `admin` | Administrator | Overview, users, coaching assignments, content, activity, announcements, support, reports, settings |
| `moderator` | Moderator | Overview, member safety, activity, support |
| `staff` | Support staff | Overview, support, announcements (read only) |
| `coach` | Coach | Overview, assigned members and check-ins, content |
| `readonly` | Analyst | Overview, activity, reports (view only, no writes) |

Rules:
- Roles are stored per user, never editable by the member themselves.
- Only **Administrator** can change roles, branding, feature flags and run
  destructive actions.
- **Analyst** is strictly read-only — write controls are hidden or disabled.
- Each role lands on the first section it is allowed to see, so nobody sees a
  blank or forbidden page.

**Bootstrapping the first admin:** create an `admins/<auth-uid>` record with
`role: "admin"`. After that, add further admins from *Admin → Users*.

---

## 2. Navigation

The sidebar shows only the tools allowed for the signed-in role. Each role has its own workspace name, visual accent and dashboard priorities. Administrators manage coach assignments; coaches see their assigned members and record check-ins.

---

## 3. Overview

Each dashboard uses a role-specific focus panel, quick actions and metrics from bounded samples of recorded data. The UI identifies cached data and loading errors. Counts do not claim to be platform-wide totals.

---

## 4. Users (People command center)

- Live member list with avatar, name, email, **member code** (`FX-XXXXXX`),
  role badge and last-seen status.
- **Search** by name, email or member code.
- **View profile** — compact read-only snapshot: goal, body metrics, units,
  calorie target, signup date, last login and recent activity.
- **Role management** — promote or demote a member (admins only). Changes take
  effect on the member's next page load.
- **CSV export** of the filtered list, including member codes.
- Member-uploaded photos and name changes appear here automatically — they sync
  from the member's Settings page.

---

## 5. Content

Build what members see in their Coach Library and recipe sections.

- **Exercise search** — pull live exercises from the exercise database by name,
  body part or equipment, with animations and target muscles.
- **Recipe search** — pull live recipes with full nutrition data.
- **Multi-day plan builder** — create a plan, add days, and drop exercises or
  recipes into each day. Save and publish.
- Published plans appear for members under *Workout Planner → Coach Library* and
  in the recipe library; unpublished drafts stay hidden.
- Available to Administrators and Coach/Staff.

---

## 6. Activity

Live feed of what is happening in the app: sign-ups, sign-ins, workouts
completed, food logged, tickets opened, admin actions. Filter by type and date
range; charts show volume over time. If the feed looks empty, it simply means no
events have been recorded in the selected window.

---

## 7. Announcements

- Compose a title + body, choose a tone (info, success, warning), and target the
  audience (everyone, or a specific role/segment).
- Schedule or publish immediately, and set an expiry so stale notices disappear
  on their own.
- Published announcements surface on member dashboards and in the notification
  center.
- Edit or retract anything you have published.

---

## 8. Support

- Ticket queue with status (open / in progress / resolved), priority and
  category.
- Open a ticket to see the member's identity and member code, the full message
  thread, and reply inline.
- Change status and priority; resolved tickets stay searchable for history.

---

## 9. Reports

- Headline stats: total events, active days, peak activity day.
- Signup count with the date of the most recent signup.
- Activity-per-day bar chart with the peak day highlighted.
- **Top actions** — ranked list of the most common events with progress bars.
- Export for outside analysis.

---

## 10. Settings (Administrator only)

Changes here apply across the whole app for every member, live:

- **Branding** — upload a logo (shown in navbar, auth screens and admin header),
  set primary and accent colours, and choose corner radius. A live preview shows
  the result before you save.
- **App identity** — app name and tagline used in headers and metadata.
- **Feature flags** — turn modules on or off for members.
- **Defaults** — default unit system and theme for new accounts.

Because branding is served from global site settings, one save updates every
page instantly — no redeploy needed.

---

## 11. Data and security notes

- All member data is scoped per user; members can only read and write their own
  documents.
- Private fitness profiles and uploads are accessible to their owner and full administrators. Moderators read member summaries; support staff read tickets; coaches read assignments. Destructive/system writes require the full `admin` role.
- Team invitations must be created by a full administrator and consumed atomically with the exact invited role. Members cannot self-promote.
- Uploads are limited to 5 MB and image/PDF types; public assets are writable by
  full admins only.
- Third-party food and exercise lookups run through a server function so
  provider keys are never exposed in the browser.

---

## 12. Common tasks

| Task | Where |
| --- | --- |
| Promote a coach | Members & team → find member → Manage role → Coach |
| Find someone by member ID | Users → search `FX-…` |
| Publish a 5-day program | Content → new plan → add days → publish |
| Post maintenance notice | Announcements → warning tone → target everyone → set expiry |
| Change the logo everywhere | Settings → Branding → upload → save |
| Check yesterday's signups | Reports → signup stat / activity chart |
