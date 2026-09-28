import type { AuthSession, StoredUser } from './types'

const SESSION_KEY = 'bahcelab_auth_session'
const USERS_KEY = 'bahcelab_auth_users'

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function loadSession(): AuthSession | null {
  return readJson<AuthSession | null>(SESSION_KEY, null)
}

export function saveSession(session: AuthSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY)
}

export function loadUsers(): StoredUser[] {
  return readJson<StoredUser[]>(USERS_KEY, [])
}

export function saveUsers(users: StoredUser[]): void {
  localStorage.setItem(USERS_KEY, JSON.stringify(users))
}
