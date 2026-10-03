import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  clearSession,
  loadSession,
  loadUsers,
  saveSession,
  saveUsers,
} from './authStorage'
import { REGISTRATION_ENABLED } from './authConfig'
import type { AuthSession, AuthUser, StoredUser } from './types'

interface RegisterInput {
  name: string
  email: string
  password: string
}

interface LoginInput {
  email: string
  password: string
}

interface AuthContextValue {
  user: AuthUser | null
  isAuthenticated: boolean
  login: (input: LoginInput) => Promise<void>
  register: (input: RegisterInput) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function toSession(user: AuthUser): AuthSession {
  return {
    user,
    token: `local-${user.id}`,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(() => loadSession())

  const login = useCallback(async ({ email, password }: LoginInput) => {
    const normalized = normalizeEmail(email)
    const match = loadUsers().find(
      (u) => normalizeEmail(u.email) === normalized && u.password === password,
    )

    if (!match) {
      throw new Error('Girişler ve kayıtlar çok yakında sizlerle!')
    }

    const next = toSession({ id: match.id, name: match.name, email: match.email })
    saveSession(next)
    setSession(next)
  }, [])

  const register = useCallback(async ({ name, email, password }: RegisterInput) => {
    if (!REGISTRATION_ENABLED) {
      throw new Error('Kayıtlar şimdilik kapalı. Erken erişim duyurulduğunda bu sayfadan kayıt açılacaktır.')
    }

    const trimmedName = name.trim()
    const normalized = normalizeEmail(email)

    if (!trimmedName || !normalized || password.length < 6) {
      throw new Error('Lütfen tüm alanları doldurun. Şifre en az 6 karakter olmalı.')
    }

    const users = loadUsers()
    if (users.some((u) => normalizeEmail(u.email) === normalized)) {
      throw new Error('Bu e-posta ile zaten kayıt var.')
    }

    const user: StoredUser = {
      id: crypto.randomUUID(),
      name: trimmedName,
      email: normalized,
      password,
    }

    saveUsers([...users, user])
    const next = toSession({ id: user.id, name: user.name, email: user.email })
    saveSession(next)
    setSession(next)
  }, [])

  const logout = useCallback(() => {
    clearSession()
    setSession(null)
  }, [])

  const value = useMemo(
    () => ({
      user: session?.user ?? null,
      isAuthenticated: Boolean(session?.user),
      login,
      register,
      logout,
    }),
    [session, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
