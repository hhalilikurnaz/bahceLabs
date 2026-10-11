import { describe, expect, it } from 'vitest'
import { bestSprayTime, dayLabel, noSprayReason, type SprayDay } from '@/features/bahcem/lib/spray'

const TODAY = '2026-10-12' // Pazartesi

const days: SprayDay[] = [
  { tarih: '2026-10-12', uygunSaat: 4, enIyiAralik: ['06:00', '09:00'] },
  { tarih: '2026-10-13', uygunSaat: 9, enIyiAralik: ['06:00', '10:00'] },
  { tarih: '2026-10-14', uygunSaat: 9, enIyiAralik: ['05:00', '12:00'] },
  { tarih: '2026-10-15', uygunSaat: 0, enIyiAralik: null },
]

describe('ilaçlama zamanı', () => {
  it('en çok uygun saati olan günün aralığını verir; eşitlikte en erken gün', () => {
    expect(bestSprayTime(days, TODAY)).toEqual({ tarih: '2026-10-13', gun: 'Yarın', aralik: ['06:00', '10:00'] })
  })

  it('geçmiş günler sayılmaz; aralığı olan gün yoksa null', () => {
    expect(bestSprayTime([{ tarih: '2026-10-11', uygunSaat: 12, enIyiAralik: ['06:00', '10:00'] }], TODAY)).toBeNull()
    expect(bestSprayTime(days.map((d) => ({ ...d, enIyiAralik: null })), TODAY)).toBeNull()
    expect(bestSprayTime([], TODAY)).toBeNull()
  })

  it('gün etiketi bugün, yarın ve hafta günü adı', () => {
    expect(dayLabel('2026-10-12', TODAY)).toBe('Bugün')
    expect(dayLabel('2026-10-13', TODAY)).toBe('Yarın')
    expect(dayLabel('2026-10-15', TODAY)).toBe('Perşembe')
  })

  it('uygun saat yokken en sık nedeni söyler; veri yoksa genel cümle', () => {
    const hours = [
      { ilaclama: 'uygun_degil' as const, nedenler: ['Rüzgâr çok kuvvetli (30 km/s).'] },
      { ilaclama: 'uygun_degil' as const, nedenler: ['Rüzgâr çok kuvvetli (30 km/s).', 'Yağış bekleniyor.'] },
      { ilaclama: 'uygun' as const, nedenler: ['Yağış bekleniyor.', 'Yağış bekleniyor.', 'Yağış bekleniyor.'] },
    ]
    expect(noSprayReason(hours)).toBe('Rüzgâr çok kuvvetli (30 km/s).')
    expect(noSprayReason([])).toContain('uygun gündüz saati')
  })
})
