/** Harita katmanları kataloğu: her satır kaynak, çözünürlük, görsel dil ve uç kelimeleri taşır. Yeni katman = yeni satır. */
import type { GostergeId } from '../api/edinimApi'
import type { RampId } from '../lib/paletler'

export type KatmanId = 'canlilik' | 'klorofil' | 'yaprakAlani' | 'tacToprak' | 'yaprakSuyu' | 'bolgeler' | 'degisim'
export type Gorunum = 'rampa' | 'kareler' | 'daireler'

export interface KatmanTanimi {
  id: KatmanId
  ad: string
  grup: 'Bitki' | 'Su' | 'Analiz'
  /** Gösterge (bölgelerde yok) */
  gosterge: GostergeId | null
  ramp: RampId | null
  /** Görsel dil: sürekli renk (rampa), orantılı kareler (LAI), toprak zemin + tepe daireleri (MSAVI) */
  gorunum: Gorunum
  kaynak: string
  cozunurluk: string
  /** Tek cümle: bu katman neyi gösterir */
  anlam: string
  /** Histogram lejantının uç kelimeleri: [düşük uç, yüksek uç] */
  uclar: [string, string]
  deneysel?: boolean
}

export const KATMANLAR: Record<KatmanId, KatmanTanimi> = {
  canlilik: { id: 'canlilik', ad: 'Canlılık', grup: 'Bitki', gosterge: 'ndvi', ramp: 'canlilik', gorunum: 'rampa', kaynak: 'Sentinel-2 L2A', cozunurluk: '10 m', anlam: 'Yaprak örtüsünün yoğunluğu (NDVI).', uclar: ['zayıf', 'güçlü'] },
  klorofil: { id: 'klorofil', ad: 'Klorofil', grup: 'Bitki', gosterge: 'ndre', ramp: 'klorofil', gorunum: 'rampa', kaynak: 'Sentinel-2 L2A', cozunurluk: '20 m', anlam: 'Yaprağın yeşillik ve azot durumu (NDRE).', uclar: ['sararmış', 'koyu yeşil'] },
  yaprakAlani: { id: 'yaprakAlani', ad: 'Yaprak alanı', grup: 'Bitki', gosterge: 'lai', ramp: 'yaprakAlani', gorunum: 'kareler', kaynak: 'Sentinel-2 L2A', cozunurluk: '20 m', anlam: 'Birim alandaki yaprak miktarı (LAI); kare büyüklüğü değerdir.', uclar: ['seyrek', 'gür'], deneysel: true },
  tacToprak: { id: 'tacToprak', ad: 'Taç ve toprak', grup: 'Bitki', gosterge: 'msavi', ramp: 'tacToprak', gorunum: 'daireler', kaynak: 'Sentinel-2 L2A', cozunurluk: '10 m', anlam: 'Toprak etkisi düzeltilmiş canlılık (MSAVI); daire büyüklüğü ağaç tacıdır.', uclar: ['çıplak toprak', 'sık taç'] },
  yaprakSuyu: { id: 'yaprakSuyu', ad: 'Yaprak suyu', grup: 'Su', gosterge: 'ndmi', ramp: 'yaprakSuyu', gorunum: 'rampa', kaynak: 'Sentinel-2 L2A', cozunurluk: '20 m', anlam: 'Yaprağın su içeriği (NDMI).', uclar: ['kuru', 'nemli'] },
  bolgeler: { id: 'bolgeler', ad: 'Bölgeler', grup: 'Analiz', gosterge: null, ramp: null, gorunum: 'rampa', kaynak: 'Sentinel-2 çok yıllık', cozunurluk: '10 m', anlam: 'Yıllardır güçlü ya da zayıf kalan kesimler.', uclar: ['zayıf', 'güçlü'] },
  degisim: { id: 'degisim', ad: 'Değişim', grup: 'Analiz', gosterge: 'ndvi', ramp: 'degisim', gorunum: 'rampa', kaynak: 'Sentinel-2 L2A', cozunurluk: '10 m', anlam: 'Seçili tarihle bir önceki net görüntü arasındaki canlılık farkı.', uclar: ['düşüş', 'artış'] },
}
export const KATMAN_SIRASI: KatmanId[] = ['canlilik', 'klorofil', 'yaprakAlani', 'tacToprak', 'yaprakSuyu', 'bolgeler', 'degisim']
export const KATMAN_GRUPLARI = ['Bitki', 'Su', 'Analiz'] as const

/** Göstergenin mutlak (genel) skala aralığı ve ad/teknik adı. LAI: 0–5 (narenciye için makul üst). */
export const GOSTERGE_ARALIK: Record<GostergeId, { min: number; max: number; fark: number }> = {
  ndvi: { min: 0, max: 0.9, fark: 0.25 },
  ndmi: { min: -0.2, max: 0.6, fark: 0.15 },
  ndre: { min: 0, max: 0.6, fark: 0.15 },
  msavi: { min: 0, max: 0.8, fark: 0.2 },
  lai: { min: 0, max: 5, fark: 1.5 },
}
export const GOSTERGE_KATMAN: Record<GostergeId, KatmanId> = { ndvi: 'canlilik', ndre: 'klorofil', lai: 'yaprakAlani', msavi: 'tacToprak', ndmi: 'yaprakSuyu' }
