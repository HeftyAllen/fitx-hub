import { getBytes, ref, uploadBytes, deleteObject } from "firebase/storage";
import { before, after, beforeEach, test } from "node:test";
import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
  Timestamp,
  collection, getDocs, query, where, orderBy, FieldPath, deleteField,
} from "firebase/firestore";
let env;
before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-fitx-workspaces",
    firestore: {
      host: "127.0.0.1",
      port: 8085,
      rules: readFileSync("firestore.rules", "utf8"),
    },
    storage: {
      host: "127.0.0.1",
      port: 9199,
      rules: readFileSync("storage.rules", "utf8"),
    },
  });
});
after(async () => {
  await env?.cleanup();
});
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const role of ["admin", "moderator", "staff", "coach", "readonly"])
      await setDoc(doc(db, "admins", role), { role });
    await setDoc(doc(db, "users", "member"), {
      name: "Member",
      suspended: false,
    });
    await setDoc(doc(db, "users", "member", "profile", "data"), {
      name: "Member",
      suspended: false,
      weight: 80,
    });
    await setDoc(doc(db, "users", "other"), { name: "Other" });
    await setDoc(doc(db, "supportTickets", "ticket"), {
      userId: "member",
      subject: "Help",
      status: "open",
    });
    await setDoc(doc(db, "coachAssignments", "assigned"), {
      coachId: "coach",
      memberId: "member",
      memberName: "Member",
      goal: "Consistency",
      status: "active",
    });
    await setDoc(doc(db, "coachAssignments", "foreign"), {
      coachId: "other",
      memberId: "other",
      memberName: "Other",
      goal: "Consistency",
      status: "active",
    });
  });
});
const dbFor = (uid) => env.authenticatedContext(uid).firestore();
test("existing members can sign in, edit settings, and record deletion without changing legacy role fields", async () => {
  await env.withSecurityRulesDisabled(async ctx => {
    await updateDoc(doc(ctx.firestore(), "users", "member"), { role: "user" });
    await updateDoc(doc(ctx.firestore(), "users", "member", "profile", "data"), { role: "user" });
  });
  const db = dbFor("member");
  const summary = { name: "Jamie Morgan", email: "jamie@example.com", uid: "member", memberCode: "FX-ABC123", lastLoginAt: serverTimestamp() };
  const settings = writeBatch(db);
  settings.set(doc(db, "users", "member"), { ...summary, membershipInterest: "plus" }, { merge: true });
  settings.set(doc(db, "users", "member", "profile", "data"), { ...summary, greetingName: "Jamie", goalType: "lose_fat", daysPerWeek: 3, membershipInterest: "plus" }, { merge: true });
  await assertSucceeds(settings.commit());
  const profile = await assertSucceeds(getDoc(doc(db, "users", "member", "profile", "data")));
  if (profile.data().role !== "user" || profile.data().suspended !== false) throw new Error("Legacy profile fields were changed");
  await assertSucceeds(updateDoc(doc(db, "users", "member"), { deleted: true, deletedAt: serverTimestamp() }));
  await assertFails(getDoc(doc(dbFor("other"), "users", "member", "profile", "data")));
});
test("new-member onboarding and existing member collections retain owner CRUD when features default to Free", async () => {
  const fresh = dbFor("new-member");
  await assertSucceeds(setDoc(doc(fresh, "users", "new-member"), { name: "New member", createdAt: serverTimestamp() }));
  await assertSucceeds(setDoc(doc(fresh, "users", "new-member", "profile", "data"), { name: "New member", goalType: "maintain", weight: 80 }));
  const db = dbFor("member");
  for (const path of ["workoutLogs", "workoutPlans", "foodLogs", "nutritionLogs", "mealPlan", "mealPlans", "mealPlanEntries", "groceryList", "weightLogs", "measurements", "progressPhotos", "personalRecords", "joinedChallenges", "calendarEntries", "libraryOptIns", "streaks", "xp"]) {
    const entry = doc(db, "users", "member", path, "legacy-entry");
    await assertSucceeds(setDoc(entry, { value: "existing format", createdAt: serverTimestamp() }));
    await assertSucceeds(getDoc(entry));
    await assertSucceeds(getDocs(collection(db, "users", "member", path)));
    await assertSucceeds(updateDoc(entry, { value: "updated" }));
    await assertFails(getDoc(doc(dbFor("other"), "users", "member", path, "legacy-entry")));
    await assertSucceeds(deleteDoc(entry));
  }
  // Existing nested personal data is still covered by the recursive owner rule.
  await assertSucceeds(setDoc(doc(db, "users", "member", "customData", "parent", "entries", "child"), { value: 1 }));
});
test("full admins retain member management, global content, announcements, flags and console queries", async () => {
  const db = dbFor("admin");
  await assertSucceeds(getDocs(collection(db, "users")));
  await assertSucceeds(getDocs(collection(db, "admins")));
  await assertSucceeds(updateDoc(doc(db, "users", "member", "profile", "data"), { weight: 78 }));
  for (const path of ["library_workouts", "library_mealPlans", "announcements", "featureFlags"]) {
    const entry = doc(db, path, "existing-action");
    await assertSucceeds(setDoc(entry, { title: "Existing content", enabled: true, createdAt: serverTimestamp() }));
    await assertSucceeds(getDocs(collection(db, path)));
    await assertSucceeds(updateDoc(entry, { title: "Edited content" }));
    await assertSucceeds(getDoc(doc(dbFor("member"), path, "existing-action")));
    await assertSucceeds(deleteDoc(entry));
  }
  await assertSucceeds(setDoc(doc(db, "admins", "other"), { role: "staff", updatedAt: serverTimestamp() }));
  await assertSucceeds(updateDoc(doc(db, "admins", "other"), { role: "readonly" }));
  await assertSucceeds(deleteDoc(doc(db, "admins", "other")));
  await assertSucceeds(deleteDoc(doc(db, "users", "member", "profile", "data")));
  await assertSucceeds(deleteDoc(doc(db, "users", "member")));
});
test("every role offered by the team invitation UI can be invited, accepted or declined", async () => {
  const admin = dbFor("admin");
  for (const role of ["admin", "moderator", "staff", "coach", "readonly"]) {
    const uid = `invited-${role}`;
    const member = dbFor(uid);
    await assertSucceeds(setDoc(doc(member, "users", uid), { name: `Invited ${role}` }));
    const invite = doc(admin, "users", uid, "adminInvites", "real");
    await assertSucceeds(setDoc(invite, { role, invitedAt: serverTimestamp(), invitedByUid: "admin" }));
    await assertSucceeds(getDocs(query(collection(member, "users", uid, "adminInvites"), orderBy("invitedAt", "desc"))));
    await assertFails(setDoc(doc(dbFor("other"), "admins", uid), { role }));
    const accept = writeBatch(member);
    accept.set(doc(member, "admins", uid), { role, grantedAt: serverTimestamp(), grantedFromInvite: "real" });
    accept.delete(doc(member, "users", uid, "adminInvites", "real"));
    await assertSucceeds(accept.commit());
    const row = await assertSucceeds(getDoc(doc(member, "admins", uid)));
    if (row.data().role !== role) throw new Error(`Wrong accepted role for ${uid}`);
  }
  await assertSucceeds(setDoc(doc(admin, "users", "member", "adminInvites", "decline"), { role: "readonly", invitedAt: serverTimestamp() }));
  await assertSucceeds(deleteDoc(doc(dbFor("member"), "users", "member", "adminInvites", "decline")));
  await assertFails(setDoc(doc(admin, "users", "member", "adminInvites", "invalid"), { role: "owner" }));
});
test("moderators can suspend and reinstate older members without a profile while private data stays restricted", async () => {
  const db = dbFor("moderator");
  await assertSucceeds(setDoc(doc(db, "users", "other"), { suspended: true }, { merge: true }));
  await assertSucceeds(setDoc(doc(db, "users", "other", "profile", "data"), { suspended: true }, { merge: true }));
  await assertSucceeds(setDoc(doc(db, "users", "other"), { suspended: false }, { merge: true }));
  await assertSucceeds(setDoc(doc(db, "users", "other", "profile", "data"), { suspended: false }, { merge: true }));
  await assertFails(getDoc(doc(db, "users", "other", "profile", "data")));
  await assertFails(setDoc(doc(db, "users", "member", "profile", "other"), { suspended: true, weight: 75 }));
  await assertFails(setDoc(doc(db, "users", "missing", "profile", "data"), { suspended: true }));
  await assertFails(setDoc(doc(db, "users", "staff", "profile", "data"), { suspended: true }));
});
test("existing support flows accept text and attachment-only replies without allowing blank or foreign messages", async () => {
  const member = dbFor("member");
  await assertSucceeds(getDocs(query(collection(member, "supportTickets"), where("userId", "==", "member"))));
  await assertSucceeds(setDoc(doc(member, "supportTickets", "ticket", "messages", "text"), { authorId: "member", authorRole: "user", body: "Please help", createdAt: serverTimestamp() }));
  const attachment = { authorId: "member", authorRole: "user", body: "", attachmentURL: "https://firebasestorage.googleapis.com/v0/b/fit-x-journey/o/users%2Fmember%2Fsupport%2Fticket%2Fphoto.png?alt=media&token=test", createdAt: serverTimestamp() };
  await assertSucceeds(setDoc(doc(member, "supportTickets", "ticket", "messages", "attachment"), attachment));
  await assertSucceeds(updateDoc(doc(member, "supportTickets", "ticket"), { status: "open", lastMessageAt: serverTimestamp() }));
  await assertSucceeds(getDocs(collection(member, "supportTickets", "ticket", "messages")));
  for (const uid of ["admin", "moderator", "staff"]) {
    const support = dbFor(uid);
    await assertSucceeds(getDocs(collection(support, "supportTickets")));
    await assertSucceeds(setDoc(doc(support, "supportTickets", "ticket", "messages", `reply-${uid}`), { authorId: uid, authorRole: "admin", body: "Thanks, we will help.", createdAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(support, "supportTickets", "ticket"), { status: "pending", lastMessageAt: serverTimestamp() }));
  }
  for (const attachmentURL of ["", "javascript:alert(1)", 123]) await assertFails(setDoc(doc(member, "supportTickets", "ticket", "messages", "blank"), { ...attachment, attachmentURL }));
  await assertFails(setDoc(doc(dbFor("other"), "supportTickets", "ticket", "messages", "foreign-attachment"), { ...attachment, authorId: "other" }));
});
test("admins can assign, archive and restore clients, and close stale assignments after a coach or member is removed", async () => {
  const admin = dbFor("admin");
  const assignment = { coachId: "coach", memberId: "member", memberName: "Member", coachName: "Coach", goal: "Build consistency", status: "active", createdAt: serverTimestamp(), assignedBy: "admin" };
  await assertSucceeds(setDoc(doc(admin, "coachAssignments", "new"), assignment));
  await assertSucceeds(updateDoc(doc(admin, "coachAssignments", "new"), { status: "archived" }));
  await assertSucceeds(updateDoc(doc(admin, "coachAssignments", "new"), { status: "active" }));
  await assertSucceeds(getDocs(query(collection(dbFor("coach"), "coachAssignments"), where("coachId", "==", "coach"))));
  await assertSucceeds(deleteDoc(doc(admin, "users", "member")));
  await assertSucceeds(updateDoc(doc(admin, "coachAssignments", "new"), { status: "archived" }));
  await assertFails(updateDoc(doc(admin, "coachAssignments", "new"), { status: "active" }));
  await assertSucceeds(deleteDoc(doc(admin, "admins", "coach")));
  await assertSucceeds(updateDoc(doc(admin, "coachAssignments", "assigned"), { status: "archived" }));
  await assertFails(updateDoc(doc(admin, "coachAssignments", "assigned"), { status: "active" }));
  await assertFails(setDoc(doc(admin, "coachAssignments", "invalid"), { ...assignment, coachId: "staff" }));
});
test("members cannot self-promote, forge invitations, or change suspension flags", async () => {
  const db = dbFor("member");
  await assertFails(setDoc(doc(db, "admins", "member"), { role: "admin" }));
  await assertFails(
    setDoc(doc(db, "users", "member", "adminInvites", "fake"), {
      role: "admin",
    }),
  );
  await assertFails(
    updateDoc(doc(db, "users", "member"), { suspended: false, role: "admin" }),
  );
  await assertFails(
    updateDoc(doc(db, "users", "member", "profile", "data"), {
      suspended: true,
    }),
  );
});
test("a real invitation is accepted once with the exact invited role and atomic consumption", async () => {
  await env.withSecurityRulesDisabled(async (ctx) =>
    setDoc(doc(ctx.firestore(), "users", "member", "adminInvites", "real"), {
      role: "coach",
    }),
  );
  const db = dbFor("member");
  await assertFails(
    setDoc(doc(db, "admins", "member"), {
      role: "coach",
      grantedAt: serverTimestamp(),
      grantedFromInvite: "real",
    }),
  );
  let batch = writeBatch(db);
  batch.set(doc(db, "admins", "member"), {
    role: "admin",
    grantedAt: serverTimestamp(),
    grantedFromInvite: "real",
  });
  batch.delete(doc(db, "users", "member", "adminInvites", "real"));
  await assertFails(batch.commit());
  batch = writeBatch(db);
  batch.set(doc(db, "admins", "member"), {
    role: "coach",
    grantedAt: serverTimestamp(),
    grantedFromInvite: "real",
  });
  batch.delete(doc(db, "users", "member", "adminInvites", "real"));
  await assertSucceeds(batch.commit());
  await assertFails(updateDoc(doc(db, "admins", "member"), { role: "admin" }));
});
test("moderators can suspend members, but cannot edit health data, publish or assign roles", async () => {
  const db = dbFor("moderator");
  await assertSucceeds(getDoc(doc(db, "users", "member")));
  await assertSucceeds(
    updateDoc(doc(db, "users", "member"), { suspended: true }),
  );
  await assertSucceeds(
    updateDoc(doc(db, "users", "member", "profile", "data"), {
      suspended: true,
    }),
  );
  await assertFails(getDoc(doc(db, "users", "member", "profile", "data")));
  await assertFails(
    updateDoc(doc(db, "users", "member", "profile", "data"), { weight: 75 }),
  );
  await assertFails(updateDoc(doc(db, "admins", "staff"), { role: "admin" }));
  await assertFails(
    setDoc(doc(db, "library_workouts", "plan"), { title: "Plan" }),
  );
  await assertFails(
    setDoc(doc(db, "announcements", "broadcast"), { title: "Message" }),
  );
  await assertFails(deleteDoc(doc(db, "users", "member")));
});
test("staff handle support but cannot read health records, suspend or publish", async () => {
  const db = dbFor("staff");
  await assertSucceeds(getDoc(doc(db, "supportTickets", "ticket")));
  await assertSucceeds(
    setDoc(doc(db, "supportTickets", "ticket", "messages", "reply"), {
      authorId: "staff",
      authorRole: "admin",
      body: "How can we help?",
    }),
  );
  await assertFails(getDoc(doc(db, "users", "member", "profile", "data")));
  await assertFails(updateDoc(doc(db, "users", "member"), { suspended: true }));
  await assertFails(
    setDoc(doc(db, "library_workouts", "plan"), { title: "Plan" }),
  );
  await assertFails(setDoc(doc(db, "featureFlags", "flag"), { enabled: true }));
});
test("coaches publish plans and record check-ins only for their assignments", async () => {
  const db = dbFor("coach");
  await assertSucceeds(
    setDoc(doc(db, "library_workouts", "plan"), { title: "Plan" }),
  );
  await assertSucceeds(getDoc(doc(db, "coachAssignments", "assigned")));
  await assertFails(getDoc(doc(db, "coachAssignments", "foreign")));
  const note = {
    coachId: "coach",
    body: "Keep progressing",
    nextDate: null,
    createdAt: serverTimestamp(),
  };
  await assertSucceeds(
    setDoc(doc(db, "coachAssignments", "assigned", "checkIns", "note"), note),
  );
  await assertFails(
    setDoc(doc(db, "coachAssignments", "foreign", "checkIns", "note"), note),
  );
  await assertFails(getDoc(doc(db, "supportTickets", "ticket")));
  await assertFails(getDoc(doc(db, "users", "member", "weightLogs", "entry")));
});
test("analysts can read summaries and activity, but cannot mutate team resources", async () => {
  const db = dbFor("readonly");
  await assertSucceeds(getDoc(doc(db, "users", "member")));
  await assertFails(getDoc(doc(db, "users", "member", "profile", "data")));
  await assertFails(
    setDoc(doc(db, "announcements", "note"), { title: "Announcement" }),
  );
  await assertFails(
    updateDoc(doc(db, "supportTickets", "ticket"), { status: "closed" }),
  );
});
test("ticket messages require access to the parent ticket and a truthful author role", async () => {
  const payload = { authorId: "other", authorRole: "user", body: "Injected" };
  await assertFails(
    setDoc(
      doc(dbFor("other"), "supportTickets", "ticket", "messages", "bad"),
      payload,
    ),
  );
  await assertFails(
    updateDoc(doc(dbFor("member"), "supportTickets", "ticket"), {
      userId: "other",
    }),
  );
  await assertFails(
    setDoc(
      doc(dbFor("member"), "supportTickets", "ticket", "messages", "spoof"),
      { ...payload, authorId: "member", authorRole: "admin" },
    ),
  );
});
test("suspended members can read their records and appeal but cannot write workouts", async () => {
  await assertSucceeds(
    updateDoc(doc(dbFor("moderator"), "users", "member"), { suspended: true }),
  );
  const db = dbFor("member");
  await assertSucceeds(getDoc(doc(db, "users", "member", "profile", "data")));
  await assertFails(
    setDoc(doc(db, "users", "member", "workoutLogs", "log"), { duration: 600 }),
  );
  await assertFails(
    updateDoc(doc(db, "users", "member"), { suspended: false }),
  );
  await assertSucceeds(
    setDoc(doc(db, "supportTickets", "appeal"), {
      userId: "member",
      subject: "Appeal",
    }),
  );
});

test("private member uploads are restricted to the owner and full admins", async () => {
  const ownerStore = env.authenticatedContext("member").storage();
  const path = "users/member/progress/test.png";
  await assertSucceeds(
    uploadBytes(ref(ownerStore, path), new Uint8Array([1, 2, 3]), {
      contentType: "image/png",
    }),
  );
  await assertSucceeds(
    getBytes(ref(env.authenticatedContext("admin").storage(), path)),
  );
  for (const uid of ["moderator", "staff", "coach", "readonly", "other"]) {
    const store = env.authenticatedContext(uid).storage();
    await assertFails(getBytes(ref(store, path)));
    await assertFails(deleteObject(ref(store, path)));
  }
  await assertSucceeds(deleteObject(ref(ownerStore, path)));
});

test("only full administrators can publish brands, access policies, history and memberships", async () => {
  const access = { plan: "plus", features: [], expiresAt: null, updatedAt: serverTimestamp(), updatedBy: "admin" };
  await assertSucceeds(setDoc(doc(dbFor("admin"), "memberAccess", "member"), access));
  await assertSucceeds(setDoc(doc(dbFor("admin"), "siteSettings", "branding"), { businessName: "Pulse Studio" }));
  await assertSucceeds(setDoc(doc(dbFor("admin"), "siteSettings", "access"), { features: { nutrition: { mode: "premium" } } }));
  await assertSucceeds(setDoc(doc(dbFor("admin"), "settingsHistory", "version"), { kind: "branding", settings: { businessName: "FitX Journey" }, updatedBy: "admin" }));
  for (const uid of ["member", "moderator", "staff", "coach", "readonly"]) {
    await assertFails(setDoc(doc(dbFor(uid), "memberAccess", "member"), { ...access, updatedBy: uid }));
    await assertFails(setDoc(doc(dbFor(uid), "siteSettings", "branding"), { businessName: "Forged" }));
    await assertFails(getDoc(doc(dbFor(uid), "settingsHistory", "version")));
  }
  await assertSucceeds(getDoc(doc(dbFor("member"), "memberAccess", "member")));
  await assertFails(getDoc(doc(dbFor("other"), "memberAccess", "member")));
});
test("Nutrition policies protect child writes and templates while keeping historical member data readable", async () => {
  const admin = dbFor("admin"), member = dbFor("member");
  await assertSucceeds(setDoc(doc(member, "users", "member", "foodLogs", "old"), { foods: [] }));
  await assertSucceeds(setDoc(doc(admin, "siteSettings", "access"), { features: { nutrition: { mode: "disabled" } } }));
  for (const collection of ["foodLogs", "groceryList", "mealPlan", "mealPlans", "mealPlanEntries"]) await assertFails(setDoc(doc(member, "users", "member", collection, "new"), { name: "Entry" }));
  await assertFails(getDoc(doc(member, "library_mealPlans", "template")));
  await assertSucceeds(getDoc(doc(member, "users", "member", "foodLogs", "old")));
  await assertSucceeds(setDoc(doc(member, "users", "member", "workoutPlans", "new"), { name: "Unaffected training" }));
  await assertSucceeds(setDoc(doc(admin, "siteSettings", "access"), { features: { nutrition: { mode: "free" } } }));
  await assertSucceeds(setDoc(doc(member, "users", "member", "foodLogs", "new"), { foods: [] }));
});
test("paid tools require active, server-managed membership; expiry and child plan requirements are enforced", async () => {
  const admin = dbFor("admin"), member = dbFor("member");
  await setDoc(doc(admin, "siteSettings", "access"), { features: { nutrition: { mode: "premium", requiredPlan: "plus" }, mealPlanner: { mode: "premium", requiredPlan: "pro" } } });
  const food = doc(member, "users", "member", "foodLogs", "today"), meal = doc(member, "users", "member", "mealPlan", "week");
  await assertFails(setDoc(food, { foods: [] }));
  // An editable profile field never counts as a protected entitlement.
  await assertSucceeds(updateDoc(doc(member, "users", "member", "profile", "data"), { membership: "pro" }));
  await assertFails(setDoc(food, { foods: [] }));
  const membership = { plan: "plus", features: [], expiresAt: null, updatedBy: "admin", updatedAt: serverTimestamp() };
  await setDoc(doc(admin, "memberAccess", "member"), membership);
  await assertSucceeds(setDoc(food, { foods: [] }));
  await assertFails(setDoc(meal, { cells: {} }));
  await setDoc(doc(admin, "memberAccess", "member"), { ...membership, features: ["mealPlanner"] });
  await assertSucceeds(setDoc(meal, { cells: {} }));
  await setDoc(doc(admin, "memberAccess", "member"), { ...membership, plan: "pro", expiresAt: Timestamp.fromMillis(Date.now() - 60000) });
  await assertFails(setDoc(food, { foods: [] }));
  await setDoc(doc(admin, "memberAccess", "member"), { ...membership, plan: "pro", expiresAt: Timestamp.fromMillis(Date.now() + 60000) });
  await assertSucceeds(setDoc(meal, { cells: {} }));
});
test("branding uploads are admin-only, size-limited raster assets", async () => {
  const path = "public/branding/test.png";
  for (const uid of ["member", "moderator", "staff", "coach", "readonly"]) await assertFails(uploadBytes(ref(env.authenticatedContext(uid).storage(), path), new Uint8Array([1]), { contentType: "image/png" }));
  const store = env.authenticatedContext("admin").storage();
  await assertSucceeds(uploadBytes(ref(store, path), new Uint8Array([1]), { contentType: "image/png" }));
  await assertFails(uploadBytes(ref(store, "public/branding/bad.svg"), new Uint8Array([1]), { contentType: "image/svg+xml" }));
  await assertFails(uploadBytes(ref(store, "public/branding/large.png"), new Uint8Array(2 * 1024 * 1024 + 1), { contentType: "image/png" }));
  await assertSucceeds(deleteObject(ref(store, path)));
});

function coachingProgramme(kind = "workout") {
  return { title: "Home strength", kind, details: "Controlled reps and rest between sets.", exercises: kind === "nutrition" ? [] : [{ name: "Squat", sets: 2, reps: 10, restSeconds: 30 }], durationMinutes: 20,
    startsAt: kind === "class" ? "2026-12-12T09:00:00.000Z" : "", meetingUrl: "", status: "published", createdBy: "coach", createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
}
test("shared programmes reach only the assigned member and keep private check-ins private", async () => {
  const coach = dbFor("coach"), member = dbFor("member");
  await assertSucceeds(setDoc(doc(coach, "coachAssignments", "assigned", "programmes", "routine"), coachingProgramme()));
  await assertSucceeds(getDoc(doc(member, "coachAssignments", "assigned")));
  await assertSucceeds(getDocs(query(collection(member, "coachAssignments"), where("memberId", "==", "member"), where("status", "==", "active"))));
  await assertSucceeds(getDocs(query(collection(member, "coachAssignments", "assigned", "programmes"), where("status", "==", "published"))));
  await assertFails(getDoc(doc(dbFor("other"), "coachAssignments", "assigned", "programmes", "routine")));
  await assertFails(getDocs(collection(member, "coachAssignments", "assigned", "checkIns")));
  for (const uid of ["moderator", "staff", "readonly", "member"]) {
    await assertFails(setDoc(doc(dbFor(uid), "coachAssignments", "assigned", "programmes", "injected"), { ...coachingProgramme(), createdBy: uid }));
  }
  await assertFails(setDoc(doc(coach, "coachAssignments", "foreign", "programmes", "injected"), coachingProgramme()));
  const batch = writeBatch(coach);
  batch.set(doc(coach, "coachAssignments", "assigned", "programmes", "class"), coachingProgramme("class"));
  batch.set(doc(coach, "coachAssignments", "foreign", "programmes", "class"), coachingProgramme("class"));
  await assertFails(batch.commit());
  if ((await getDoc(doc(dbFor("admin"), "coachAssignments", "assigned", "programmes", "class"))).exists()) throw new Error("Partial group publication leaked through");
});
test("member feedback is truthful, scoped, and cannot alter coach content", async () => {
  const coach = dbFor("coach"), member = dbFor("member");
  await setDoc(doc(coach, "coachAssignments", "assigned", "programmes", "routine"), coachingProgramme());
  const feedbackRef = doc(member, "coachAssignments", "assigned", "responses", "routine");
  const feedback = { memberId: "member", status: "completed", feedback: "Good session.", updatedAt: serverTimestamp() };
  await assertSucceeds(setDoc(feedbackRef, feedback));
  await assertSucceeds(getDoc(doc(coach, "coachAssignments", "assigned", "responses", "routine")));
  await assertFails(setDoc(feedbackRef, { ...feedback, memberId: "other" }));
  await assertFails(setDoc(feedbackRef, { ...feedback, status: "published" }));
  await assertFails(setDoc(feedbackRef, { ...feedback, feedback: "x".repeat(2001) }));
  await assertFails(setDoc(doc(dbFor("other"), "coachAssignments", "assigned", "responses", "routine"), { ...feedback, memberId: "other" }));
  await assertFails(setDoc(doc(coach, "coachAssignments", "assigned", "responses", "routine"), { ...feedback, memberId: "coach" }));
  await assertFails(updateDoc(doc(member, "coachAssignments", "assigned", "programmes", "routine"), { title: "Rewritten by member" }));
  await assertFails(setDoc(doc(member, "coachAssignments", "assigned", "responses", "missing"), feedback));
});
test("a coach can publish one class atomically to ten assigned clients", async () => {
  await env.withSecurityRulesDisabled(async ctx => {
    const batch = writeBatch(ctx.firestore());
    for (let i = 0; i < 10; i++) {
      batch.set(doc(ctx.firestore(), "users", `group-member-${i}`), { name: `Member ${i}` });
      batch.set(doc(ctx.firestore(), "coachAssignments", `group-assignment-${i}`), { coachId: "coach", memberId: `group-member-${i}`, memberName: `Member ${i}`, goal: "Group class", status: "active" });
    }
    await batch.commit();
  });
  const coach = dbFor("coach");
  const batch = writeBatch(coach);
  for (let i = 0; i < 10; i++) batch.set(doc(coach, "coachAssignments", `group-assignment-${i}`, "programmes", "group-class"), coachingProgramme("class"));
  await assertSucceeds(batch.commit());
});
test("withdrawal, archived assignments and feature policies stop coaching writes", async () => {
  const coach = dbFor("coach"), member = dbFor("member"), admin = dbFor("admin");
  await setDoc(doc(coach, "coachAssignments", "assigned", "programmes", "meals"), coachingProgramme("nutrition"));
  const feedbackRef = doc(member, "coachAssignments", "assigned", "responses", "meals");
  const feedback = { memberId: "member", status: "seen", feedback: "", updatedAt: serverTimestamp() };
  await setDoc(doc(admin, "siteSettings", "access"), { features: { nutrition: { mode: "disabled" } } });
  await assertFails(setDoc(feedbackRef, feedback));
  await setDoc(doc(admin, "siteSettings", "access"), { features: { library: { mode: "premium", requiredPlan: "pro" } } });
  await assertFails(setDoc(feedbackRef, feedback));
  await setDoc(doc(admin, "siteSettings", "access"), { features: {} });
  await assertSucceeds(setDoc(feedbackRef, feedback));
  await assertSucceeds(updateDoc(doc(coach, "coachAssignments", "assigned", "programmes", "meals"), { status: "withdrawn", updatedAt: serverTimestamp() }));
  await assertFails(setDoc(feedbackRef, feedback));
  await assertFails(getDoc(doc(member, "coachAssignments", "assigned", "programmes", "meals")));
  await updateDoc(doc(admin, "coachAssignments", "assigned"), { status: "archived" });
  await assertFails(setDoc(doc(coach, "coachAssignments", "assigned", "programmes", "late"), coachingProgramme()));
  await assertFails(getDoc(doc(member, "coachAssignments", "assigned")));
  await assertFails(setDoc(feedbackRef, feedback));
});

// Community fixtures exercise the same atomic enrolment and chat writes as the UI.
const groupRef = (db, ...parts) => doc(db, "communityGroups", "club", ...parts);
async function enableCommunity(mode = "free", requiredPlan = "plus") {
  await setDoc(doc(dbFor("admin"), "siteSettings", "access"), { features: { community: { mode, requiredPlan } } });
}
async function makeGroup() {
  const db = dbFor("coach"), batch = writeBatch(db);
  batch.set(groupRef(db), { name: "Strength club", description: "Train together", tone: "mint", coachId: "coach", createdBy: "coach", createdAt: serverTimestamp(), updatedAt: serverTimestamp(), status: "active" });
  batch.set(groupRef(db, "members", "coach"), { uid: "coach", name: "Coach", role: "coach", assignmentId: "", status: "active", joinedAt: serverTimestamp() });
  batch.set(doc(db, "communityMemberships", "coach", "groups", "club"), { groupId: "club", uid: "coach", status: "active", joinedAt: serverTimestamp() });
  await assertSucceeds(batch.commit());
}
function enrolBatch(db, uid = "member", assignmentId = "assigned", name = "Member", status = "active") {
  const batch = writeBatch(db);
  batch.set(groupRef(db, "members", uid), { uid, name, role: "member", assignmentId, status, joinedAt: serverTimestamp() }, { merge: true });
  batch.set(doc(db, "communityMemberships", uid, "groups", "club"), { groupId: "club", uid, status, joinedAt: serverTimestamp() });
  return batch;
}
async function communityFixture() {
  await enableCommunity(); await makeGroup(); await assertSucceeds(enrolBatch(dbFor("coach")).commit());
}
function chatData(uid = "member", senderName = "Member", senderRole = "member") {
  return { senderId: uid, senderName, senderRole, text: "Hello team 💪", replyTo: "", reactions: {}, status: "visible", createdAt: serverTimestamp() };
}
function activityData(kind = "workout", status = "published", createdBy = "coach") {
  return { title: "Shared session", kind, details: "Move at your own pace", exercises: kind === "workout" ? [{ name: "Squat", sets: 3, reps: 10, restSeconds: 60, equipment: "body weight", bodyPart: "legs", target: "quads" }] : [], durationMinutes: 30, startsAt: kind === "class" ? "2026-10-20T12:00:00Z" : "", meetingUrl: "", status, createdBy, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), updatedBy: createdBy };
}
function responseData(activityId, status, userId = "member", name = "Member") {
  return { activityId, userId, name, status, feedback: "Feeling good", updatedAt: serverTimestamp() };
}
test("community is opt-in and preserves team preparation while member routes are disabled", async () => {
  await makeGroup(); await assertSucceeds(enrolBatch(dbFor("coach")).commit());
  await assertFails(getDoc(groupRef(dbFor("member"))));
  await assertSucceeds(getDoc(groupRef(dbFor("coach"))));
  await assertSucceeds(getDoc(groupRef(dbFor("moderator"))));
  await enableCommunity(); await assertSucceeds(getDoc(groupRef(dbFor("member"))));
});
test("coach groups, rosters, history and responses are private to assigned participants", async () => {
  await communityFixture();
  for (const uid of ["other", "staff", "readonly"]) {
    await assertFails(getDoc(groupRef(dbFor(uid))));
    await assertFails(getDocs(collection(dbFor(uid), "communityGroups", "club", "messages")));
    await assertFails(getDocs(collection(dbFor(uid), "communityGroups", "club", "members")));
  }
  const member = dbFor("member");
  await assertSucceeds(getDocs(query(collection(member, "communityMemberships", "member", "groups"), where("status", "==", "active"))));
  await assertFails(getDocs(collection(member, "communityGroups")));
  await assertSucceeds(getDocs(collection(member, "communityGroups", "club", "members")));
  await assertSucceeds(getDocs(query(collection(dbFor("coach"), "communityGroups"), where("coachId", "==", "coach"))));
  await assertSucceeds(getDocs(collection(dbFor("moderator"), "communityGroups")));
  await assertFails(getDoc(doc(member, "communityMemberships", "other", "groups", "club")));
});
test("clients cannot self-enrol, forge host privileges or reinstate removed membership", async () => {
  await communityFixture();
  const member = dbFor("member"), coach = dbFor("coach");
  await assertFails(enrolBatch(dbFor("other"), "other", "foreign", "Other").commit());
  await assertFails(updateDoc(groupRef(member, "members", "member"), { role: "coach" }));
  await assertFails(updateDoc(groupRef(member), { coachId: "member", updatedAt: serverTimestamp() }));
  await assertFails(setDoc(doc(member, "communityMemberships", "other", "groups", "club"), { groupId: "club", uid: "other", status: "active", joinedAt: serverTimestamp() }));
  await assertFails(enrolBatch(coach, "other", "foreign", "Other").commit());
  await assertFails(updateDoc(groupRef(coach, "members", "member"), { status: "removed" })); // mirror required
  await assertSucceeds(enrolBatch(coach, "member", "assigned", "Member", "removed").commit());
  await assertFails(getDoc(groupRef(member)));
  const ownMembership = await assertSucceeds(getDoc(groupRef(member, "members", "member")));
  if (ownMembership.data().status !== "removed") throw new Error("Removal did not sync to its owner");
  await assertFails(getDoc(groupRef(member, "members", "coach")));
  await assertFails(enrolBatch(member).commit());
  await assertSucceeds(enrolBatch(coach).commit());
  await assertSucceeds(getDoc(groupRef(member)));
});
test("a coach can enrol forty clients in four-client atomic chunks within rule limits", async () => {
  await makeGroup();
  await env.withSecurityRulesDisabled(async ctx => {
    for (let i = 0; i < 40; i++) await setDoc(doc(ctx.firestore(), "coachAssignments", `client-${i}`), { coachId: "coach", memberId: `client-${i}`, memberName: `Client ${i}`, status: "active" });
  });
  const coach = dbFor("coach");
  for (let offset = 0; offset < 40; offset += 4) {
    const batch = writeBatch(coach);
    for (let i = offset; i < offset + 4; i++) {
      batch.set(groupRef(coach, "members", `client-${i}`), { uid: `client-${i}`, name: `Client ${i}`, role: "member", assignmentId: `client-${i}`, status: "active", joinedAt: serverTimestamp() });
      batch.set(doc(coach, "communityMemberships", `client-${i}`, "groups", "club"), { groupId: "club", uid: `client-${i}`, status: "active", joinedAt: serverTimestamp() });
    }
    await assertSucceeds(batch.commit());
  }
  const roster = await assertSucceeds(getDocs(collection(coach, "communityGroups", "club", "members")));
  if (roster.size !== 41) throw new Error("A client did not enrol");
});
test("live chat validates authors, roles, timestamps, replies and bounded text", async () => {
  await communityFixture();
  const member = dbFor("member"), coach = dbFor("coach");
  const batch = writeBatch(member);
  batch.set(groupRef(member, "messages", "hello"), chatData());
  batch.update(groupRef(member), { lastMessageAt: serverTimestamp() });
  await assertSucceeds(batch.commit());
  await assertSucceeds(setDoc(groupRef(coach, "messages", "reply"), { ...chatData("coach", "Coach", "coach"), replyTo: "hello" }));
  await assertSucceeds(getDocs(query(collection(member, "communityGroups", "club", "messages"), orderBy("createdAt", "desc"))));
  for (const data of [{ ...chatData(), senderId: "coach" }, { ...chatData(), senderRole: "admin" }, { ...chatData(), senderName: "Fake Coach" }, { ...chatData(), createdAt: Timestamp.fromMillis(1) }, { ...chatData(), text: "x".repeat(3001) }, { ...chatData(), replyTo: "missing" }, { ...chatData(), reactions: { other: "👍" } }]) await assertFails(setDoc(groupRef(member, "messages", "bad"), data));
});
test("edits, reactions and presence cannot overwrite another person's fields", async () => {
  await communityFixture();
  const member = dbFor("member"), coach = dbFor("coach"), message = groupRef(member, "messages", "hello");
  await setDoc(message, chatData());
  await assertSucceeds(updateDoc(message, { text: "Edited hello", editedAt: serverTimestamp() }));
  await assertFails(updateDoc(groupRef(coach, "messages", "hello"), { text: "Impersonation", editedAt: serverTimestamp() }));
  await assertSucceeds(updateDoc(message, new FieldPath("reactions", "member"), "❤️"));
  await assertSucceeds(updateDoc(groupRef(coach, "messages", "hello"), new FieldPath("reactions", "coach"), "💪"));
  await assertFails(updateDoc(message, new FieldPath("reactions", "coach"), "😂"));
  await assertFails(updateDoc(message, new FieldPath("reactions", "member"), "invalid"));
  await assertFails(updateDoc(message, new FieldPath("reactions", "member"), ""));
  await assertSucceeds(updateDoc(message, new FieldPath("reactions", "member"), deleteField()));
  const presence = groupRef(member, "members", "member");
  await assertSucceeds(updateDoc(presence, { lastReadAt: serverTimestamp(), typingUntil: Timestamp.fromMillis(Date.now() + 7000) }));
  await assertFails(updateDoc(presence, { lastReadAt: Timestamp.fromMillis(Date.now() + 60000) }));
  await assertFails(updateDoc(presence, { typingUntil: Timestamp.fromMillis(Date.now() + 60000) }));
  await assertFails(updateDoc(groupRef(member, "members", "coach"), { lastReadAt: serverTimestamp() }));
  await env.withSecurityRulesDisabled(ctx => updateDoc(groupRef(ctx.firestore(), "messages", "hello"), { createdAt: Timestamp.fromMillis(Date.now() - 16 * 60000) }));
  await assertFails(updateDoc(message, { text: "Too late", editedAt: serverTimestamp() }));
});
test("shared workout drafts are collaborative but only their coach can publish", async () => {
  await communityFixture();
  const member = dbFor("member"), coach = dbFor("coach"), ref = groupRef(member, "activities", "draft");
  await assertSucceeds(setDoc(ref, activityData("workout", "draft", "member")));
  await assertSucceeds(updateDoc(ref, { title: "Together stronger", updatedAt: serverTimestamp(), updatedBy: "member" }));
  await assertFails(updateDoc(ref, { status: "published", updatedAt: serverTimestamp(), updatedBy: "member" }));
  await assertFails(setDoc(groupRef(member, "activities", "class"), activityData("class", "published", "member")));
  await assertFails(setDoc(groupRef(member, "responses", "draft_member"), responseData("draft", "completed")));
  await assertSucceeds(updateDoc(groupRef(coach, "activities", "draft"), { status: "published", updatedAt: serverTimestamp(), updatedBy: "coach" }));
  await assertFails(updateDoc(ref, { title: "Changed after approval", updatedAt: serverTimestamp(), updatedBy: "member" }));
  await assertSucceeds(setDoc(groupRef(member, "responses", "draft_member"), responseData("draft", "completed")));
  await assertFails(updateDoc(groupRef(coach, "activities", "draft"), { createdBy: "coach", updatedAt: serverTimestamp(), updatedBy: "coach" }));
});
test("class bookings and feedback have truthful owners and activity-specific statuses", async () => {
  await communityFixture();
  const coach = dbFor("coach"), member = dbFor("member");
  for (const kind of ["class", "nutrition", "challenge", "announcement"]) await assertSucceeds(setDoc(groupRef(coach, "activities", kind), activityData(kind)));
  await assertSucceeds(setDoc(groupRef(member, "responses", "class_member"), responseData("class", "going")));
  await assertSucceeds(setDoc(groupRef(member, "responses", "class_member"), responseData("class", "not_going")));
  await assertFails(setDoc(groupRef(member, "responses", "class_member"), responseData("class", "joined")));
  await assertFails(setDoc(groupRef(member, "responses", "class_other"), responseData("class", "going", "other", "Other")));
  await assertFails(setDoc(groupRef(member, "responses", "class_member"), responseData("class", "going", "member", "False name")));
  await assertSucceeds(setDoc(groupRef(member, "responses", "nutrition_member"), responseData("nutrition", "completed")));
  await assertSucceeds(setDoc(groupRef(member, "responses", "challenge_member"), responseData("challenge", "joined")));
  await assertSucceeds(setDoc(groupRef(member, "responses", "announcement_member"), responseData("announcement", "seen")));
  await assertFails(setDoc(groupRef(member, "responses", "announcement_member"), responseData("announcement", "completed")));
  await updateDoc(groupRef(coach, "activities", "class"), { status: "withdrawn", updatedAt: serverTimestamp(), updatedBy: "coach" });
  await assertFails(setDoc(groupRef(member, "responses", "class_member"), responseData("class", "going")));
});
test("community disabled, paid, expired and child-feature gates are enforced in Firestore", async () => {
  await communityFixture();
  const member = dbFor("member"), admin = dbFor("admin"), coach = dbFor("coach");
  await enableCommunity("premium", "pro");
  await assertFails(getDoc(groupRef(member)));
  const grant = { plan: "free", features: ["community"], expiresAt: null, updatedAt: serverTimestamp(), updatedBy: "admin" };
  await assertSucceeds(setDoc(doc(admin, "memberAccess", "member"), grant));
  await assertSucceeds(getDoc(groupRef(member)));
  await assertFails(setDoc(doc(member, "memberAccess", "member"), { ...grant, plan: "pro" }));
  await setDoc(doc(admin, "memberAccess", "member"), { ...grant, expiresAt: Timestamp.fromMillis(1) });
  await assertFails(getDoc(groupRef(member)));
  await setDoc(doc(admin, "memberAccess", "member"), { ...grant, plan: "pro" });
  await enableCommunity("disabled");
  await assertFails(getDoc(groupRef(member)));
  await assertFails(setDoc(groupRef(member, "messages", "disabled"), chatData()));
  await setDoc(doc(admin, "siteSettings", "access"), { features: { community: { mode: "free" }, nutrition: { mode: "disabled" }, training: { mode: "disabled" }, records: { mode: "disabled" }, rewards: { mode: "disabled" } } });
  await setDoc(groupRef(coach, "activities", "nutrition"), activityData("nutrition"));
  await assertFails(setDoc(groupRef(member, "responses", "nutrition_member"), responseData("nutrition", "seen")));
  await assertFails(setDoc(groupRef(member, "activities", "draft"), activityData("workout", "draft", "member")));
  await assertSucceeds(setDoc(groupRef(member, "messages", "still-chat"), chatData()));
});
test("reports are private and moderators remove content without gaining coaching or billing powers", async () => {
  await communityFixture();
  const member = dbFor("member"), moderator = dbFor("moderator"), coach = dbFor("coach");
  await setDoc(groupRef(coach, "messages", "hello"), chatData("coach", "Coach", "coach"));
  const report = { messageId: "hello", reporterId: "member", reason: "Please review", status: "open", createdAt: serverTimestamp() };
  await assertSucceeds(setDoc(groupRef(member, "reports", "report"), report));
  await assertFails(setDoc(groupRef(member, "reports", "forged"), { ...report, reporterId: "other" }));
  for (const uid of ["member", "coach", "staff", "readonly"]) await assertFails(getDoc(groupRef(dbFor(uid), "reports", "report")));
  await assertSucceeds(getDocs(collection(moderator, "communityGroups", "club", "reports")));
  const removal = { status: "removed", text: "", reactions: {}, removedBy: "moderator", removedAt: serverTimestamp() };
  await assertFails(updateDoc(groupRef(member, "messages", "hello"), { ...removal, removedBy: "member" }));
  const batch = writeBatch(moderator);
  batch.update(groupRef(moderator, "messages", "hello"), removal);
  batch.update(groupRef(moderator, "reports", "report"), { status: "resolved", resolvedBy: "moderator", resolvedAt: serverTimestamp() });
  await assertSucceeds(batch.commit());
  await assertFails(setDoc(groupRef(moderator, "activities", "class"), activityData("class", "published", "moderator")));
  await assertFails(updateDoc(groupRef(moderator), { status: "archived", updatedAt: serverTimestamp() }));
  const primary = await getDoc(groupRef(coach, "members", "member"));
  const removeMember = writeBatch(moderator);
  removeMember.update(groupRef(moderator, "members", "member"), { status: "removed" });
  removeMember.update(doc(moderator, "communityMemberships", "member", "groups", "club"), { status: "removed" });
  await assertSucceeds(removeMember.commit());
  const removed = await getDoc(groupRef(coach, "members", "member"));
  if (!removed.data().joinedAt.isEqual(primary.data().joinedAt)) throw new Error("Removal changed membership metadata");
  await assertFails(enrolBatch(moderator).commit());
});
test("archiving assignments or suspending clients revokes live group access immediately", async () => {
  await communityFixture();
  const member = dbFor("member"), admin = dbFor("admin"), coach = dbFor("coach");
  await updateDoc(doc(admin, "coachAssignments", "assigned"), { status: "archived" });
  await assertFails(getDoc(groupRef(member)));
  await assertFails(setDoc(groupRef(member, "messages", "late"), chatData()));
  await updateDoc(doc(admin, "coachAssignments", "assigned"), { status: "active" });
  await assertSucceeds(getDoc(groupRef(member)));
  await updateDoc(doc(admin, "users", "member"), { suspended: true });
  await assertFails(getDoc(groupRef(member)));
  await updateDoc(doc(admin, "users", "member"), { suspended: false });
  await updateDoc(groupRef(coach), { status: "archived", updatedAt: serverTimestamp() });
  const archived = await assertSucceeds(getDoc(groupRef(member)));
  if (archived.data().status !== "archived") throw new Error("Archive metadata did not sync");
  await assertFails(getDocs(collection(member, "communityGroups", "club", "messages")));
  await assertFails(getDocs(collection(member, "communityGroups", "club", "activities")));
  await assertSucceeds(getDoc(groupRef(coach)));
  await assertFails(setDoc(groupRef(coach, "messages", "late"), chatData("coach", "Coach", "coach")));
});
