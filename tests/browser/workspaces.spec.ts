import { test, expect, type Page } from "@playwright/test";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, setDoc, getDoc, deleteField, Timestamp } from "firebase/firestore";
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
    "member2",
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
          role.startsWith("member")
            ? role === "member" ? "Alex Member" : "Taylor Member"
            : `${role[0].toUpperCase()}${role.slice(1)} Team`,
        email: `${role}@fitx.test`,
        goalType: "strength",
        createdAt: Timestamp.now(),
      };
      await setDoc(doc(db, "users", uid), { ...profile, uid });
      await setDoc(doc(db, "users", uid, "profile", "data"), profile);
      if (!role.startsWith("member")) await setDoc(doc(db, "admins", uid), { role });
    }
    await setDoc(doc(db, "coachAssignments", "fixture-assignment"), {
      coachId: identities.coach,
      memberId: identities.member,
      memberName: "Alex Member",
      goal: "Build a consistent training routine",
      status: "active",
    });
    await setDoc(doc(db, "coachAssignments", "community-second-assignment"), { coachId: identities.coach, memberId: identities.member2, memberName: "Taylor Member", goal: "Shared training", status: "active" });
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
test.beforeEach(async () => env.withSecurityRulesDisabled(async ctx => {
  await setDoc(doc(ctx.firestore(), "siteSettings", "branding"), {});
  await setDoc(doc(ctx.firestore(), "siteSettings", "access"), { features: {}, membership: {} });
  await setDoc(doc(ctx.firestore(), "memberAccess", identities.member), { plan: "free", features: [], expiresAt: null });
  await setDoc(doc(ctx.firestore(), "users", identities.member, "profile", "data"), { name: "Alex Member", greetingName: "", daysPerWeek: 3, membershipInterest: deleteField() }, { merge: true });
  await setDoc(doc(ctx.firestore(), "users", identities.member), { name: "Alex Member", membershipInterest: deleteField() }, { merge: true });
}));
async function login(page: Page, role: string) {
  // External fonts are optional; keep local regression checks independent of
  // network font failures and exercise the app's ordinary fallback typography.
  await page.route("**/fonts.googleapis.com/**", route => route.fulfill({ contentType: "text/css", body: "" }));
  await page.goto("/auth");
  await page
    .getByPlaceholder("Email", { exact: true })
    .fill(`${role}@fitx.test`);
  await page.getByPlaceholder("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(role.startsWith("member") ? /\/dashboard$/ : /\/admin$/);
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

test("focused workout controls preserve edits, rest, pause and responsive recovery", async ({ page }) => {
  test.setTimeout(90000);
  await env.withSecurityRulesDisabled(ctx => setDoc(doc(ctx.firestore(), "users", identities.member, "workoutPlans", "focus-plan"), {
    name: "Focus strength session", createdAt: Timestamp.now(), exercises: [
      { name: "Bodyweight squat", target: "quads", equipment: "body weight", sets: 2, reps: 10, restSeconds: 60, instructions: ["Keep your movement controlled."] },
      { name: "Incline push-up", target: "chest", equipment: "body weight", sets: 1, reps: 8, restSeconds: 0 },
    ],
  }));
  await login(page, "member");
  await page.goto("/workout-planner");
  await page.locator("div.glass-card").filter({ has: page.getByText("Focus strength session", { exact: true }) }).last().getByRole("button", { name: /Start/ }).click();
  await expect(page.getByRole("heading", { name: "Bodyweight squat", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Turn voice coach off" }).click();
  await page.getByRole("button", { name: "Track weight" }).click();
  await page.getByLabel("Reps for set 1", { exact: true }).fill("12");
  await page.getByLabel("Weight for set 1", { exact: true }).fill("20");
  await page.screenshot({ path: "test-results/workout-session-desktop.png", fullPage: true });
  await page.getByRole("button", { name: "Complete set 1", exact: true }).click();
  await expect(page.getByLabel("Rest timer", { exact: true })).toBeVisible();
  await expect(page.getByText("Next: Bodyweight squat · Set 2", { exact: true })).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Sets completed" })).toHaveAttribute("aria-valuenow", "1");
  await page.getByLabel("Weight for set 2", { exact: true }).fill("22.5");
  await page.getByRole("button", { name: "Edit completed set 1", exact: true }).click();
  await expect(page.getByLabel("Rest timer", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("progressbar", { name: "Sets completed" })).toHaveAttribute("aria-valuenow", "0");
  await page.getByLabel("Reps for set 1", { exact: true }).fill("11");
  await page.getByRole("button", { name: "Complete set 1", exact: true }).click();
  await page.getByRole("button", { name: "+30s", exact: true }).click();
  await expect.poll(async () => Number((await page.getByLabel("Rest time remaining", { exact: true }).textContent())?.replace("s", ""))).toBeGreaterThan(75);
  await page.getByRole("button", { name: "Pause session timer" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const clock = await page.locator(".workout-session-clock span").textContent();
  const rest = await page.locator(".workout-rest-ring strong").textContent();
  await page.waitForTimeout(1200);
  expect(await page.locator(".workout-session-clock span").textContent()).toBe(clock);
  expect(await page.locator(".workout-rest-ring strong").textContent()).toBe(rest);
  await page.getByRole("button", { name: "Resume workout", exact: true }).click();
  await page.getByRole("button", { name: "Skip rest", exact: true }).click();
  await page.getByRole("button", { name: "Add set", exact: true }).click();
  await expect(page.getByLabel("Reps for set 3", { exact: true })).toHaveValue("10");
  await page.getByRole("button", { name: "Remove last set", exact: true }).click();
  await expect(page.getByLabel("Reps for set 3", { exact: true })).toHaveCount(0);
  await page.locator(".workout-notes summary").click();
  await page.getByLabel("How did this exercise feel?", { exact: true }).fill("Controlled form. Keep this weight next time.");
  await page.getByRole("button", { name: /View form guide/ }).click();
  await expect(page.getByRole("dialog").getByText("Keep your movement controlled.", { exact: true })).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).click();
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `set controls fit ${width}px`).toBe(true);
  }
  await page.screenshot({ path: "test-results/workout-session-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Next exercise", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Incline push-up", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Previous exercise", exact: true }).click();
  await expect(page.getByLabel("How did this exercise feel?", { exact: true })).toHaveValue("Controlled form. Keep this weight next time.");
  await page.getByRole("button", { name: "Save draft and leave workout" }).click();
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await page.getByRole("button", { name: "Resume workout", exact: true }).click();
  await page.getByRole("button", { name: "Track weight" }).click();
  await expect(page.getByLabel("Reps for set 1", { exact: true })).toHaveValue("11");
  await expect(page.getByLabel("Weight for set 2", { exact: true })).toHaveValue("22.5");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.screenshot({ path: "test-results/workout-session-mobile-light.png", fullPage: true });
});

test("coach shares client programmes and group classes with live member feedback", async ({ page, browser }) => {
  test.setTimeout(120000);
  await env.withSecurityRulesDisabled(async ctx => {
    await setDoc(doc(ctx.firestore(), "users", "fixture-second-client"), { name: "Casey Member" });
    await setDoc(doc(ctx.firestore(), "coachAssignments", "fixture-second-assignment"), { coachId: identities.coach, memberId: "fixture-second-client", memberName: "Casey Member", goal: "Build consistency", status: "active" });
  });
  await login(page, "coach");
  await page.goto("/admin/coaching");
  await page.getByRole("button", { name: /Alex Member/ }).click();
  await page.getByLabel("Programme title", { exact: true }).fill("Home strength together");
  await page.getByLabel("Instructions & what to bring", { exact: true }).fill("Warm up and use a controlled range of motion.");
  await page.getByLabel("Exercise 1", { exact: true }).fill("Bodyweight squat");
  await page.getByLabel("Sets for exercise 1", { exact: true }).fill("1");
  await page.getByLabel("Rest (sec) for exercise 1", { exact: true }).fill("0");
  await page.getByRole("button", { name: "Share programme", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Home strength together", exact: true })).toBeVisible();
  const memberContext = await browser.newContext();
  const member = await memberContext.newPage();
  try {
    await login(member, "member");
    await member.goto("/coaching");
    const home = member.getByRole("article").filter({ has: member.getByRole("heading", { name: "Home strength together", exact: true }) });
    await expect(home).toBeVisible();
    await home.getByRole("button", { name: "Save to training", exact: true }).click();
    await expect(member.getByText("Added to your training plans.", { exact: true })).toBeVisible();
    await home.getByRole("button", { name: "Start workout", exact: true }).click();
    await expect(member.getByRole("heading", { name: "Bodyweight squat", exact: true })).toBeVisible();
    await member.getByRole("button", { name: "Complete set 1", exact: true }).click();
    await member.getByRole("button", { name: "Finish workout", exact: true }).click();
    await expect(member.getByRole("heading", { name: "Another session in the books.", exact: true })).toBeVisible();
    await member.goto("/coaching");
    await home.locator("summary").click();
    await home.getByLabel("How is this programme going?", { exact: true }).fill("Home session done. Please add a variation next time.");
    await home.getByRole("button", { name: "Mark complete", exact: true }).click();
    await expect(page.getByText("Member marked complete", { exact: true })).toBeVisible();
    await expect(page.getByText("Home session done. Please add a variation next time.", { exact: true })).toBeVisible();
    await page.locator(".coach-compose summary").click();
    await page.getByRole("button", { name: "Gym / online class", exact: true }).click();
    await page.getByLabel("Programme title", { exact: true }).fill("Saturday home class");
    await page.getByLabel("Instructions & what to bring", { exact: true }).fill("Bring water and a mat. We will train together online.");
    await page.getByLabel("Class date & time", { exact: true }).fill("2026-12-12T09:00");
    await page.getByLabel("Online class link (optional)", { exact: true }).fill("https://example.org/fitx-class");
    await page.getByLabel("Casey Member", { exact: true }).check();
    await page.getByRole("button", { name: "Share programme", exact: true }).click();
    await expect(member.getByRole("heading", { name: "Saturday home class", exact: true })).toBeVisible();
    await expect(member.getByRole("link", { name: /Open class link/ })).toHaveAttribute("href", "https://example.org/fitx-class");
    await env.withSecurityRulesDisabled(async ctx => {
      const { getDocs, collection } = await import("firebase/firestore");
      const [first, second] = await Promise.all([getDocs(collection(ctx.firestore(), "coachAssignments", "fixture-assignment", "programmes")), getDocs(collection(ctx.firestore(), "coachAssignments", "fixture-second-assignment", "programmes"))]);
      const classPlan = first.docs.find(doc => doc.data().title === "Saturday home class");
      expect(classPlan).toBeDefined(); expect(second.docs.some(doc => doc.id === classPlan?.id)).toBe(true);
      expect((await getDoc(doc(ctx.firestore(), "memberAccess", identities.member))).data()?.plan).toBe("free");
    });
    await page.getByRole("button", { name: "Nutrition plan", exact: true }).click();
    await page.getByLabel("Programme title", { exact: true }).fill("Balanced meal guidance");
    await page.getByLabel("Meals, portions & daily guidance", { exact: true }).fill("Include vegetables with lunch and dinner. Use the portions we agreed.");
    await page.getByRole("button", { name: "Share programme", exact: true }).click();
    await expect(member.getByText("Include vegetables with lunch and dinner. Use the portions we agreed.", { exact: true })).toBeVisible();
    await env.withSecurityRulesDisabled(ctx => setDoc(doc(ctx.firestore(), "siteSettings", "access"), { features: { nutrition: { mode: "disabled" } } }));
    await expect(member.getByText("Include vegetables with lunch and dinner. Use the portions we agreed.", { exact: true })).toHaveCount(0);
    await env.withSecurityRulesDisabled(ctx => setDoc(doc(ctx.firestore(), "siteSettings", "access"), { features: {} }));
    await expect(member.getByText("Include vegetables with lunch and dinner. Use the portions we agreed.", { exact: true })).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    await member.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: "test-results/coach-programmes-desktop.png", fullPage: true });
    await member.screenshot({ path: "test-results/member-coaching-desktop.png", fullPage: true });
    await member.setViewportSize({ width: 390, height: 844 });
    await member.getByRole("button", { name: "Switch to light mode" }).click();
    await member.screenshot({ path: "test-results/member-coaching-mobile-light.png", fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await member.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: "test-results/coach-programmes-mobile.png", fullPage: true });
    await page.getByRole("button", { name: "Withdraw Home strength together", exact: true }).click();
    await expect(member.getByRole("heading", { name: "Home strength together", exact: true })).toHaveCount(0);
  } finally { await memberContext.close(); }
});

test("member features keep working in desktop, mobile and light mode", async ({ page }) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/exercisedb.p.rapidapi.com/**", route => route.fulfill({ json: [] }));
  await page.route("**/api.spoonacular.com/**", route => route.fulfill({ json: { results: [], totalResults: 0 } }));
  await login(page, "member");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Alex");
  await expect(page.getByRole("heading", { name: "Smart suggestions", exact: true })).toBeVisible();
  await expect(page.locator(".member-content-stagger > *").last()).toHaveCSS("opacity", "1");
  await expect(page.locator(".member-data-tile").first()).not.toContainText("—");
  await page.screenshot({ path: "test-results/member-today-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "test-results/member-today-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  for (const path of ["/workout-planner", "/nutrition", "/progress", "/records", "/rewards", "/calendar", "/library", "/coaching", "/recipes", "/meal-planner", "/grocery-list", "/exercise-library", "/settings", "/support", "/membership"]) {
    await page.goto(path);
    await expect(page.locator(".member-shell").first()).toBeVisible();
    await expect(page.locator("main h1").first()).toBeVisible();
    await expect(page.getByText("We couldn't verify access.")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${path} should fit the phone`).toBe(true);
  }
  await page.getByRole("button", { name: "More member features" }).click();
  await expect(page.getByRole("dialog").getByRole("link", { name: "Grocery list" })).toBeVisible();
  await page.getByRole("dialog").getByRole("link", { name: "Grocery list" }).click();
  await expect(page).toHaveURL(/\/grocery-list$/);
  expect(errors).toEqual([]);
});

test("profile, grocery and nutrition writes survive the UI upgrade", async ({ page }) => {
  await login(page, "member");
  await page.goto("/settings");
  await page.getByPlaceholder("Your name", { exact: true }).fill("Alex Active");
  await page.getByRole("button", { name: "Save Changes", exact: true }).first().click();
  await expect.poll(async () => {
    let name;
    await env.withSecurityRulesDisabled(async ctx => { name = (await getDoc(doc(ctx.firestore(), "users", identities.member, "profile", "data"))).data()?.name; });
    return name;
  }).toBe("Alex Active");
  await page.goto("/grocery-list");
  await page.getByPlaceholder("Item (e.g. Bananas)").fill("Regression bananas");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("Regression bananas", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Regression bananas", { exact: true })).toBeVisible();
  await page.goto("/nutrition");
  await page.getByRole("button", { name: "Add a glass of water" }).click();
  await expect(page.getByText("1 / 8 glasses", { exact: true })).toBeVisible();
  await expect(page.getByText("Diary saved", { exact: true })).toBeVisible();
  await expect.poll(async () => {
    let water;
    await env.withSecurityRulesDisabled(async ctx => { water = (await getDoc(doc(ctx.firestore(), "users", identities.member, "foodLogs", new Date().toISOString().slice(0, 10)))).data()?.water; });
    return water;
  }).toBe(1);
  await page.goto("/dashboard");
  await expect(page.getByText("1 glasses of water logged", { exact: true })).toBeVisible();
});

test("publishing a brand syncs member, team, sign-in and offline app metadata", async ({ page, browser }) => {
  test.setTimeout(90000);
  const memberContext = await browser.newContext();
  const member = await memberContext.newPage();
  await login(member, "member");
  await login(page, "admin");
  await page.goto("/admin/settings");
  await page.getByLabel("App name", { exact: true }).fill("Pulse Studio");
  await page.getByLabel("Short name / installed app").fill("Pulse");
  await page.getByLabel("Tagline", { exact: true }).fill("Built for your rhythm.");
  await page.getByLabel("Main logo", { exact: true }).fill("/placeholder.svg");
  await page.getByLabel("Primary colour", { exact: true }).fill("262 65% 53%");
  await page.getByLabel("Today description").fill("Keep your own rhythm.");
  await page.getByLabel("Landing headline").fill("Find your rhythm.");
  await page.getByRole("tab", { name: "Feature access", exact: true }).click();
  await page.getByRole("tab", { name: "Brand studio", exact: true }).click();
  await expect(page.getByLabel("App name", { exact: true })).toHaveValue("Pulse Studio");
  await page.getByRole("button", { name: "Publish brand", exact: true }).click();
  await expect(page.getByText("Brand published across the app", { exact: true })).toBeVisible();
  await expect(member.getByRole("link", { name: "Pulse Studio home" })).toBeVisible();
  await expect(member.getByText("Keep your own rhythm.", { exact: true })).toBeVisible();
  await expect.poll(() => member.locator(".member-shell").first().evaluate(element => getComputedStyle(element).getPropertyValue("--primary").trim())).toBe("262 65% 53%");
  await expect(member).toHaveTitle("Pulse Studio");
  await page.screenshot({ path: "test-results/brand-studio.png", fullPage: true });
  await member.evaluate(async () => { await navigator.serviceWorker.ready; });
  await member.reload();
  await expect.poll(() => member.evaluate(async () => (await (await fetch("/manifest.webmanifest")).json()).name)).toBe("Pulse Studio");
  await memberContext.setOffline(true);
  await member.reload();
  await expect(member.getByRole("link", { name: "Pulse Studio home" })).toBeVisible();
  await expect(member.getByText("Keep your own rhythm.", { exact: true })).toBeVisible();
  await memberContext.setOffline(false);
  const guest = await browser.newContext();
  const landing = await guest.newPage();
  await landing.goto("/");
  await expect(landing.getByRole("heading", { name: /Find your rhythm/ })).toBeVisible();
  await landing.goto("/auth");
  await expect(landing.getByText("Pulse Studio", { exact: true })).toBeVisible();
  await guest.close();
  await memberContext.close();
});

test("admins disable Nutrition, restore it behind a paywall and grant or revoke membership live", async ({ page, browser }) => {
  test.setTimeout(90000);
  const context = await browser.newContext();
  const member = await context.newPage();
  await login(member, "member");
  await member.goto("/nutrition");
  await login(page, "admin");
  await page.goto("/admin/settings");
  await page.getByRole("tab", { name: "Feature access", exact: true }).click();
  await page.locator("#mode-nutrition").selectOption("disabled");
  await page.getByRole("button", { name: "Publish feature access" }).click();
  await expect(member.getByRole("heading", { name: "Nutrition is currently unavailable." })).toBeVisible();
  await expect(member.getByRole("navigation", { name: "Member navigation", exact: true }).getByRole("link", { name: "Nutrition", exact: true })).toHaveCount(0);
  for (const path of ["/recipes", "/meal-planner", "/grocery-list", "/NUTRITION/", "/n%75trition", "/Recipes/"]) {
    await member.goto(path);
    await expect(member.getByRole("heading", { name: "Nutrition is currently unavailable." })).toBeVisible();
  }
  await member.goto("/nutrition");
  await page.locator("#mode-nutrition").selectOption("premium");
  await page.getByRole("button", { name: "Publish feature access" }).click();
  await expect(member.getByRole("link", { name: "View membership", exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/feature-access.png", fullPage: true });
  await member.screenshot({ path: "test-results/member-paywall.png", fullPage: true });
  await page.getByRole("tab", { name: "Memberships", exact: true }).click();
  await page.getByRole("button", { name: /member@fitx.test/ }).click();
  await page.getByLabel("Membership plan", { exact: true }).selectOption("plus");
  await page.getByRole("button", { name: "Save membership", exact: true }).click();
  await expect(member.getByRole("heading", { name: "Fuel your everyday." })).toBeVisible();
  await page.getByRole("button", { name: "Revoke premium access", exact: true }).click();
  await expect(member.getByRole("link", { name: "View membership", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Feature access", exact: true }).click();
  await page.locator("#mode-nutrition").selectOption("free");
  await page.getByRole("button", { name: "Publish feature access" }).click();
  await expect(member.getByRole("heading", { name: "Fuel your everyday." })).toBeVisible();
  await context.close();
});

test("Nutrition child paywalls cannot be bypassed through embedded tabs", async ({ page }) => {
  await env.withSecurityRulesDisabled(async ctx => {
    await setDoc(doc(ctx.firestore(), "siteSettings", "access"), { features: { recipes: { mode: "premium", requiredPlan: "pro" }, mealPlanner: { mode: "disabled" }, barcode: { mode: "premium" } } });
    await setDoc(doc(ctx.firestore(), "users", identities.member, "mealPlanEntries", "hidden-meal-fixture"), { date: new Date().toISOString().slice(0, 10), meals: [{ id: 123, title: "Hidden meal-plan fixture" }] });
  });
  await login(page, "member");
  await page.goto("/nutrition");
  await page.getByRole("button", { name: "Recipes · Premium", exact: true }).click();
  await expect(page.getByRole("region", { name: "Recipes access", exact: true })).toBeVisible();
  await expect(page.getByPlaceholder("Search recipes, ingredients, cuisine...")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Meal Plan", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Barcode Scan · Premium", exact: true }).click();
  await expect(page.getByRole("region", { name: "Barcode scanner access", exact: true })).toBeVisible();
  await expect(page.getByPlaceholder("Type UPC/EAN (e.g. 028400064057)")).toHaveCount(0);
  await page.goto("/library");
  await expect(page.getByRole("button", { name: "Meal Plans", exact: true })).toHaveCount(0);
  await page.goto("/calendar");
  await expect(page.getByRole("heading", { name: "Your fitness calendar", exact: true })).toBeVisible();
  await page.getByRole("button", { name: String(new Date().getDate()), exact: true }).click();
  await expect(page.getByText("Meal Plan", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Hidden meal-plan fixture", { exact: true })).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/dashboard");
  expect(await page.locator(".member-today-hero").evaluate(element => getComputedStyle(element, "::after").animationName)).toBe("none");
});

test("member names survive sign-in, preferred greetings sync and weekly targets are editable", async ({ page }) => {
  test.setTimeout(90000);
  const visitedRoutes: string[] = [];
  page.on("framenavigated", frame => { if (frame === page.mainFrame()) visitedRoutes.push(new URL(frame.url()).pathname); });
  await env.withSecurityRulesDisabled(async ctx => {
    await setDoc(doc(ctx.firestore(), "users", identities.member), { name: "FitX QA" }, { merge: true });
    await setDoc(doc(ctx.firestore(), "users", identities.member, "profile", "data"), { name: "Jamie Morgan" }, { merge: true });
  });
  await login(page, "member");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Jamie Morgan");
  await page.goto("/settings");
  await expect(page.getByLabel("Display Name", { exact: true })).toHaveValue("Jamie Morgan");
  await page.getByLabel("Greeting name (optional)", { exact: true }).fill("Jamie");
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect.poll(async () => {
    let savedName;
    await env.withSecurityRulesDisabled(async ctx => { savedName = (await getDoc(doc(ctx.firestore(), "users", identities.member, "profile", "data"))).data()?.greetingName; });
    return savedName;
  }).toBe("Jamie");
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(", Jamie.");
  await page.getByRole("link", { name: "Edit weekly training target" }).click();
  await page.getByLabel("Weekly training target", { exact: true }).selectOption("5");
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect.poll(async () => {
    let target;
    await env.withSecurityRulesDisabled(async ctx => { target = (await getDoc(doc(ctx.firestore(), "users", identities.member, "profile", "data"))).data()?.daysPerWeek; });
    return target;
  }).toBe(5);
  await page.goto("/dashboard");
  await expect(page.getByText("/ 5", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  await expect(page).toHaveURL(/\/(?:auth)?$/);
  await login(page, "member");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(", Jamie.");
  await page.goto("/settings");
  await expect(page.getByLabel("Display Name", { exact: true })).toHaveValue("Jamie Morgan");
  await expect(page.getByLabel("Greeting name (optional)", { exact: true })).toHaveValue("Jamie");
  expect(visitedRoutes).not.toContain("/onboarding");
});

test("team accounts can switch into their own member view and return without changing roles", async ({ page }) => {
  await login(page, "admin");
  await page.locator(".workspace-member-switch").click();
  await expect(page).toHaveURL(/\/dashboard\?view=member$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Admin Team");
  await expect(page.locator(".member-preview-banner")).toContainText("Administrator preview access");
  const nav = page.getByRole("navigation", { name: "Member navigation", exact: true });
  await nav.getByRole("link", { name: "Training", exact: true }).click();
  await nav.getByRole("link", { name: "Today", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\?view=member$/);
  await page.locator(".member-preview-banner").getByRole("link", { name: "Back to team workspace" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.screenshot({ path: "test-results/admin-colour-upgrade.png", fullPage: true });
});

test("free plans show future prices, save interest live for admins and preserve free access", async ({ page, browser }) => {
  test.setTimeout(90000);
  await env.withSecurityRulesDisabled(async ctx => {
    await setDoc(doc(ctx.firestore(), "users", identities.member, "foodLogs", new Date().toISOString().slice(0, 10)), { foods: [], water: 2 });
  });
  const memberContext = await browser.newContext();
  const member = await memberContext.newPage();
  await login(member, "member");
  await member.goto("/membership");
  await expect(member.getByText("Everything available today is free.", { exact: true })).toBeVisible();
  await expect(member.getByRole("region", { name: "Free plan", exact: true })).toContainText("Nutrition");
  await expect(member.getByRole("region", { name: "Plus plan", exact: true })).toContainText("R79 / month");
  await expect(member.getByRole("region", { name: "Pro plan", exact: true })).toContainText("R149 / month");
  await member.screenshot({ path: "test-results/membership-desktop.png", fullPage: true });
  await member.getByRole("button", { name: "Notify me about Pro", exact: true }).click();
  await expect(member.getByRole("button", { name: "Interest saved", exact: true })).toBeVisible();
  await login(page, "admin");
  await page.goto("/admin/settings");
  await page.getByRole("tab", { name: "Memberships", exact: true }).click();
  await page.getByRole("button", { name: /^Interested in Pro/ }).click();
  await page.getByRole("button", { name: /member@fitx.test/ }).click();
  await expect(page.getByText("Registered interest: Pro", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Membership plan", { exact: true })).toHaveValue("free");
  await member.reload();
  await expect(member.getByRole("button", { name: "Interest saved", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Feature access", exact: true }).click();
  await page.getByLabel("Plus display price", { exact: true }).fill("R89 / month");
  await page.getByLabel("Planned Plus extras", { exact: true }).fill("Weekly performance insights\nPersonal training recommendations");
  await page.getByRole("button", { name: "Publish feature access" }).click();
  await expect(member.getByRole("region", { name: "Plus plan", exact: true })).toContainText("R89 / month");
  await expect(member.getByText("Weekly performance insights", { exact: true })).toBeVisible();
  await member.getByRole("button", { name: "Remove my interest", exact: true }).click();
  await expect(member.getByRole("button", { name: "Notify me about Pro", exact: true })).toBeVisible();
  await member.setViewportSize({ width: 390, height: 844 });
  await member.getByRole("button", { name: "Switch to light mode", exact: true }).click();
  await member.evaluate(() => window.scrollTo(0, 0));
  await member.screenshot({ path: "test-results/membership-mobile-light.png", fullPage: true });
  expect(await member.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await member.goto("/dashboard");
  await expect(member.getByRole("region", { name: "Today check-in", exact: true })).toBeVisible();
  await expect(member.getByRole("link", { name: "Make time for water: complete", exact: true })).toBeVisible();
  await member.emulateMedia({ reducedMotion: "reduce" });
  expect(await member.locator(".member-hero-ring").evaluate(element => getComputedStyle(element).animationName)).toBe("none");
  await member.screenshot({ path: "test-results/member-today-light.png", fullPage: true });
  await memberContext.close();
});

test("community groups sync chat, collaborative workouts, class bookings and moderation between accounts", async ({ page, browser }) => {
  test.setTimeout(180000);
  await env.withSecurityRulesDisabled(ctx => setDoc(doc(ctx.firestore(), "siteSettings", "access"), { features: { community: { mode: "free" } } }));
  await login(page, "coach"); await page.goto("/admin/community");
  await page.getByRole("button", { name: "Create group", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Group name", { exact: true }).fill("Momentum community");
  await dialog.getByLabel("About this group", { exact: true }).fill("A little encouragement between sessions.");
  await dialog.getByLabel("Alex Member", { exact: true }).check();
  await dialog.getByLabel("Taylor Member", { exact: true }).check();
  await dialog.getByRole("button", { name: "Create group", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Momentum community", exact: true })).toBeVisible();
  const contexts = await Promise.all([browser.newContext(), browser.newContext(), browser.newContext()]);
  const [member, second, mod] = await Promise.all(contexts.map(context => context.newPage()));
  const errors: string[] = [];
  [page, member, second, mod].forEach(surface => surface.on("pageerror", error => errors.push(error.message)));
  try {
    for (const [surface, role] of [[member, "member"], [second, "member2"]] as const) {
      await login(surface, role); await surface.goto("/community");
      await surface.getByRole("button", { name: /Momentum community/ }).click();
      await expect(surface.getByRole("heading", { name: "Momentum community", exact: true })).toBeVisible();
    }
    await member.getByLabel("Message your group", { exact: true }).fill("Hello from Alex 💪");
    await expect(page.getByText("Alex is typing…", { exact: true })).toBeVisible();
    await member.getByRole("button", { name: "Send message", exact: true }).click();
    await expect(page.getByText("Hello from Alex 💪", { exact: true })).toBeVisible();
    await expect(second.getByText("Hello from Alex 💪", { exact: true })).toBeVisible();
    await expect(member.getByLabel(/Read by [12] participants?/).first()).toBeVisible();
    await page.getByLabel("Message your group", { exact: true }).fill("Welcome to your group!");
    await page.getByRole("button", { name: "Send message", exact: true }).click();
    const welcome = member.getByRole("article").filter({ has: member.locator(".community-message-text").filter({ hasText: /^Welcome to your group!$/ }) });
    await expect(welcome).toBeVisible();
    await welcome.locator("..").getByRole("button", { name: /Actions for message/ }).click();
    await member.getByRole("button", { name: "React ❤️", exact: true }).click(); await member.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: /React ❤️ to message/ })).toBeVisible();
    await welcome.locator("..").getByRole("button", { name: /Actions for message/ }).click();
    await member.getByRole("button", { name: "Reply", exact: true }).click(); await member.keyboard.press("Escape");
    await member.getByLabel("Message your group", { exact: true }).fill("Ready for our next class 😊");
    await member.getByRole("button", { name: "Send message", exact: true }).click();
    await expect(page.getByText("Ready for our next class 😊", { exact: true })).toBeVisible();
    await member.getByRole("button", { name: "Choose an emoji", exact: true }).click();
    await member.getByRole("button", { name: "Insert 🎉", exact: true }).click(); await member.keyboard.press("Escape");
    await member.getByRole("button", { name: "Send message", exact: true }).click();
    await expect(page.getByText("🎉", { exact: true })).toBeVisible();
    await member.setViewportSize({ width: 375, height: 667 });
    await member.getByRole("button", { name: "Switch to light mode" }).click();
    expect(await member.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await member.evaluate(() => window.scrollTo(0, 0));
    const composer = await member.getByLabel("Message your group", { exact: true }).boundingBox();
    const bottomNav = await member.getByRole("navigation", { name: "Mobile member navigation", exact: true }).boundingBox();
    expect((composer?.y || 0) + (composer?.height || 0)).toBeLessThanOrEqual(bottomNav?.y || 0);
    await member.screenshot({ path: "test-results/community-chat-mobile.png", fullPage: true });
    for (const surface of [member, second, page]) await surface.getByRole("navigation", { name: "Group sections", exact: true }).getByRole("button", { name: "Activities", exact: true }).click();
    await member.getByRole("button", { name: "Create shared workout", exact: true }).click();
    await member.getByLabel("Activity title", { exact: true }).fill("Our shared strength workout");
    await member.getByLabel("Instructions or message", { exact: true }).fill("A steady session we build together.");
    await member.getByLabel("Exercise 1", { exact: true }).fill("Bodyweight squat");
    await member.getByRole("button", { name: "Share workout draft", exact: true }).click();
    const shared = (surface: Page) => surface.getByRole("article").filter({ has: surface.getByRole("heading", { name: "Our shared strength workout", exact: true }) });
    await expect(shared(second)).toBeVisible();
    await expect(shared(member).getByRole("button", { name: "Start workout" })).toHaveCount(0);
    await shared(second).getByRole("button", { name: "Improve draft", exact: true }).click();
    await second.getByLabel("Instructions or message", { exact: true }).fill("A steady session. Taylor added a warm-up reminder.");
    await second.getByRole("button", { name: "Save changes", exact: true }).click();
    await expect(shared(page).getByText("A steady session. Taylor added a warm-up reminder.", { exact: true })).toBeVisible();
    await shared(page).getByRole("button", { name: "Approve & publish", exact: true }).click();
    await expect(shared(member).getByRole("button", { name: "Start workout", exact: true })).toBeVisible();
    await shared(member).getByRole("button", { name: "Save to training", exact: true }).click();
    await expect(member.getByText("Added to your training plans.", { exact: true })).toBeVisible();
    const today = new Date().toISOString().slice(0, 10);
    async function share(kind: string, title: string, details: string) {
      await page.getByRole("button", { name: "Share activity", exact: true }).click();
      await page.getByLabel("Activity type", { exact: true }).selectOption(kind);
      await page.getByLabel("Activity title", { exact: true }).fill(title);
      await page.getByLabel("Instructions or message", { exact: true }).fill(details);
      if (kind === "class") { await page.getByLabel("Class date and time", { exact: true }).fill(`${today}T18:30`); await page.getByLabel("Online class link (optional)", { exact: true }).fill("https://example.org/community-class"); }
      await page.getByRole("button", { name: "Share with group", exact: true }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(member.getByRole("heading", { name: title, exact: true })).toBeVisible();
    }
    await share("class", "Home mobility together", "Bring your mat and water.");
    const classCard = member.getByRole("article").filter({ has: member.getByRole("heading", { name: "Home mobility together", exact: true }) });
    await classCard.getByRole("button", { name: "Book class", exact: true }).click();
    await expect(page.getByText("1 booked · Alex Member", { exact: true })).toBeVisible();
    await classCard.getByRole("button", { name: "Cancel booking", exact: true }).click();
    await expect(page.getByText("0 booked · Be the first to join", { exact: true })).toBeVisible();
    await classCard.getByRole("button", { name: "Book class", exact: true }).click();
    await classCard.getByRole("button", { name: "Add to Calendar", exact: true }).click();
    await expect(member.getByText("Class reminder added to Calendar. Check the group for schedule updates.", { exact: true })).toBeVisible();
    await member.goto("/calendar");
    await member.getByRole("button", { name: String(new Date().getDate()), exact: true }).click();
    await expect(member.getByText("Home mobility together", { exact: true })).toBeVisible();
    await member.getByRole("link", { name: "View class details", exact: true }).click();
    await expect(member.getByRole("heading", { name: "Home mobility together", exact: true })).toBeVisible();
    await share("nutrition", "Balanced plate guidance", "Include vegetables with lunch and dinner.");
    await share("challenge", "Five days of movement", "Keep a daily movement habit this week.");
    await member.getByRole("button", { name: "Join challenge", exact: true }).click();
    await share("announcement", "Saturday schedule update", "This Saturday’s session starts at 10.");
    await page.screenshot({ path: "test-results/community-activities-coach.png", fullPage: true });
    await member.screenshot({ path: "test-results/community-activities-mobile.png", fullPage: true });
    expect(await member.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await member.getByRole("navigation", { name: "Group sections" }).getByRole("button", { name: "Conversation", exact: true }).click();
    await welcome.locator("..").getByRole("button", { name: /Actions for message/ }).click();
    await member.getByRole("button", { name: "Report privately", exact: true }).click(); await member.keyboard.press("Escape");
    await login(mod, "moderator"); await mod.goto("/admin/community");
    await mod.getByRole("button", { name: /Momentum community/ }).click();
    await mod.getByRole("navigation", { name: "Group sections" }).getByRole("button", { name: "Moderation", exact: true }).click();
    await expect(mod.getByText("Welcome to your group!", { exact: true })).toBeVisible();
    await mod.getByRole("button", { name: "Remove message & resolve", exact: true }).click();
    await expect(member.getByText("This message was removed.", { exact: true })).toBeVisible();
    await mod.getByRole("navigation", { name: "Group sections" }).getByRole("button", { name: "Members", exact: true }).click();
    await mod.getByRole("button", { name: "Remove Taylor Member from group", exact: true }).click();
    await expect(mod.getByText("Member removed from the group", { exact: true })).toBeVisible();
    await expect(second.getByRole("heading", { name: "Momentum community", exact: true })).toHaveCount(0);
    await expect(second.getByText("Your next chapter starts together.", { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  } finally { await Promise.all(contexts.map(context => context.close().catch(() => {}))); }
});

test("admin Community switch hides menus, blocks links and restores paid access live", async ({ page, browser }) => {
  test.setTimeout(90000);
  const context = await browser.newContext({ viewport: { width: 375, height: 667 } });
  const member = await context.newPage();
  try {
    await login(member, "member");
    await member.getByRole("button", { name: "More member features", exact: true }).click();
    await expect(member.getByRole("dialog").getByRole("link", { name: "Community", exact: true })).toHaveCount(0); await member.keyboard.press("Escape");
    await member.goto("/community");
    await expect(member.getByRole("heading", { name: "Community is currently unavailable.", exact: true })).toBeVisible();
    await login(page, "admin"); await page.goto("/admin/settings");
    await page.getByRole("tab", { name: "Feature access", exact: true }).click();
    await page.locator("#mode-community").selectOption("free");
    await page.getByRole("button", { name: "Publish feature access", exact: true }).click();
    await expect(member.getByRole("heading", { name: "Find your people. Keep your momentum.", exact: true })).toBeVisible();
    await member.getByRole("button", { name: "More member features", exact: true }).click();
    await expect(member.getByRole("dialog").getByRole("link", { name: "Community", exact: true })).toBeVisible(); await member.keyboard.press("Escape");
    await page.locator("#mode-community").selectOption("premium"); await page.locator("#plan-community").selectOption("pro");
    await page.getByRole("button", { name: "Publish feature access", exact: true }).click();
    await expect(member.getByRole("link", { name: "View membership", exact: true })).toBeVisible();
    await page.getByRole("tab", { name: "Memberships", exact: true }).click();
    await page.getByRole("button", { name: /member@fitx.test/ }).click();
    await page.getByLabel("Membership plan", { exact: true }).selectOption("pro");
    await page.getByRole("button", { name: "Save membership", exact: true }).click();
    await expect(member.getByRole("heading", { name: "Find your people. Keep your momentum.", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Revoke premium access", exact: true }).click();
    await expect(member.getByRole("link", { name: "View membership", exact: true })).toBeVisible();
  } finally { await context.close(); }
});

test("phone Account settings and meal-only Calendar stay within the viewport", async ({ page }) => {
  await env.withSecurityRulesDisabled(async ctx => {
    const { getDocs, collection, deleteDoc } = await import("firebase/firestore");
    const entries = await getDocs(collection(ctx.firestore(), "users", identities.member, "calendarEntries"));
    await Promise.all(entries.docs.map(item => deleteDoc(item.ref)));
    const date = new Date().toISOString().slice(0, 10);
    await setDoc(doc(ctx.firestore(), "users", identities.member, "mealPlanEntries", "overflow-meal"), { date, meals: [{ id: 333, title: "VegetableAndChickenMealWithAnExceptionallyLongUnbrokenNameForNarrowPhones", readyInMinutes: 25 }], nutrients: { calories: 123456, protein: 123456, carbohydrates: 123456, fat: 123456 } });
  });
  await login(page, "member");
  for (const width of [320, 375, 390]) {
    await env.withSecurityRulesDisabled(async ctx => { const { deleteDoc } = await import("firebase/firestore"); await deleteDoc(doc(ctx.firestore(), "users", identities.member, "calendarEntries", "overflow-with-workout")); });
    await page.setViewportSize({ width, height: 667 }); await page.goto("/settings");
    await page.getByRole("button", { name: "Account", exact: true }).click();
    await expect(page.getByRole("button", { name: "Send link", exact: true })).toBeVisible();
    await page.getByRole("button", { name: /Change password/ }).click();
    await page.getByRole("button", { name: /Delete account/ }).click();
    await expect(page.getByPlaceholder("Current password", { exact: true })).toBeVisible();
    await expect(page.getByPlaceholder("Type DELETE to confirm", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `Account at ${width}px`).toBe(true);
    const securityButtons = page.getByRole("button", { name: /Send link|Update password|Delete forever/ });
    for (const button of await securityButtons.all()) { const box = await button.boundingBox(); expect(box?.x).toBeGreaterThanOrEqual(0); expect((box?.x || 0) + (box?.width || 0)).toBeLessThanOrEqual(width); }
    if (width === 375) await page.screenshot({ path: "test-results/account-settings-mobile.png", fullPage: true });
    await page.goto("/calendar");
    await page.getByRole("button", { name: String(new Date().getDate()), exact: true }).click();
    await expect(page.getByText("VegetableAndChickenMealWithAnExceptionallyLongUnbrokenNameForNarrowPhones", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `Meal-only Calendar at ${width}px`).toBe(true);
    if (width === 375) await page.screenshot({ path: "test-results/meal-calendar-mobile.png", fullPage: true });
    await env.withSecurityRulesDisabled(ctx => setDoc(doc(ctx.firestore(), "users", identities.member, "calendarEntries", "overflow-with-workout"), { date: new Date().toISOString().slice(0, 10), planId: "fixture-plan", planName: "Workout with a meal", completed: false }));
    await page.reload(); await page.getByRole("button", { name: String(new Date().getDate()), exact: true }).click();
    await expect(page.getByText("Workout with a meal", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `Workout and meal Calendar at ${width}px`).toBe(true);
    await expect(page.getByRole("button", { name: "Open member menu" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "More member features", exact: true })).toHaveCount(1);
  }
});

test("earlier conversation history stays live and offline drafts survive reconnect", async ({ page, context }) => {
  test.setTimeout(90000);
  const groupId = "history-community";
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    await setDoc(doc(db, "siteSettings", "access"), { features: { community: { mode: "free" } } });
    await setDoc(doc(db, "communityGroups", groupId), { name: "Conversation history", description: "History and reconnection", tone: "blue", coachId: identities.coach, status: "active", createdBy: identities.coach, createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
    await setDoc(doc(db, "communityGroups", groupId, "members", identities.member), { uid: identities.member, name: "Alex Member", role: "member", assignmentId: "fixture-assignment", status: "active", joinedAt: Timestamp.now() });
    await setDoc(doc(db, "communityGroups", groupId, "members", identities.coach), { uid: identities.coach, name: "Coach", role: "coach", assignmentId: "", status: "active", joinedAt: Timestamp.now() });
    await setDoc(doc(db, "communityMemberships", identities.member, "groups", groupId), { uid: identities.member, groupId, status: "active", joinedAt: Timestamp.now() });
    for (let i = 0; i < 100; i++) await setDoc(doc(db, "communityGroups", groupId, "messages", `history-${i}`), { senderId: identities.coach, senderName: "Coach", senderRole: "coach", text: `History message ${String(i).padStart(3, "0")}`, replyTo: "", reactions: {}, status: "visible", createdAt: Timestamp.fromMillis(Date.now() - 3600000 + i * 1000) });
  });
  await login(page, "member"); await page.goto("/community");
  await page.getByRole("button", { name: /Conversation history/ }).click();
  await expect(page.getByText("History message 099", { exact: true })).toBeVisible();
  await expect(page.getByText("History message 000", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Load earlier messages", exact: true }).click();
  await expect(page.getByText("History message 000", { exact: true })).toBeVisible();
  const { updateDoc, serverTimestamp, writeBatch } = await import("firebase/firestore");
  await updateDoc(doc(env.authenticatedContext(identities.moderator).firestore(), "communityGroups", groupId, "messages", "history-0"), { status: "removed", text: "", reactions: {}, removedBy: identities.moderator, removedAt: serverTimestamp() });
  await expect(page.getByText("History message 000", { exact: true })).toHaveCount(0);
  await expect(page.getByText("This message was removed.", { exact: true })).toBeVisible();
  await page.getByLabel("Message your group", { exact: true }).fill("A draft I can keep 😊");
  await page.reload(); await expect(page.getByLabel("Message your group", { exact: true })).toHaveValue("A draft I can keep 😊");
  await context.setOffline(true);
  await expect(page.locator(".community-chat-toolbar")).toContainText("Offline");
  await expect(page.getByRole("button", { name: "Send message", exact: true })).toBeDisabled();
  const coachDb = env.authenticatedContext(identities.coach).firestore();
  const message = writeBatch(coachDb);
  message.set(doc(coachDb, "communityGroups", groupId, "messages", "reconnect"), { senderId: identities.coach, senderName: "Coach", senderRole: "coach", text: "Catch up when you return", replyTo: "", reactions: {}, status: "visible", createdAt: serverTimestamp() });
  message.update(doc(coachDb, "communityGroups", groupId), { lastMessageAt: serverTimestamp() });
  await message.commit();
  await context.setOffline(false);
  await expect(page.getByText("Catch up when you return", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Message your group", { exact: true })).toHaveValue("A draft I can keep 😊");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.getByRole("log", { name: "Group conversation", exact: true }).getByText("A draft I can keep 😊", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Message your group", { exact: true })).toHaveValue("");
  const adminDb = env.authenticatedContext(identities.admin).firestore();
  await updateDoc(doc(adminDb, "coachAssignments", "fixture-assignment"), { status: "archived" });
  await expect(page.getByRole("heading", { name: "Conversation history", exact: true })).toHaveCount(0);
  await updateDoc(doc(adminDb, "coachAssignments", "fixture-assignment"), { status: "active" });
  await expect(page.getByRole("button", { name: /Conversation history/ })).toBeVisible();
  await page.getByRole("button", { name: /Conversation history/ }).click();
  await expect(page.getByRole("heading", { name: "Conversation history", exact: true })).toBeVisible();
  await updateDoc(doc(coachDb, "communityGroups", groupId), { status: "archived", updatedAt: serverTimestamp() });
  await expect(page.getByRole("heading", { name: "Conversation history", exact: true })).toHaveCount(0);
  await updateDoc(doc(coachDb, "communityGroups", groupId), { status: "active", updatedAt: serverTimestamp() });
  await expect(page.getByRole("button", { name: /Conversation history/ })).toBeVisible();
});
