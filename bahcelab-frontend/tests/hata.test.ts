import { describe, expect, it } from 'vitest'
import { ApiError } from '@/lib/apiClient'
import { hataAciklamasi, hataTuru } from '@/lib/hata'

describe('hataTuru: ağ ile sunucu hatası ayrı (U-21)', () => {
  it('fetch ağ hatası (TypeError) → ag; mesaj internet bağlantısını söyler', () => {
    expect(hataTuru(new TypeError('Failed to fetch'))).toBe('ag')
    expect(hataAciklamasi(new TypeError('x'))).toMatch(/internet bağlantınızı/)
  })
  it('sunucu 5xx → sunucu; mesaj internetten söz etmez', () => {
    const e = new ApiError(500, 'INTERNAL', 'x')
    expect(hataTuru(e)).toBe('sunucu')
    expect(hataAciklamasi(e)).not.toMatch(/internet/i)
    expect(hataAciklamasi(e)).toMatch(/sorun sizde değil/)
  })
  it('401/403 → yetki, 404 → bulunamadi, diğer 4xx → istek', () => {
    expect(hataTuru(new ApiError(401, 'A', 'x'))).toBe('yetki')
    expect(hataTuru(new ApiError(403, 'A', 'x'))).toBe('yetki')
    expect(hataTuru(new ApiError(404, 'A', 'x'))).toBe('bulunamadi')
    expect(hataTuru(new ApiError(422, 'A', 'x'))).toBe('istek')
  })
  it('bilinmeyen nesne → bilinmiyor', () => {
    expect(hataTuru(new Error('x'))).toBe('bilinmiyor')
  })
})
