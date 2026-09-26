import { defineConfig, devices } from '@playwright/test';

/**
 * playwright.config.ts  (Part 77)
 *
 * Minimal real E2E: exercises the real browser against the local WEB
 * (http://localhost:5000) and the local API (http://localhost:3001), never
 * replacing the flow with direct Supabase calls. Requires both
 * to be already running (`pnpm dev`) and the institutional test
 * credentials to be in the environment variables below — the specs skip
 * gracefully (test.skip) when absent, so they never break `pnpm test`
 * for whoever has no access to those credentials.
 *
 * Never records video/trace with a password, never takes a screenshot with filled
 * fields — see e2e/login-and-password-change.spec.ts.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_WEB_URL ?? 'http://localhost:5000',
    trace: 'off',
    video: 'off',
    screenshot: 'off',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
