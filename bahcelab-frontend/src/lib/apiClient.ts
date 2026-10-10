export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details: Record<string, unknown>

  constructor(status: number, code: string, message: string, details: Record<string, unknown> = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

interface ApiErrorBody {
  error?: {
    code?: string
    message?: string
    details?: Record<string, unknown>
  }
}

/** Yerelde Vite proxy (/api → :8001) ile aynı origin; canlıda VITE_PLANNING_API_BASE_URL ile değişir. */
export function getApiBaseUrl(): string {
  return import.meta.env.VITE_PLANNING_API_BASE_URL ?? '/api'
}

// Oturum cookie'leri httpOnly olduğu için JS token'a erişemez; tarayıcı cookie'yi kendisi gönderir.
const AUTH_PATHS_WITHOUT_REFRESH = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout']

let unauthorizedHandler: (() => void) | null = null

/** AuthProvider kaydeder: oturum yenilenemediğinde kullanıcıyı çıkış durumuna alır. */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler
}

let refreshInFlight: Promise<boolean> | null = null

function refreshSession(): Promise<boolean> {
  // Aynı anda gelen birden fazla 401 tek bir yenileme isteğini paylaşır (refresh token döndürülür)
  refreshInFlight ??= fetch(`${getApiBaseUrl()}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  })
    .then((response) => response.ok)
    .catch(() => false)
    .finally(() => {
      refreshInFlight = null
    })
  return refreshInFlight
}

async function send(path: string, options: RequestInit): Promise<Response> {
  const headers = new Headers(options.headers)
  if (options.body !== undefined) headers.set('Content-Type', 'application/json')
  return fetch(`${getApiBaseUrl()}${path}`, { ...options, headers, credentials: 'include' })
}

/** Ham yanıt (ikili veri vb.): 401'de oturum bir kez yenilenir, hata durumunda ApiError fırlatılır. */
export async function apiRequestRaw(path: string, options: RequestInit = {}): Promise<Response> {
  let response = await send(path, options)

  if (response.status === 401 && !AUTH_PATHS_WITHOUT_REFRESH.includes(path)) {
    if (await refreshSession()) {
      response = await send(path, options)
    }
    if (response.status === 401) {
      unauthorizedHandler?.()
    }
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiErrorBody | null
    throw new ApiError(
      response.status,
      body?.error?.code ?? 'UNKNOWN',
      body?.error?.message ?? response.statusText,
      body?.error?.details,
    )
  }
  return response
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await apiRequestRaw(path, options)
  if (response.status === 204) {
    return undefined as T
  }
  return response.json() as Promise<T>
}
