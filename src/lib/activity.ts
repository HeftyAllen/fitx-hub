import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export type ActivityAction =
  | "auth.login"
  | "auth.signup"
  | "auth.logout"
  | "workout.create"
  | "workout.complete"
  | "plan.create"
  | "plan.delete"
  | "meal.log"
  | "admin.role.change"
  | "admin.user.suspend"
  | "admin.user.delete"
  | "admin.announcement.send"
  | "admin.flag.toggle"
  | "admin.settings.update"
  | "support.ticket.open"
  | "support.ticket.reply";

export async function logActivity(action: ActivityAction, meta: Record<string, any> = {}) {
  const u = auth.currentUser;
  if (!u) return;
  try {
    await addDoc(collection(db, "activityLogs"), {
      userId:    u.uid,
      userEmail: u.email ?? null,
      action,
      meta,
      createdAt: serverTimestamp(),
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    });
  } catch (e) {
    // swallow — never block UX on logging
    // eslint-disable-next-line no-console
    console.warn("[activity] log failed", e);
  }
}
