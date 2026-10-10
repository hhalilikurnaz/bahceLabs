import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiRequest, setUnauthorizedHandler } from '@/lib/apiClient'

const json = (status: number, body: unknown = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

afterEach(() => {
  vi.unstubAllGlobals()
  setUnauthorizedHandler(null)
})

describe('apiRequest', () => {
  it('cookie gönderir (credentials: include)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(200, { ok: true }))
    vi.stubGlobal('fetch', fetchMock)

    await apiRequest('/auth/me')

    expect(fetchMock.mock.calls[0][1]).toMatchObject({ credentials: 'include' })
  })

  it('401 gelince oturumu bir kez yenileyip isteği tekrar dener', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(401))
      .mockResolvedValueOnce(json(200)) // /auth/refresh
      .mockResolvedValueOnce(json(200, { id: 'x' }))
    vi.stubGlobal('fetch', fetchMock)
    const onUnauthorized = vi.fn()
    setUnauthorizedHandler(onUnauthorized)

    await expect(apiRequest('/planning/plans')).resolves.toEqual({ id: 'x' })

    expect(fetchMock.mock.calls[1][0]).toContain('/auth/refresh')
    expect(onUnauthorized).not.toHaveBeenCalled()
  })

  it('yenileme de başarısızsa çıkış işleyicisini çağırır', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(401, { error: { code: 'UNAUTHORIZED', message: 'x' } }))
    vi.stubGlobal('fetch', fetchMock)
    const onUnauthorized = vi.fn()
    setUnauthorizedHandler(onUnauthorized)

    await expect(apiRequest('/planning/plans')).rejects.toBeInstanceOf(ApiError)

    expect(onUnauthorized).toHaveBeenCalledTimes(1)
  })

  it('giriş isteğindeki 401 yenileme denemez', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(401, { error: { code: 'UNAUTHORIZED', message: 'E-posta veya şifre hatalı.' } }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(apiRequest('/auth/login', { method: 'POST', body: '{}' })).rejects.toMatchObject({
      status: 401,
      message: 'E-posta veya şifre hatalı.',
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
