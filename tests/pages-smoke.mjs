import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { chromium, expect } from "@playwright/test";

// Serve only actual files, with the same 404 behavior as Pages (no SPA fallback).
const base = "/fitx-hub/";
const root = resolve("dist");
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon" };
const server = createServer(async (req, res) => {
  const path = new URL(req.url, "http://localhost").pathname;
  const file = resolve(root, path.startsWith(base) ? path.slice(base.length) || "index.html" : "missing");
  try {
    if (!file.startsWith(`${root}/`)) throw new Error("Outside site");
    const content = await readFile(file);
    res.writeHead(200, { "Content-Type": types[extname(file)] || "application/octet-stream" });
    res.end(content);
  } catch {
    res.writeHead(404, { "Content-Type": "text/html" });
    res.end(await readFile(resolve(root, "404.html")));
  }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({
    executablePath: process.env.FITX_BROWSER_EXECUTABLE || undefined,
    args: process.env.FITX_BROWSER_ARGS ? JSON.parse(process.env.FITX_BROWSER_ARGS) : undefined,
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  const missingAssets = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("response", response => {
    const url = new URL(response.url());
    if (url.origin === origin && response.status() >= 400 && /\.(js|css|webmanifest|svg|png|ico)$/.test(url.pathname)) missingAssets.push(url.pathname);
  });
  await page.goto(`${origin}${base}`);
  await expect(page.locator("h1")).toBeVisible();
  await page.getByRole("link", { name: "Sign in", exact: true }).first().click();
  await expect(page.getByPlaceholder("Email", { exact: true })).toBeVisible();
  assert.equal(new URL(page.url()).pathname, base);
  assert.equal(new URL(page.url()).hash, "#/auth");
  await page.reload();
  await expect(page.getByPlaceholder("Email", { exact: true })).toBeVisible();
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  const registration = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
  assert.equal(new URL(registration).pathname, base);
  const manifest = await page.evaluate(async () => (await fetch(document.querySelector('link[rel="manifest"]').href)).json());
  assert.equal(new URL(manifest.scope, `${origin}${base}manifest.webmanifest`).pathname, base);
  for (const icon of manifest.icons) assert.equal((await page.request.get(new URL(icon.src, `${origin}${base}manifest.webmanifest`).href)).status(), 200);
  await page.goto(`${origin}${base}auth?return=nutrition`);
  await expect(page.getByPlaceholder("Email", { exact: true })).toBeVisible();
  assert.equal(new URL(page.url()).pathname, base);
  assert.equal(new URL(page.url()).hash, "#/auth?return=nutrition");
  await page.goto(`${origin}${base}nutrition?date=2026-10-09`);
  await expect(page.getByRole("link", { name: "Sign in", exact: true }).first()).toBeVisible();
  assert.equal(new URL(page.url()).hash, "#/");
  await page.getByRole("link", { name: "Sign in", exact: true }).first().click();
  await expect(page.getByPlaceholder("Email", { exact: true })).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByPlaceholder("Email", { exact: true })).toBeVisible();
  const cachedManifest = await page.evaluate(async () => (await fetch(document.querySelector('link[rel="manifest"]').href)).json());
  assert.equal(new URL(cachedManifest.start_url, `${origin}${base}manifest.webmanifest`).pathname, base);
  assert.deepEqual(missingAssets, []);
  assert.deepEqual(errors, []);
  console.log("Pages smoke passed: landing, sign-in navigation, reload, direct-path redirect, manifest/icons, scoped worker and offline reload.");
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
