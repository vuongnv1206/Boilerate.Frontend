import { defineConfig } from '@playwright/test';

// Start through scripts/live-acceptance.mjs: it owns SQL Server, Kestrel and the API proxy.
export default defineConfig({
  testDir: './e2e-live',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env['CI'],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [
    ['list'],
    [
      'html',
      {
        outputFolder: `${process.env['LIVE_ARTIFACTS'] ?? 'artifacts/live-acceptance'}/report`,
        open: 'never',
      },
    ],
    [
      'json',
      {
        outputFile: `${process.env['LIVE_ARTIFACTS'] ?? 'artifacts/live-acceptance'}/results.json`,
      },
    ],
  ],
  outputDir: `${process.env['LIVE_ARTIFACTS'] ?? 'artifacts/live-acceptance'}/results`,
  use: {
    browserName: 'chromium',
    baseURL: process.env['LIVE_BASE_URL'],
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh',
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: ['light', 'dark'].flatMap((colorScheme) =>
    [
      { name: 'desktop', viewport: { width: 1440, height: 900 } },
      { name: 'tablet', viewport: { width: 1024, height: 768 } },
      { name: 'shop-mobile', viewport: { width: 390, height: 844 } },
    ].map(({ name, viewport }) => ({
      name: `${name}-${colorScheme}`,
      ...(name === 'shop-mobile' ? { testMatch: /(?:storefront|discount)\.spec\.ts/ } : {}),
      use: {
        viewport,
        isMobile: name === 'shop-mobile',
        hasTouch: name === 'shop-mobile',
        colorScheme: colorScheme as 'light' | 'dark',
      },
    })),
  ),
});
