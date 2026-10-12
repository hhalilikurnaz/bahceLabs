import { defineConfig } from '@playwright/test'
import { E2E, backendEnv } from './e2e/ortam'

/**
 * Uçtan uca testler kendi ortamında koşar: ayrı veritabanı (docker profili `e2e`), ayrı API ve web portu (kök .env).
 * Sunucuları Playwright başlatır ve kapatır; koşu sonunda e2e veritabanı temizlenir. Geliştirme verisine dokunulmaz.
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
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  webServer: [
    {
      command: `.venv/bin/uvicorn bahcelab_backend.main:app --host 127.0.0.1 --port ${E2E.apiPort}`,
      cwd: '../bahcelab-backend',
      env: backendEnv() as Record<string, string>,
      url: `${E2E.apiUrl}/openapi.json`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `npx vite --port ${E2E.webPort} --strictPort`,
      env: { API_PROXY_TARGET: E2E.apiUrl },
      url: E2E.webUrl,
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
  use: {
    baseURL: E2E.webUrl,
    viewport: { width: 1440, height: 900 },
    // Başsız tarayıcıda harita (WebGL2) için yazılım oluşturucu (SwiftShader) açılır
    launchOptions: { executablePath, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] },
    channel: executablePath ? undefined : 'chrome',
  },
})
