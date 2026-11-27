import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: '.', testMatch: 'printing.spec.mjs', workers: 1, timeout: 90000,
  use: { baseURL: 'http://127.0.0.1:3000', viewport: { width: 1440, height: 1100 }, colorScheme: 'dark' },
  webServer: {
    command: 'pnpm dev --hostname 127.0.0.1', cwd: '../..',
    url: 'http://127.0.0.1:3000/review-finance', timeout: 180000,
    reuseExistingServer: false, stdout: 'pipe', stderr: 'pipe',
  },
})
