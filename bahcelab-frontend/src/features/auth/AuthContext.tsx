import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { ApiError, apiRequest, setUnauthorizedHandler } from '@/lib/apiClient'
import type { AuthUser } from './types'

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
  /** İlk oturum kontrolü (GET /auth/me) bitene kadar true */
  isLoading: boolean
  login: (input: LoginInput) => Promise<void>
  register: (input: RegisterInput) => Promise<void>
  logout: () => Promise<void>
}

interface ApiAuthUser {
  id: string
  name: string
  email: string
  workspace_id: string
}

const AuthContext = createContext<AuthContextValue | null>(null)

function mapUser(user: ApiAuthUser): AuthUser {
  return { id: user.id, name: user.name, email: user.email, workspaceId: user.workspace_id }
}

/** Sunucunun 422 doğrulama mesajını okunur Türkçe metne çevirir. */
function toFriendlyError(err: unknown, fallback: string): Error {
  if (err instanceof ApiError) {
    const errors = err.details.errors as { msg?: string }[] | undefined
    const first = errors?.[0]?.msg
    if (err.status === 422 && first) return new Error(first.replace(/^Value error, /, ''))
    return new Error(err.message)
  }
  return new Error(fallback)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setUnauthorizedHandler(() => setUser(null))

    apiRequest<ApiAuthUser>('/auth/me')
      .then((me) => {
        if (!cancelled) setUser(mapUser(me))
      })
      .catch(() => {
        if (!cancelled) setUser(null)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
      setUnauthorizedHandler(null)
    }
  }, [])

  const login = useCallback(async ({ email, password }: LoginInput) => {
    try {
      const me = await apiRequest<ApiAuthUser>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      setUser(mapUser(me))
    } catch (err) {
      throw toFriendlyError(err, 'Giriş yapılamadı. Bağlantınızı kontrol edin.')
    }
  }, [])

  const register = useCallback(async ({ name, email, password }: RegisterInput) => {
    try {
      const me = await apiRequest<ApiAuthUser>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password }),
      })
      setUser(mapUser(me))
    } catch (err) {
      throw toFriendlyError(err, 'Kayıt olunamadı. Bağlantınızı kontrol edin.')
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await apiRequest<void>('/auth/logout', { method: 'POST' })
    } finally {
      // Sunucuya ulaşılamasa bile yerel oturum kapatılır
      setUser(null)
    }
  }, [])

  const value = useMemo(
    () => ({ user, isAuthenticated: user !== null, isLoading, login, register, logout }),
    [user, isLoading, login, register, logout],
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
