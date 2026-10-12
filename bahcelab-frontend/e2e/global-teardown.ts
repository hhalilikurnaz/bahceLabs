import { execFileSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import path from 'node:path'
import { E2E } from './ortam'

/** Koşu sonunda e2e veritabanındaki tüm kullanıcı verisini ve test dosyalarını siler (geliştirme veritabanına dokunmaz). */
export default function globalTeardown(): void {
  execFileSync('docker', ['exec', E2E.dbContainer, 'psql', '-q', '-U', 'bahcelab', '-d', E2E.dbName, '-v', 'ON_ERROR_STOP=1', '-c', 'SET client_min_messages = warning; TRUNCATE users, workspaces RESTART IDENTITY CASCADE;'], { stdio: 'inherit' })
  rmSync(path.resolve(import.meta.dirname, '../../bahcelab-backend', E2E.storageDir), { recursive: true, force: true })
}
