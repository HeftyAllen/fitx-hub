import { test, expect, type Page } from "@playwright/test";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, setDoc, Timestamp } from "firebase/firestore";
import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
let env: RulesTestEnvironment;
const identities: Record<string, string> = {};
const password = "FitxTestOnly123!";
test.beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-fitx-workspaces",
    firestore: { host: "127.0.0.1", port: 8085 },
  });
  await env.clearFirestore();
  await fetch(
    "http://127.0.0.1:9099/emulator/v1/projects/demo-fitx-workspaces/accounts",
    { method: "DELETE" },
  );
  for (const role of [
    "admin",
    "moderator",
    "staff",
    "coach",
    "readonly",
    "member",
  ]) {
    const response = await fetch(
      "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-key",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: `${role}@fitx.test`,
          password,
          returnSecureToken: true,
        }),
      },
    );
    const account = await response.json();
    if (!account.localId) throw new Error(JSON.stringify(account));
    identities[role] = account.localId;
  }
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [role, uid] of Object.entries(identities)) {
      const profile = {
        name:
          role === "member"
            ? "Alex Member"
            : `${role[0].toUpperCase()}${role.slice(1)} Team`,
        email: `${role}@fitx.test`,
        goalType: "strength",
        createdAt: Timestamp.now(),
      };
      await setDoc(doc(db, "users", uid), { ...profile, uid });
      await setDoc(doc(db, "users", uid, "profile", "data"), profile);
      if (role !== "member") await setDoc(doc(db, "admins", uid), { role });
    }
    await setDoc(doc(db, "coachAssignments", "fixture-assignment"), {
      coachId: identities.coach,
      memberId: identities.member,
      memberName: "Alex Member",
      goal: "Build a consistent training routine",
      status: "active",
    });
    await setDoc(doc(db, "supportTickets", "fixture-ticket"), {
      userId: identities.member,
      userEmail: "member@fitx.test",
      subject: "Help with my workout plan",
      status: "open",
      createdAt: Timestamp.now(),
    });
    await setDoc(
      doc(db, "users", identities.member, "workoutPlans", "fixture-plan"),
      {
        name: "Offline strength session",
        createdAt: Timestamp.now(),
        exercises: [
          {
            id: "squat",
            name: "Bodyweight squat",
            bodyPart: "legs",
            target: "quads",
            equipment: "body weight",
            sets: 1,
            reps: 10,
            restSeconds: 0,
          },
        ],
      },
    );
  });
});
test.afterAll(async () => env?.cleanup());
async function login(page: Page, role: string) {
  await page.goto("/auth");
  await page
    .getByPlaceholder("Email", { exact: true })
    .fill(`${role}@fitx.test`);
  await page.getByPlaceholder("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(role === "member" ? /\/dashboard$/ : /\/admin$/);
}
async function workoutLogCount() {
  let count = -1;
  await env.withSecurityRulesDisabled(async (ctx) => {
    const { getDocs, collection } = await import("firebase/firestore");
    count = (await getDocs(collection(ctx.firestore(), "users", identities.member, "workoutLogs"))).size;
  });
  return count;
}
const titles: Record<string, string> = {
  admin: "A stronger community starts here.",
  moderator: "Keep the journey safe for everyone.",
  staff: "Make every member feel supported.",
  coach: "Help your members move forward.",
  readonly: "See the progress behind the numbers.",
};
for (const role of Object.keys(titles))
  test(`${role} gets a distinct workspace and guarded navigation`, async ({
    page,
  }) => {
    await login(page, role);
    await expect(
      page.getByRole("heading", { name: titles[role] }),
    ).toBeVisible();
    await expect(page.locator(".workspace-shell").first()).toHaveAttribute(
      "data-role",
      role,
    );
    const nav = page.getByRole("navigation", {
      name: new RegExp("navigation$"),
    });
    if (role !== "admin") {
      await expect(
        nav.getByRole("link", { name: "Platform settings" }),
      ).toHaveCount(0);
      await page.goto("/admin/settings");
      await expect(page).toHaveURL(/\/admin$/);
    }
    if (role === "staff")
      await expect(nav.getByRole("link", { name: "Plan studio" })).toHaveCount(
        0,
      );
    if (role === "coach")
      await expect(
        nav.getByRole("link", { name: "Support inbox" }),
      ).toHaveCount(0);
    await expect(
      page.getByText(/Loading (recorded data|your workspace)/),
    ).toHaveCount(0);
    await expect(page.getByText(/Data unavailable/)).toHaveCount(0);
    await page.screenshot({
      path: `test-results/${role}-desktop.png`,
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(
      page.getByRole("button", { name: "Open workspace menu" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/${role}-mobile-workspace.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "Open workspace menu" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.screenshot({
      path: `test-results/${role}-mobile.png`,
      fullPage: true,
    });
  });
test("coach records a real check-in for an assigned member", async ({
  page,
}) => {
  await login(page, "coach");
  await page.goto("/admin/coaching");
  await page.getByRole("button", { name: /Alex Member/ }).click();
  await page
    .getByLabel("New check-in", { exact: true })
    .fill("Keep your next workout focused on controlled form.");
  await page
    .getByRole("button", { name: "Save check-in", exact: true })
    .click();
  await expect(
    page
      .getByRole("article")
      .getByText("Keep your next workout focused on controlled form.", {
        exact: true,
      }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/coach-check-in.png",
    fullPage: true,
  });
});
test("member recovers a workout offline and syncs completion once on reconnect", async ({
  page,
  context,
}) => {
  await login(page, "member");
  await page.goto("/workout-planner");
  await expect(
    page.getByText("Offline strength session", { exact: true }),
  ).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  const card = page
    .locator("div.glass-card")
    .filter({
      has: page.getByText("Offline strength session", { exact: true }),
    })
    .last();
  await card.getByRole("button", { name: /Start/ }).click();
  await expect(page).toHaveURL(/\/workout-session$/);
  await expect(
    page.getByRole("heading", { name: "Bodyweight squat", exact: true }),
  ).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Bodyweight squat", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/saved workout session was restored/),
  ).toBeVisible();
  // Complete the set, then use the session's finish control.
  await page.getByRole("button", { name: /Complete set 1/ }).click();
  await page.getByRole("button", { name: /Finish workout/ }).click();
  await expect(page.getByText(/Workout saved offline/)).toBeVisible();
  await context.setOffline(false);
  await expect.poll(workoutLogCount, { timeout: 20000 }).toBe(1);
  await expect(page.getByText("Workout queue clear", { exact: true })).toBeVisible();
  await page.reload();
  await expect.poll(workoutLogCount, { timeout: 20000 }).toBe(1);
});
