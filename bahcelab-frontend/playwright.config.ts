import { defineConfig } from '@playwright/test'

/**
 * Uçtan uca testler çalışan backend (:8001) ve Vite (:5173) gerektirir (`make backend-dev`, `npm run dev`).
 * Tarayıcı: `PW_CHROME_PATH` verilirse o Chrome/Chromium, yoksa yüklü Google Chrome.
 */
const executablePath = process.env.PW_CHROME_PATH

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0, // aralıklı düşen test kabul edilmez: yeniden deneme yok
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    viewport: { width: 1440, height: 900 },
    launchOptions: executablePath ? { executablePath } : undefined,
    channel: executablePath ? undefined : 'chrome',
  },
})
