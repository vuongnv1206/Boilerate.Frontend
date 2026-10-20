import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  workers: process.env['CI'] ? 2 : 3,
  reporter: [['list'], ['html', { outputFolder: 'artifacts/playwright-report', open: 'never' }]],
  outputDir: 'artifacts/playwright-results',
  snapshotPathTemplate: '{testDir}/snapshots/{platform}/{projectName}/{arg}{ext}',
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.002 } },
  use: {
    browserName: 'chromium',
    baseURL: 'http://127.0.0.1:4300',
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh',
    reducedMotion: 'no-preference',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    ...['light', 'dark'].flatMap((colorScheme) =>
      [
        { name: 'desktop', viewport: { width: 1440, height: 900 } },
        { name: 'tablet', viewport: { width: 1024, height: 768 } },
        { name: 'mobile', viewport: { width: 390, height: 844 } },
      ].map(({ name, viewport }) => ({
        name: `${name}-${colorScheme}`,
        use: { viewport, colorScheme: colorScheme as 'light' | 'dark' },
      })),
    ),
  ],
  webServer: {
    command: 'node scripts/serve-dist.mjs',
    url: 'http://127.0.0.1:4300',
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
