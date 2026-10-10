import { describe, expect, it } from 'vitest'
import { parseBahcemPath } from '@/features/bahcem/hooks/useBahcemRoute'
import { GARDEN_TABS, gardenPath, isGardenTab } from '@/features/bahcem/lib/routes'

describe('bahçe sayfası rotaları', () => {
  it('liste ve bölümler', () => {
    expect(parseBahcemPath('/bahcem')).toMatchObject({ section: 'bahceler', gardenId: null })
    expect(parseBahcemPath('/bahcem/pazar')).toMatchObject({ section: 'pazar', gardenId: null })
    expect(parseBahcemPath('/bahcem/bildirimler').section).toBe('bildirimler')
    expect(parseBahcemPath('/bahcem/ayarlar').section).toBe('ayarlar')
  })

  it('bahçe ve sekme', () => {
    expect(parseBahcemPath('/bahcem/abc-123/hava')).toMatchObject({ section: 'bahceler', gardenId: 'abc-123', tab: 'hava' })
    expect(parseBahcemPath('/bahcem/abc-123')).toMatchObject({ gardenId: 'abc-123', tab: 'durum', rawTab: undefined })
  })

  it('geçersiz sekme durum olur ama ham değer korunur (yönlendirme için)', () => {
    expect(parseBahcemPath('/bahcem/abc/yok')).toMatchObject({ tab: 'durum', rawTab: 'yok' })
  })

  it('sekmeler ve yol üretimi', () => {
    expect(GARDEN_TABS).toEqual(['durum', 'analiz', 'hava', 'gunluk', 'rapor'])
    expect(isGardenTab('analiz')).toBe(true)
    expect(isGardenTab('uydu')).toBe(false)
    expect(gardenPath('x')).toBe('/bahcem/x/durum')
    expect(gardenPath('x', 'rapor')).toBe('/bahcem/x/rapor')
  })
})
