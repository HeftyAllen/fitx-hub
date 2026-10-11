import type { User } from "firebase/auth";
import { doc, runTransaction, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import { computeTargets } from "./nutrition";
import { firstIncompleteStep, parseMeasurement, type OnboardingProfile } from "./onboarding";

export async function saveOnboardingProfile(user: User, profile: OnboardingProfile) {
  if (firstIncompleteStep(profile) !== null) throw new Error("Complete your profile, goal and experience before finishing setup.");
  const normalised = { ...profile, name: profile.name.trim(), height: String(parseMeasurement(profile.height)), weight: String(parseMeasurement(profile.weight)) };
  const refs = {
    profile: doc(db, "users", user.uid, "profile", "data"), directory: doc(db, "users", user.uid),
    streaks: doc(db, "users", user.uid, "streaks", "data"), xp: doc(db, "users", user.uid, "xp", "data"),
  };
  // Commit completion and starter data together. Retrying must preserve existing
  // XP/streaks and must never mark an account ready after only a partial save.
  await runTransaction(db, async transaction => {
    const [saved, directory, streaks, xp] = await Promise.all([
      transaction.get(refs.profile), transaction.get(refs.directory), transaction.get(refs.streaks), transaction.get(refs.xp),
    ]);
    const completedAt = saved.data()?.onboardingCompletedAt ?? directory.data()?.onboardingCompletedAt ?? serverTimestamp();
    transaction.set(refs.profile, {
      ...normalised, ...computeTargets(normalised), onboardingCompletedAt: completedAt, updatedAt: serverTimestamp(),
      ...(!saved.data()?.createdAt ? { createdAt: directory.data()?.createdAt ?? serverTimestamp() } : {}),
    }, { merge: true });
    transaction.set(refs.directory, {
      uid: user.uid, email: user.email, name: normalised.name, onboardingCompleted: true, onboardingCompletedAt: completedAt,
      ...(!directory.data()?.createdAt ? { createdAt: saved.data()?.createdAt ?? serverTimestamp() } : {}),
    }, { merge: true });
    if (!streaks.exists()) transaction.set(refs.streaks, { current: 0, best: 0, lastActiveDate: null });
    if (!xp.exists()) transaction.set(refs.xp, { total: 0, level: 1 });
  });
}
