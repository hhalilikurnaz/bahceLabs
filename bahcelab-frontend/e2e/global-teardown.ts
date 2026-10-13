import { execFileSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import path from 'node:path'
import { E2E, E2E_DB_HARICI } from './ortam'

/** Koşu sonunda e2e veritabanındaki tüm kullanıcı verisini ve test dosyalarını siler (geliştirme veritabanına dokunmaz). */
export default function globalTeardown(): void {
  // Arka planda hâlâ besleme işi (ERA5/HLS) çalışıyor olabilir: açık işlemler TRUNCATE'i sonsuza dek bekletmesin → önce diğer bağlantılar kapatılır, kilit beklemesi sınırlanır
  const temizle = "SET client_min_messages = warning; SET lock_timeout = '30s'; SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid(); TRUNCATE users, workspaces RESTART IDENTITY CASCADE;"
  if (E2E_DB_HARICI) execFileSync('psql', [E2E.databaseUrl.replace('+asyncpg', ''), '-q', '-v', 'ON_ERROR_STOP=1', '-c', temizle], { stdio: 'inherit', timeout: 120_000 })
  else execFileSync('docker', ['exec', E2E.dbContainer, 'psql', '-q', '-U', 'bahcelab', '-d', E2E.dbName, '-v', 'ON_ERROR_STOP=1', '-c', temizle], { stdio: 'inherit', timeout: 120_000 })
  rmSync(path.resolve(import.meta.dirname, '../../bahcelab-backend', E2E.storageDir), { recursive: true, force: true })
}
