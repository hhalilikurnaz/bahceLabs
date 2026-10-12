/** Harita katmanları kataloğu (B1): her satır kaynak, çözünürlük ve skala bilgisini taşır. Yeni katman = yeni satır. */
import type { IndexId } from '../lib/indices'
import type { RampId } from '../lib/paletler'

export type KatmanId = 'canlilik' | 'yaprakSuyu' | 'bolgeler' | 'degisim'

export interface KatmanTanimi {
  id: KatmanId
  ad: string
  grup: 'Bitki' | 'Analiz'
  /** Ham ızgara indeksi (bölgelerde yok) */
  indeks: IndexId | null
  ramp: RampId | null
  kaynak: string
  cozunurluk: string
  /** Tek cümle: bu katman neyi gösterir */
  anlam: string
}

export const KATMANLAR: Record<KatmanId, KatmanTanimi> = {
  canlilik: { id: 'canlilik', ad: 'Canlılık', grup: 'Bitki', indeks: 'ndvi', ramp: 'canlilik', kaynak: 'Sentinel-2 L2A', cozunurluk: '10 m', anlam: 'Yaprak örtüsünün yoğunluğu (NDVI).' },
  yaprakSuyu: { id: 'yaprakSuyu', ad: 'Yaprak suyu', grup: 'Bitki', indeks: 'ndmi', ramp: 'yaprakSuyu', kaynak: 'Sentinel-2 L2A', cozunurluk: '20 m (10 m ızgarada)', anlam: 'Yaprağın su içeriği (NDMI).' },
  bolgeler: { id: 'bolgeler', ad: 'Bölgeler', grup: 'Analiz', indeks: null, ramp: null, kaynak: 'Sentinel-2 çok yıllık', cozunurluk: '10 m', anlam: 'Yıllardır güçlü ya da zayıf kalan kesimler.' },
  degisim: { id: 'degisim', ad: 'Değişim', grup: 'Analiz', indeks: 'ndvi', ramp: 'degisim', kaynak: 'Sentinel-2 L2A', cozunurluk: '10 m', anlam: 'Seçili tarihle bir önceki net görüntü arasındaki canlılık farkı.' },
}
export const KATMAN_SIRASI: KatmanId[] = ['canlilik', 'yaprakSuyu', 'bolgeler', 'degisim']
