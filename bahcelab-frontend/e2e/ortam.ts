/** Uçtan uca test ortamı: AYRI veritabanı + ayrı API/web portları. Tüm değerler kök .env'den (bkz. .env.example); kodda port yok. */
import { existsSync } from 'node:fs'
import path from 'node:path'

const ROOT_ENV = path.resolve(import.meta.dirname, '../../.env')
if (existsSync(ROOT_ENV)) process.loadEnvFile(ROOT_ENV)

function need(key: string): string {
  const value = process.env[key]
  if (!value) throw new Error(`${key} tanımlı değil: kök .env dosyasını .env.example'dan oluşturun`)
  return value
}

export const E2E = {
  apiPort: need('E2E_API_PORT'),
  webPort: need('E2E_WEB_PORT'),
  dbPort: need('E2E_DB_PORT'),
  dbName: need('E2E_DB_NAME'),
  dbContainer: need('E2E_DB_CONTAINER'),
  get databaseUrl(): string {
    return `postgresql+asyncpg://bahcelab:bahcelab@localhost:${this.dbPort}/${this.dbName}`
  },
  get apiUrl(): string {
    return `http://127.0.0.1:${this.apiPort}`
  },
  get webUrl(): string {
    return `http://localhost:${this.webPort}`
  },
  storageDir: 'uploads-e2e',
}

/** Backend süreçleri (uvicorn, test destek betikleri) için ortam: e2e veritabanı ve ayrı depolama. */
export const backendEnv = (): NodeJS.ProcessEnv => ({
  ...process.env,
  PYTHONPATH: 'src',
  DATABASE_URL: E2E.databaseUrl,
  STORAGE_DIR: E2E.storageDir,
  NDVI_ENABLED: 'false', // gerçek uydu işlemi başlatılmaz; sahneler test aracıyla yazılır
  JOBS_ENABLED: 'false',
  REGISTRATION_ENABLED: 'true',
  CORS_ORIGINS: E2E.webUrl,
})
