import { describe, expect, it } from 'vitest'
import type { SektorDurumu, SulamaAgi } from '@/features/bahcem/api/sulamaPanelApi'
import { haritaModeli, etiketNoktasi } from '@/features/bahcem/calisma/sulama/harita/sulamaGeo'

const X0 = 27.73, Y0 = 37.1
const dx = (m: number) => m / (111_320 * Math.cos((Y0 * Math.PI) / 180))
const dy = (m: number) => m / 110_574
const kutu = (x: number, y: number, w: number, h: number): GeoJSON.Polygon => ({ type: 'Polygon', coordinates: [[[X0 + dx(x), Y0 + dy(y)], [X0 + dx(x + w), Y0 + dy(y)], [X0 + dx(x + w), Y0 + dy(y + h)], [X0 + dx(x), Y0 + dy(y + h)], [X0 + dx(x), Y0 + dy(y)]]] })
const sek = (ad: string, geometry: GeoJSON.Polygon | null, sa: number | null = null, aa: number | null = null): SektorDurumu => ({ ad, geometry, sira_aralik_m: sa, agac_aralik_m: aa }) as unknown as SektorDurumu
const AG = (p: Partial<SulamaAgi> = {}): SulamaAgi => ({ pompa: null, ana_boru: null, sira_yonu_derece: null, varsayilan_sira_aralik_m: 6, varsayilan_agac_aralik_m: 4, ...p })

describe('harita modeli', () => {
  const parsel = kutu(0, 0, 200, 60)
  it('tek vana: parsel çizilir, sıra yönü uzun eksen (varsayım)', () => {
    const m = haritaModeli([sek('Bahçe', null)], parsel, AG())!
    expect(m.vanalar).toHaveLength(1)
    expect(m.yonKaynak).toBe('uzun-eksen')
    expect(Math.round(m.siraYonu)).toBe(90)
    expect(m.vanalar[0]!.agaclar.length).toBeGreaterThan(400)
    expect(m.aralikMetni).toBe('6 × 4 m')
  })
  it('kullanıcı yönü uzun ekseni ezer', () => {
    const m = haritaModeli([sek('Bahçe', null)], parsel, AG({ sira_yonu_derece: 20 }))!
    expect(m.yonKaynak).toBe('kullanici')
    expect(m.siraYonu).toBe(20)
  })
  it('dikim aralığı yoksa sıra ÇİZİLMEZ', () => {
    const m = haritaModeli([sek('Bahçe', null)], parsel, AG({ varsayilan_sira_aralik_m: null, varsayilan_agac_aralik_m: null }))!
    expect(m.siraYok).toBe(true)
    expect(m.vanalar[0]!.agaclar).toHaveLength(0)
    expect(m.aralikMetni).toBeNull()
  })
  it('iki vana: her biri kendi çokgeni ve kendi aralığı', () => {
    const m = haritaModeli([sek('V1', kutu(0, 0, 100, 60), 5, 3), sek('V2', kutu(100, 0, 100, 60))], parsel, AG())!
    expect(m.vanalar.map((v) => v.ad)).toEqual(['V1', 'V2'])
    expect(m.vanalar[0]!.siraAralik).toBe(5)
    expect(m.vanalar[1]!.siraAralik).toBe(6)
    expect(m.aralikMetni).toContain('vanaya göre')
  })
  it('çokgen yoksa model yok', () => expect(haritaModeli([sek('Bahçe', null)], null, AG())).toBeNull())
  it('etiket noktası içbükey çokgende içeride', () => {
    const L: [number, number][] = [[0, 0], [100, 0], [100, 20], [20, 20], [20, 100], [0, 100]]
    const p = etiketNoktasi(L)
    const ic = (q: [number, number]) => q[0] >= 0 && q[1] >= 0 && ((q[0] <= 100 && q[1] <= 20) || (q[0] <= 20 && q[1] <= 100))
    expect(ic(p)).toBe(true)
  })
})
