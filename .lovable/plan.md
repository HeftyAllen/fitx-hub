# Real push notifications and mobile Account fix

## What will change
- Add an in-app control in Notification Settings to enable or disable browser push for the signed-in device, with clear states for unsupported browsers, blocked permission, preview iframes, and missing web-push configuration.
- Register Firebase Messaging safely from a user click and add a dedicated messaging service worker for background notifications. Keep the existing app-cache kill switch separate.
- Store each device registration securely in Lovable Cloud after validating the signed-in Firebase user; remove or disable the device registration on logout, account deletion, or user opt-out.
- Extend the admin announcement send action so an authorized admin/moderator/staff broadcast also sends a real push to eligible registered devices. Keep the existing in-app announcement flow intact.
- Respect announcement audience and member notification preferences where available, clean up stale Firebase tokens, and surface provider errors clearly.
- Redesign the mobile Account panel into compact, wrapping rows and stacked actions so email, member ID, verification, password, support, sign-out, and deletion controls stay within the screen.

## Security and reliability
- Verify Firebase identity tokens inside server functions before accepting device registrations.
- Re-check the sender’s admin role from Firebase before sending pushes; never trust a client-side role flag.
- Keep messaging credentials server-side and use the already connected Firebase Messaging service.
- Validate all request bodies, enforce practical size limits, and never expose other users’ device tokens to the browser.
- Use a Lovable Cloud table protected by row-level security and accessed only through validated server functions.

## Technical details
- Add a `push_subscriptions` table plus grants/RLS, indexed by Firebase user ID and unique registration token.
- Add `push-register` and `push-broadcast` edge functions using Firebase ID-token verification and the Firebase Messaging connector gateway.
- Add a browser helper/hook using Firebase Messaging, a dedicated `firebase-messaging-sw.js`, and public connector-provided Firebase web configuration.
- Update Settings, admin announcements, auth cleanup, Firestore rules only where required, and browser environment typings.
- Verify with focused tests and desktop/mobile browser checks. Browser permission prompts and actual delivery must be validated on the published app in a top-level tab, because embedded previews cannot request notification permission.
