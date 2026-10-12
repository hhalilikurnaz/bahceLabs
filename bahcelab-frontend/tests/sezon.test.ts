import { describe, expect, it } from 'vitest'
import type { Edinim } from '../src/features/bahcem/api/edinimApi'
import { bandKonumu, type NormalBantAy } from '../src/features/bahcem/api/normalBantApi'
import { ayTarihi, bandAylari, cubukAraligi, evreAraligi, sezonNoktalari, yilIciKonum } from '../src/features/bahcem/lib/sezon'

const ed = (tarih: string, ndvi: number): Edinim => ({ tarih, scene_id: tarih, bulut_orani: 3, gecerli_oran: 1, isleme_surumu: '05.13', formul_surumu: 'f1', gostergeler: { ndvi: { ortalama: ndvi, medyan: ndvi, p10: ndvi - 0.1, p25: ndvi - 0.05, p75: ndvi + 0.05, p90: ndvi + 0.1, gecerli_piksel: 100 } } })
const band = (o: Partial<NormalBantAy>): NormalBantAy => ({ ay: 10, yil_sayisi: 9, yillar: [2016], p10: 0.5, p25: 0.55, p50: 0.6, p75: 0.65, p90: 0.7, ceyrek_yeterli: true, onluk_yeterli: true, durum: 'yeterli', ...o })

describe('sezon eksenı', () => {
  it('ay ortası ≈ ayın orta noktası', () => {
    expect(yilIciKonum('2026-01-16')).toBeCloseTo(0.5, 1)
    expect(yilIciKonum('2026-10-16')).toBeCloseTo(9.5, 1)
    expect(yilIciKonum('2026-12-31')).toBeGreaterThan(11.9)
  })
  it('bu yılın noktaları yalnız o yıldan ve tarih sıralı', () => {
    const pts = sezonNoktalari([ed('2025-10-03', 0.5), ed('2026-10-09', 0.6), ed('2026-02-02', 0.55)], 'ndvi', 2026)
    expect(pts.map((p) => p.tarih)).toEqual(['2026-02-02', '2026-10-09'])
  })
  it('aya dokununca o ayın en son edinimi seçilir; edinim yoksa null', () => {
    const list = [ed('2026-07-03', 0.5), ed('2026-07-23', 0.55), ed('2026-08-04', 0.6)]
    expect(ayTarihi(list, 2026, 7, 'ndvi')).toBe('2026-07-23')
    expect(ayTarihi(list, 2026, 9, 'ndvi')).toBeNull()
  })
})

describe('band konumu ve çizimi', () => {
  it('p25–p75 normal; p10–p25 alt; p10 altı en düşük; p75 üstü üst', () => {
    const b = band({})
    expect(bandKonumu(0.6, b)).toBe('normal')
    expect(bandKonumu(0.52, b)).toBe('alt')
    expect(bandKonumu(0.4, b)).toBe('en_dusuk')
    expect(bandKonumu(0.8, b)).toBe('ust')
  })
  it('yetersiz geçmişte konum yok ve bant çizilmez', () => {
    const short = band({ ceyrek_yeterli: false, onluk_yeterli: false, p10: null, p25: null, p50: null, p75: null, p90: null, durum: 'yetersiz_gecmis' })
    expect(bandKonumu(0.6, short)).toBeNull()
    expect(bandAylari([short]).koyu).toHaveLength(0)
  })
  it('çubuk aralığı değeri ve bant uçlarını kapsar', () => {
    const [lo, hi] = cubukAraligi(0.45, band({}))
    expect(lo).toBeLessThan(0.45) && expect(hi).toBeGreaterThan(0.7)
  })
})

describe('evreAraligi', () => {
  it('önceki yıldan başlayan evre yıl başına kırpılır, yıl dışındaki evre atlanır', () => {
    expect(evreAraligi('2025-10-01', '2025-12-14', 2026)).toBeNull()
    expect(evreAraligi('2026-10-01', '2026-12-14', 2026)![0]).toBeCloseTo(9, 1)
    expect(evreAraligi('2025-12-15', '2026-02-15', 2026)![0]).toBe(0)
    expect(evreAraligi('2026-12-15', '2027-02-15', 2026)![1]).toBe(12)
  })
  it('katalogdaki tüm evreler bir takvim yılında görünür ve çakışmaz', () => {
    const e = [['2025-12-15', '2026-02-15'], ['2026-02-16', '2026-03-14'], ['2026-03-15', '2026-04-30'], ['2026-05-01', '2026-06-15'], ['2026-06-16', '2026-09-30'], ['2026-10-01', '2026-12-14'], ['2026-12-15', '2027-02-15']]
    const a = e.map(([b, c]) => evreAraligi(b, c, 2026)!).sort((p, q) => p[0] - q[0])
    expect(a).toHaveLength(7)
    for (let i = 1; i < a.length; i++) expect(a[i][0]).toBeGreaterThanOrEqual(a[i - 1][1] - 0.04)
  })
})
