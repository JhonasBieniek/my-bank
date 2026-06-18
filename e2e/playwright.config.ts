import { defineConfig } from '@playwright/test';

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3000';
const FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL ?? 'http://localhost:4200';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],
  globalSetup: require.resolve('./global-setup'),
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'api-security',
      testMatch: /^(?!.*browser-security).*\.spec\.ts$/,
      use: {
        baseURL: API_BASE_URL,
      },
    },
    {
      name: 'browser-security',
      testMatch: /browser-security\.spec\.ts$/,
      use: {
        baseURL: FRONTEND_BASE_URL,
        browserName: 'chromium',
      },
    },
  ],
});
