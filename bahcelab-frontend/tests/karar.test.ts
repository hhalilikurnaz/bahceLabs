import { describe, expect, it } from 'vitest'
import { analizBuyukSayi, durumKarar, gecmisKarar, havaKarar, konumOf, konumSayisi, riskCumlesi, suKarar } from '@/features/bahcem/lib/karar'

const BAND = { p25: 0.643, p50: 0.676, p75: 0.717, ceyrek_yeterli: true }

describe('karar cümleleri (ilke 1–2): kısa, tek cümle, noktalı virgülsüz, jargonsuz', () => {
  const tum = [durumKarar('icinde'), durumKarar('altinda'), durumKarar('ustunde'), suKarar('gerekmiyor', 'nemli'), suKarar('sulama', 'kuru'), gecmisKarar(7, 2, 8), gecmisKarar(1, 9, 1), havaKarar({ don: false, yagisYakin: false, ilaclamaUygun: true })]
  it('noktalı virgül ve yasak terimler yok; tek cümle', () => {
    for (const c of tum) {
      expect(c).not.toContain(';')
      expect(c).not.toMatch(/normal bant|kademe|p10|p90|NDVI/i)
      expect(c.match(/\./g)).toHaveLength(1)
      expect(c.length).toBeLessThanOrEqual(48)
    }
  })
  it('durum: bandın içinde → normal; dışında → altında/üstünde', () => {
    expect(durumKarar(konumOf(0.669, BAND))).toBe('Bahçe bu mevsim için normal.')
    expect(durumKarar(konumOf(0.6, BAND))).toBe('Bahçe bu mevsim için normalin altında.')
    expect(durumKarar(konumOf(0.8, BAND))).toBe('Bahçe bu mevsim için normalin üstünde.')
    expect(konumOf(0.7, { ...BAND, ceyrek_yeterli: false })).toBeNull()
  })
  it('büyük sayı: içinde «Normal», dışında ortancaya göre sapma; gerçek değer küçük yazıda', () => {
    expect(konumSayisi(0.669, BAND)).toEqual({ buyuk: 'Normal', kucuk: 'canlılık 0,67 · bu ay genelde 0,64–0,72' })
    expect(konumSayisi(0.62, BAND)?.buyuk).toBe('−%8')
    expect(konumSayisi(0.74, BAND)?.buyuk).toBe('+%9')
  })
  it('su: toprak ve sulama kararı', () => {
    expect(suKarar('gerekmiyor', 'nemli')).toBe('Toprak nemli, bu hafta sulama gerekmiyor.')
    expect(suKarar('izle', 'orta')).toBe('Toprak nemi orta, sulamayı yakından izleyin.')
    expect(suKarar('veri_yok', null)).toBe('Su durumu için veri yetersiz.')
  })
  it('risk cümlesi API satırlarından', () => {
    expect(riskCumlesi(['Akdeniz meyve sineği · orta', 'Kuruma hastalığı (mal secco) · orta'])).toBe('Meyve sineği ve kuruma hastalığı riski orta.')
    expect(riskCumlesi([])).toBe('')
  })
  it('geçmiş: dağılıma göre', () => {
    expect(gecmisKarar(9, 1, 2)).toBe('Bu sezon normal.')
    expect(gecmisKarar(7, 2, 8)).toBe('Bu sezon normal ya da normalin üstünde.')
    expect(gecmisKarar(0, 0, 0)).toBe('Bu sezon için yeterli görüntü yok.')
  })
  it('analiz büyük sayı', () => {
    expect(analizBuyukSayi(3.6)).toEqual({ buyuk: '3,6 da', etiket: 'sürekli zayıf alan' })
    expect(analizBuyukSayi(null)).toBeNull()
  })
})

import { listeKarar } from '@/features/bahcem/lib/karar'
describe('listeKarar', () => {
  it('hepsi aynıysa «İki bahçe de izlemede.»; karışıkta en kötü kademe', () => {
    expect(listeKarar(['izle', 'izle'])).toBe('İki bahçe de izlemede.')
    expect(listeKarar(['iyi', 'dikkat', 'iyi'])).toBe('Bir bahçe dikkat istiyor.')
    expect(listeKarar(['izle'])).toBe('Bahçe izlemede.')
    expect(listeKarar([undefined])).toBeNull()
  })
})

import { odakPayi, ODAK_EN_AZ_ALAN } from '@/features/bahcem/calisma/harita/haritaYardim'
describe('odakPayi (mobil alt sayfa dolgusu)', () => {
  it('alt sayfa yoksa masaüstü payı; varsa görünür yükseklik alt dolgudur', () => {
    expect(odakPayi(0, 800)).toMatchObject({ top: 76, bottom: 72 })
    expect(odakPayi(300, 844).bottom).toBe(312)
  })
  it('her durakta bahçeye en az ODAK_EN_AZ_ALAN yükseklik kalır (kapalı/yarım/tam, 390×844 ve 360×640)', () => {
    for (const H of [844, 640]) for (const sayfa of [132, Math.round(H * 0.5), Math.round(H * 0.7)]) {
      const p = odakPayi(sayfa, H)
      expect(H - p.top - p.bottom, `H=${H} sayfa=${sayfa}`).toBeGreaterThanOrEqual(ODAK_EN_AZ_ALAN)
    }
  })
})
