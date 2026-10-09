import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  timeout: 45000,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:4173",
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
    launchOptions: process.env.FITX_BROWSER_EXECUTABLE
      ? { executablePath: process.env.FITX_BROWSER_EXECUTABLE, args: process.env.FITX_BROWSER_ARGS ? JSON.parse(process.env.FITX_BROWSER_ARGS) : undefined }
      : undefined,
  },
  webServer: {
    command: "npm run preview -- --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
  },
});
