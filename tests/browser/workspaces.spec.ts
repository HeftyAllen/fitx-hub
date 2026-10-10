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
  for (const path of ["/workout-planner", "/nutrition", "/progress", "/records", "/rewards", "/calendar", "/library", "/recipes", "/meal-planner", "/grocery-list", "/exercise-library", "/settings", "/support", "/membership"]) {
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
