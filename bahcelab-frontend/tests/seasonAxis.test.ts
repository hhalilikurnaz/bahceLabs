import { describe, expect, it } from 'vitest'
import { clipBand, dateAtFraction, monthTicks, periodRange, seasonRange, seasonStartYear, shiftYears, stageAt, xFraction } from '@/features/bahcem/lib/seasonAxis'

describe('sezon ekseni', () => {
  it('su yılı 1 Ekim\'de başlar', () => {
    expect(seasonStartYear('2026-09-30')).toBe(2025)
    expect(seasonStartYear('2026-10-01')).toBe(2026)
    expect(seasonRange(2025)).toEqual({ from: '2025-10-01', to: '2026-09-30' })
  })

  it('dönem seçimi: bu sezon, geçen sezon, özel aralık (geçersizse bu sezona düşer)', () => {
    expect(periodRange('bu', '2026-10-11')).toEqual(seasonRange(2026))
    expect(periodRange('gecen', '2026-10-11')).toEqual(seasonRange(2025))
    expect(periodRange('ozel', '2026-10-11', { from: '2026-03-01', to: '2026-04-15' })).toEqual({ from: '2026-03-01', to: '2026-04-15' })
    expect(periodRange('ozel', '2026-10-11', { from: '2026-05-01', to: '2026-04-15' })).toEqual(seasonRange(2026))
    expect(periodRange('ozel', '2026-10-11')).toEqual(seasonRange(2026))
  })

  it('yıl kaydırma 29 Şubat\'ı güvenle işler', () => {
    expect(shiftYears('2028-02-29', -1)).toBe('2027-02-28')
    expect(shiftYears('2026-10-01', -1)).toBe('2025-10-01')
  })

  it('x konumu ve ters dönüşüm uçlarda 0 ve 1 verir', () => {
    const range = { from: '2025-10-01', to: '2026-09-30' }
    expect(xFraction('2025-10-01', range)).toBe(0)
    expect(xFraction('2026-09-30', range)).toBe(1)
    expect(dateAtFraction(0, range)).toBe('2025-10-01')
    expect(dateAtFraction(1, range)).toBe('2026-09-30')
    expect(dateAtFraction(2, range)).toBe('2026-09-30') // aralık dışı sıkıştırılır
    expect(dateAtFraction(xFraction('2026-03-15', range), range)).toBe('2026-03-15')
  })

  it('ay çentikleri: sezon 12 ay, ilki yıllı; özel aralıkta yalnızca içerdekiler', () => {
    const ticks = monthTicks(seasonRange(2025))
    expect(ticks).toHaveLength(12)
    expect(ticks[0]).toMatchObject({ date: '2025-10-01', label: 'Eki', year: 2025 })
    expect(ticks.find((t) => t.label === 'Oca')).toMatchObject({ date: '2026-01-01', year: 2026 })
    const custom = monthTicks({ from: '2026-03-10', to: '2026-05-20' })
    expect(custom.map((t) => t.date)).toEqual(['2026-04-01', '2026-05-01'])
    expect(monthTicks({ from: '2026-12-20', to: '2027-02-10' }).map((t) => t.date)).toEqual(['2027-01-01', '2027-02-01'])
  })

  it('bantlar aralığa kırpılır, kesişmeyen elenir, tarihe göre evre bulunur', () => {
    const range = { from: '2026-03-01', to: '2026-04-15' }
    const band = { kod: 'ciceklenme', ad: 'Çiçeklenme', baslangic: '2026-03-15', bitis: '2026-04-30', ozel: false }
    expect(clipBand(band, range)).toMatchObject({ baslangic: '2026-03-15', bitis: '2026-04-15' })
    expect(clipBand({ ...band, baslangic: '2026-06-01', bitis: '2026-07-01' }, range)).toBeNull()
    expect(clipBand({ ...band, baslangic: '2026-02-01', bitis: '2026-02-20' }, range)).toBeNull()
    expect(stageAt([band], '2026-04-01')?.kod).toBe('ciceklenme')
    expect(stageAt([band], '2026-05-10')).toBeNull()
  })
})
