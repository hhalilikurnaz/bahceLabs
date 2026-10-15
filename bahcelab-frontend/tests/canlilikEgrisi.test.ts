import { describe, expect, it } from 'vitest'
import type { EgriNoktasi } from '../src/features/bahcem/api/egriApi'
import { bantYolu, cizgiYolu, parcala, tahminEtiketi, yilNoktalari } from '../src/features/bahcem/lib/canlilikEgrisi'

const n = (tarih: string, deger: number, tahmini: boolean): EgriNoktasi => ({ tarih, deger, alt: deger - 0.05, ust: deger + 0.05, tahmini })

describe('kesintisiz canlılık eğrisi', () => {
  it('gözlem destekli ve tahmini parçaları böler; komşu parçalar ortak noktayla birleşir', () => {
    const parts = parcala([n('2026-01-01', 0.6, false), n('2026-01-02', 0.61, false), n('2026-01-03', 0.62, true), n('2026-01-04', 0.63, true), n('2026-01-05', 0.64, false)])
    expect(parts.map((p) => [p.tahmini, p.noktalar.length])).toEqual([[false, 2], [true, 3], [false, 2]])
    expect(parts[1].noktalar[0].tarih).toBe('2026-01-02') // kopukluk yok
    expect(parcala([])).toEqual([])
  })

  it('yalnız seçili yılın noktalarını alır; son nokta tahminiyse etiket verir', () => {
    const all = [n('2025-12-31', 0.6, false), n('2026-01-01', 0.6, false), n('2026-01-02', 0.6, true)]
    expect(yilNoktalari(all, 2026).map((p) => p.tarih)).toEqual(['2026-01-01', '2026-01-02'])
    expect(tahminEtiketi(all)).toBe('tahmini')
    expect(tahminEtiketi(all.slice(0, 2))).toBeNull()
  })

  it('çizgi ve bant yolları boş girdide boştur, doluda kapalı/açık yol üretir', () => {
    const X = (k: number) => k * 10
    const Y = (v: number) => 100 - v * 100
    expect(cizgiYolu([], X, Y)).toBe('') && expect(bantYolu([], X, Y)).toBe('')
    const pts = [n('2026-01-01', 0.6, false), n('2026-01-10', 0.7, false)]
    expect(cizgiYolu(pts, X, Y).startsWith('M')).toBe(true)
    expect(bantYolu(pts, X, Y).endsWith('Z')).toBe(true)
  })
})

describe('radar izleme aralıkları', () => {
  it('ardışık radar geçişleri tek aralıkta birleşir; değişim var denen geçiş ayrıca anılır', async () => {
    const { radarAraliklari } = await import('../src/features/bahcem/lib/canlilikEgrisi')
    const marks = ['2026-01-02', '2026-01-08', '2026-01-14', '2026-01-20', '2026-03-01', '2026-03-07'].map((tarih) => ({ tarih, degisim: tarih === '2026-01-14' }))
    const araliklar = radarAraliklari(marks)
    expect(araliklar).toEqual([
      { baslangic: '2026-01-02', bitis: '2026-01-20', gecis: 4, degisimler: ['2026-01-14'] },
      { baslangic: '2026-03-01', bitis: '2026-03-07', gecis: 2, degisimler: [] },
    ])
    expect(radarAraliklari([])).toEqual([])
    expect(radarAraliklari([{ tarih: '2026-05-05', degisim: false }])).toHaveLength(1)
  })
})
