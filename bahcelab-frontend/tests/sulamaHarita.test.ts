import { describe, expect, it } from 'vitest'
import type { SimulasyonYaniti } from '@/features/bahcem/api/sulamaPanelApi'
import { etiketle, gostergeSinifi, hedefBearing, oncekiSonraki, sulamaGunleri, vanaGunu } from '@/features/bahcem/lib/sulamaHarita'

const B = { stres: 50, yakin: 70, yeterli: 97 }
const sim = {
  gunler: Array.from({ length: 10 }, (_, i) => ({ tarih: `2026-07-${String(i + 1).padStart(2, '0')}`, yagis_mm: 0, et0_mm: 5, sulama: i === 3, gecici: i > 7, olculen: false, tahmin: false })),
  sektorler: [
    { ad: 'V1', doluluk_pct: [90, 80, 70, 98, 90, 80, 60, 55, 49, 100], brut_mm: [0, 0, 0, 6, 0, 0, 0, 0, 0, 0], stres: [], ks: [1, 1, 1, 1, 1, 1, 0.9, 0.8, 0.7, 1], bosa_mm: [0, 0, 0, 3, 0, 0, 0, 0, 0, 0], etc_mm: [], eta_mm: [], kc: null },
    { ad: 'V2', doluluk_pct: [90, 90, 90, 90, 90, 90, 90, 90, 90, null], brut_mm: new Array(10).fill(0), stres: [], ks: new Array(10).fill(1), bosa_mm: new Array(10).fill(0), etc_mm: [], eta_mm: [], kc: null },
  ],
} as unknown as SimulasyonYaniti

describe('etiket bantları (50/70/97)', () => {
  it('sınırlar', () => {
    expect(etiketle(49.9, B)).toBe('stres')
    expect(etiketle(50, B)).toBe('yakin')
    expect(etiketle(70, B)).toBe('yeterli')
    expect(etiketle(97, B)).toBe('dolu')
    expect(etiketle(null, B)).toBeNull()
  })
})
describe('vana günü', () => {
  it('7 günlük stres ve fazla su penceresi seçili günü içerir', () => {
    const v = vanaGunu(sim, 0, 8, B)
    expect(v.stres7).toBe(3) // 6,7,8. günler
    expect(v.etiket).toBe('stres')
    expect(vanaGunu(sim, 0, 5, B).fazla7).toBe(3) // 3. gün sızması penceredeyse (0..5)
    expect(vanaGunu(sim, 0, 9, B).fazla7).toBe(3) // pencere 3..9: 3. gün hâlâ içinde
    expect(vanaGunu(sim, 0, 10 - 1, B).fazla7).toBe(3)
  })
  it('geçici bayrak güne bağlı', () => {
    expect(vanaGunu(sim, 0, 9, B).gecici).toBe(true)
    expect(vanaGunu(sim, 0, 2, B).gecici).toBe(false)
  })
  it('gösterge sınıfı renk + yazı birlikte', () => {
    const s = gostergeSinifi('toprak', vanaGunu(sim, 0, 8, B))
    expect(s.metin).toBe('stres')
    expect(gostergeSinifi('stres', vanaGunu(sim, 0, 8, B)).metin).toBe('3 gün stres')
    expect(gostergeSinifi('toprak', vanaGunu(sim, 1, 9, B)).metin).toBe('veri yok')
  })
})
describe('sulama günleri ve bearing', () => {
  it('önceki/sonraki sulama', () => {
    expect(sulamaGunleri(sim)).toEqual([3])
    expect(oncekiSonraki([3, 6], 5)).toEqual({ onceki: 3, sonraki: 6 })
    expect(oncekiSonraki([3], 3)).toEqual({ onceki: null, sonraki: null })
  })
  it('uzun eksen ekranda yatay/dikey', () => {
    expect(hedefBearing(90, true)).toBe(0) // zaten doğu-batı: dönüş yok
    expect(hedefBearing(0, false)).toBe(0)
    expect(hedefBearing(30, true)).toBe(-60)
    expect(Math.abs(hedefBearing(170, true))).toBeLessThanOrEqual(90)
  })
})

import { kcCumlesi } from '@/features/bahcem/lib/sulamaPanel'
describe('Kc kaynağı cümlesi', () => {
  it('vana: piksel sayısı ve bulut maskesi ekranda', () => {
    const c = kcCumlesi({ kaynak: 'vana', tarih: '2026-10-12', ndvi: 0.7, orten_yuzde: 52, kc_bugun: 0.64, piksel: 48, toplam_piksel: 50, maske_orani: 0.04, neden: null })
    expect(c).toContain('48 Sentinel-2 pikselinin ortalaması')
    expect(c).toContain('bulut maskesi %4')
    expect(c).toContain('12 Eki')
    expect(c).toContain('Kc 0,64')
    expect(c).not.toMatch(/toprak|SoilGrids/i) // toprak notu ekranda yok (ADR 0027)
  })
  it('bahçe değeri: neden yazılır', () => {
    const c = kcCumlesi({ kaynak: 'bahce', tarih: null, ndvi: null, orten_yuzde: 50, kc_bugun: 0.6, piksel: null, toplam_piksel: null, maske_orani: null, neden: 'son görüntülerde temiz piksel yetersiz (4/50); bahçe değeri kullanıldı' })
    expect(c).toContain('bahçe değeri')
    expect(c).toContain('temiz piksel yetersiz')
  })
})
