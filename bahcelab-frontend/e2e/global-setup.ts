import { execFileSync } from 'node:child_process'
import { E2E, E2E_DB_HARICI, backendEnv } from './ortam'

/** e2e veritabanını (docker profili `e2e`) ayağa kaldırır ve şemayı kurar. */
export default function globalSetup(): void {
  if (!E2E_DB_HARICI) execFileSync('docker', ['compose', '--profile', 'e2e', 'up', '-d', '--wait', 'db-e2e'], { cwd: '..', stdio: 'inherit' })
  execFileSync('.venv/bin/alembic', ['upgrade', 'head'], { cwd: '../bahcelab-backend', env: backendEnv(), stdio: 'inherit' })
  void E2E
}
