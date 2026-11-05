import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:4174",
    browserName: "chromium",
    channel: process.env.CI ? undefined : "msedge",
  },
  webServer: {
    command: "npm run build && npm run preview -- --port 4174",
    env: {
      VITE_SUPABASE_URL: "https://bix-fixture.supabase.co",
      VITE_SUPABASE_ANON_KEY: "fixture-public-anon",
    },
    timeout: 180000,
    url: "http://127.0.0.1:4174",
    reuseExistingServer: false,
  },
});
