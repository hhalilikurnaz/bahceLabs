import { describe, expect, it } from 'vitest'
import type { GardenOverview, GardenStatus } from '@/features/bahcem/api/overviewApi'
import { countByStatus, filterGardens, sortGardens } from '@/features/bahcem/lib/gardenList'

const garden = (ad: string, durum: GardenStatus, dekar: number): GardenOverview => ({
  id: ad,
  ad,
  urun: 'limon',
  cesit: null,
  dekar,
  il: null,
  ilce: null,
  durum,
  durumNedeni: null,
  indeks: 'ndvi',
  sonGoruntu: null,
  seri: [],
  uyarilar: [],
  hava: null,
})

const ITEMS = [
  garden('Çamlık', 'iyi', 40),
  garden('Işık', 'dikkat', 12),
  garden('İncir', 'izle', 90),
  garden('Arı', 'veri_yok', 5),
  garden('Ada', 'dikkat', 70),
]

describe('bahçe listesi sıralama ve filtre', () => {
  it('duruma göre: dikkat → izle → veri yok → iyi, eşitlikte ada göre', () => {
    expect(sortGardens(ITEMS, 'durum').map((g) => g.ad)).toEqual(['Ada', 'Işık', 'İncir', 'Arı', 'Çamlık'])
  })

  it('ada göre Türkçe sıralama (Ç, İ, I doğru yerde)', () => {
    expect(sortGardens(ITEMS, 'ad').map((g) => g.ad)).toEqual(['Ada', 'Arı', 'Çamlık', 'Işık', 'İncir'])
  })

  it('alana göre büyükten küçüğe', () => {
    expect(sortGardens(ITEMS, 'alan').map((g) => g.dekar)).toEqual([90, 70, 40, 12, 5])
  })

  it('sıralama girdiyi değiştirmez', () => {
    const before = ITEMS.map((g) => g.ad)
    sortGardens(ITEMS, 'alan')
    expect(ITEMS.map((g) => g.ad)).toEqual(before)
  })

  it('durum filtresi ve ad araması birlikte çalışır', () => {
    expect(filterGardens(ITEMS, 'dikkat', '').map((g) => g.ad)).toEqual(['Işık', 'Ada'])
    expect(filterGardens(ITEMS, 'hepsi', 'ı').map((g) => g.ad)).toEqual(['Çamlık', 'Işık', 'Arı'])
    expect(filterGardens(ITEMS, 'dikkat', 'ada').map((g) => g.ad)).toEqual(['Ada'])
    expect(filterGardens(ITEMS, 'iyi', 'zzz')).toEqual([])
  })

  it('durum sayıları', () => {
    expect(countByStatus(ITEMS)).toEqual({ hepsi: 5, iyi: 1, izle: 1, dikkat: 2, veri_yok: 1 })
  })
})
