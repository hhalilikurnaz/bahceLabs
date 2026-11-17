import { afterEach, describe, expect, it, vi } from 'vitest'
import { AYDINLATMA_SURUMU, BEKLEME_URUNLERI, beklemeListesineKatil } from '@/features/auth/bekleme'
import { MIN_PASSWORD_LENGTH } from '@/features/auth/authConfig'
import { authErrorMessage } from '@/features/auth/authErrors'
import { ApiError } from '@/lib/apiClient'

afterEach(() => vi.unstubAllGlobals())

describe('erken erişim listesi istemcisi', () => {
  it('başvuruyu /bekleme-listesi adresine JSON olarak gönderir', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ kayit: 'alindi' }), { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)
    const yanit = await beklemeListesineKatil({ email: 'a@b.co', il: 'Mersin', urun: 'limon', riza: true })
    expect(yanit).toEqual({ kayit: 'alindi' })
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/bekleme-listesi')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({ email: 'a@b.co', il: 'Mersin', urun: 'limon', riza: true })
  })

  it('ürün seçenekleri sunucudakiyle aynı: limon, portakal, mandalina, diğer', () => {
    expect(BEKLEME_URUNLERI.map((u) => u.deger)).toEqual(['limon', 'portakal', 'mandalina', 'diger'])
  })

  it('aydınlatma metni sürümü sunucu sabitiyle aynı', async () => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const py = readFileSync(join(import.meta.dirname, '..', '..', 'bahcelab-backend/src/bahcelab_backend/domain/bekleme/schemas.py'), 'utf8')
    expect(py).toContain(`AYDINLATMA_SURUMU = "${AYDINLATMA_SURUMU}"`)
  })

  it('şifre kuralı tek sabitten: sunucudaki en küçük uzunlukla aynı', async () => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const py = readFileSync(join(import.meta.dirname, '..', '..', 'bahcelab-backend/src/bahcelab_backend/domain/auth/schemas.py'), 'utf8')
    expect(py).toContain(`MIN_PASSWORD_LENGTH = ${MIN_PASSWORD_LENGTH}`)
  })

  it('hata metinleri: hız sınırı ve doğrulama anlaşılır Türkçe', () => {
    expect(authErrorMessage(new ApiError(429, 'RATE_LIMITED', 'x'), 'yedek')).toMatch(/Çok fazla deneme/)
    expect(authErrorMessage(new ApiError(422, 'VALIDATION_ERROR', 'Request validation failed'), 'yedek')).toBe('Girdiğiniz bilgileri kontrol edin.')
  })
})

describe('KVKK taslak bayrağı', () => {
  it('taslak açıkken canlıda form kapalı; geliştirmede açık; taslak kapalıyken her yerde açık', async () => {
    const { beklemeFormuAcik } = await import('@/features/auth/authConfig')
    expect(beklemeFormuAcik(true, true)).toBe(false)
    expect(beklemeFormuAcik(true, false)).toBe(true)
    expect(beklemeFormuAcik(false, true)).toBe(true)
    expect(beklemeFormuAcik(false, false)).toBe(true)
  })

  it('bayrak varsayılan AÇIK (yalnız VITE_KVKK_TASLAK=false kapatır)', async () => {
    vi.resetModules()
    vi.stubEnv('VITE_KVKK_TASLAK', '')
    expect((await import('@/features/auth/authConfig')).KVKK_TASLAK).toBe(true)
    vi.resetModules()
    vi.stubEnv('VITE_KVKK_TASLAK', 'false')
    expect((await import('@/features/auth/authConfig')).KVKK_TASLAK).toBe(false)
    vi.unstubAllEnvs()
  })
})
