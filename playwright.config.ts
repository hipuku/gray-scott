import { defineConfig, devices } from '@playwright/test'

/* End to end, against the production build in a real browser. The unit
   suite renders each view in jsdom, which cannot compute layout or colour, so
   contrast, focus visibility and the worker only get checked here. */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: 'http://localhost:4183',
    trace: 'on-first-retry',
    // Desktop only: below lg the app shows a notice instead of the tool.
    viewport: { width: 1440, height: 900 },
  },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4183 --strictPort',
    url: 'http://localhost:4183',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
})
