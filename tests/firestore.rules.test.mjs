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
  collection, getDocs, query, where,
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
