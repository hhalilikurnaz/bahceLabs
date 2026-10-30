import { describe, expect, it } from 'vitest'
import { aralikMetni, skalaKarari } from '@/features/bahcem/lib/skala'

const MUTLAK: [number, number] = [15, 50]

describe('skalaKarari (U-06: varsayılan mutlak, gerilme eşikli)', () => {
  it('mutlak skala istenince veri aralığı ne olursa olsun mutlak alan kullanılır', () => {
    const k = skalaKarari({ istek: 'genel', mutlak: MUTLAK, gerilmisAlan: [35.91, 36.47], esik: 1.5, fark: false })
    expect(k).toMatchObject({ alan: MUTLAK, gerilmis: false, kapali: false })
  })
  it('gerilme istenir ama aralık eşiğin altındaysa (0,56 °C < 1,5 °C) KAPALIDIR: mutlak alan + kapalı', () => {
    const k = skalaKarari({ istek: 'kendi', mutlak: MUTLAK, gerilmisAlan: [35.91, 36.47], esik: 1.5, fark: false })
    expect(k.alan).toEqual(MUTLAK)
    expect(k).toMatchObject({ gerilmis: false, kapali: true, esik: 1.5 })
    expect(k.aralik).toBeCloseTo(0.56, 5)
  })
  it('eşiğin üstünde gerilmiş alan uygulanır', () => {
    const k = skalaKarari({ istek: 'kendi', mutlak: MUTLAK, gerilmisAlan: [30, 36], esik: 1.5, fark: false })
    expect(k).toMatchObject({ alan: [30, 36], gerilmis: true, kapali: false })
  })
  it('eşik bilinmiyorsa (katalog gelmedi) gerilme kapalı kalır: güvenli taraf', () => {
    const k = skalaKarari({ istek: 'kendi', mutlak: MUTLAK, gerilmisAlan: [30, 40], esik: null, fark: false })
    expect(k).toMatchObject({ alan: MUTLAK, gerilmis: false, kapali: true })
  })
  it('fark katmanında aralık = genlik (en büyük |değer|)', () => {
    const kapali = skalaKarari({ istek: 'kendi', mutlak: [-6, 6], gerilmisAlan: [-1.2, 1.2], esik: 2, fark: true })
    expect(kapali).toMatchObject({ kapali: true, aralik: 1.2, alan: [-6, 6] })
    expect(skalaKarari({ istek: 'kendi', mutlak: [-6, 6], gerilmisAlan: [-2.24, 2.24], esik: 2, fark: true }).gerilmis).toBe(true)
  })
  it('ızgara yoksa mutlak alan, kapalı değil', () => {
    expect(skalaKarari({ istek: 'kendi', mutlak: MUTLAK, gerilmisAlan: null, esik: 1.5, fark: false })).toMatchObject({ alan: MUTLAK, kapali: false, aralik: null })
  })
  it('aralık metni birimle yazılır', () => {
    expect(aralikMetni(0.56, '°C', (v, d) => v.toFixed(d))).toBe('0.56 °C')
  })
})
