import { describe, expect, it } from 'vitest'
import type { SektorDurumu, SektorGunu } from '@/features/bahcem/api/sulamaPanelApi'
import { suDengesi, vanaEtiketi } from '@/features/bahcem/lib/sulamaPanel'

const g = (tarih: string, o: Partial<SektorGunu> = {}): SektorGunu => ({ tarih, doluluk_pct: 80, etc_mm: 4, eta_mm: 4, net_mm: 0, brut_mm: 0, yagis_mm: 0, etkili_yagis_mm: 0, bosa_mm: 0, ks: 1, planli: false, uygulandi: false, tahmin: false, veri_eksik: false, ...o })
const s = (ad: string, alan: number, gunler: SektorGunu[], o: Partial<SektorDurumu> = {}): SektorDurumu => ({ id: null, ad, alan_dekar: alan, agac_sayisi: null, agac_kaynak: 'yok', vana_debi_m3h: null, doluluk_pct: 92, etiket: 'yeterli', sonraki_sulama: '2026-07-22', esik_alti_7gun: false, gunler, ...o })

describe('sulama paneli yardımcıları', () => {
  it('su dengesi: alan ağırlıklı vana ortalaması, tahmin ve eksik veri atlanır, karşılanmayan = ETc − ETa', () => {
    const v1 = s('V1', 30, [g('2026-07-12', { etc_mm: 5, eta_mm: 5, net_mm: 6, uygulandi: true }), g('2026-07-15', { net_mm: 9, planli: true }), g('2026-07-13', { etc_mm: 5, eta_mm: 4, yagis_mm: 14 }), g('2026-07-14', { tahmin: true }), g('2026-07-11', { veri_eksik: true, etc_mm: null, eta_mm: null })])
    const v2 = s('V2', 10, [g('2026-07-12', { etc_mm: 3, eta_mm: 3 }), g('2026-07-13', { etc_mm: 3, eta_mm: 3 })])
    const o = suDengesi([v1, v2], '2026-07-14')
    expect(o.gunler.map((d) => d.tarih)).toEqual(['2026-07-12', '2026-07-13'])
    expect(o.gunler[0].etc).toBeCloseTo(0.75 * 5 + 0.25 * 3)
    expect(o.gunler[0].sulama).toBeCloseTo(0.75 * 6)
    expect(o.gunler[1].yagis).toBeCloseTo(0.75 * 14)
    expect(o.toplam.karsilanmayan).toBeCloseTo(0.75 * 1)
    expect(suDengesi([], '2026-07-14').gunler).toEqual([])
  })
  it('vana etiketi: harita ve satır aynı metin', () => {
    expect(vanaEtiketi(s('V2', 10, []))).toEqual({ baslik: 'V2 · %92', alt: 'yeterli · sonraki 22 Tem' })
    expect(vanaEtiketi(s('V3', 10, [], { doluluk_pct: 48.4, etiket: 'stres', sonraki_sulama: null }))).toEqual({ baslik: 'V3 · %48', alt: 'stres · sulama gerekmiyor' })
  })
})
