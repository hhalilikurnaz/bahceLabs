/**
 * Harita skalası kararı (görselleştirme ilkesi 4 · U-06): varsayılan skala MUTLAKTIR. «Bahçenin kendi farkları» (gerilmiş) skala yalnız
 * bahçe-içi aralık fiziksel gürültü eşiğinin ÜSTÜNDEYSE uygulanır; altındaysa gerilme kapalıdır (mutlak skala + «anlamlı fark yok»).
 * Eşik katalogtadır (`gorsel.gerilme_min_aralik`, ön değer · mühendis onayı bekliyor); katalog gelmediyse gerilme kapalı kalır.
 */
export type SkalaIstegi = 'kendi' | 'genel'

export interface SkalaKarari {
  /** Haritanın, lejantın ve histogramın kullandığı alan */
  alan: [number, number]
  istenen: SkalaIstegi
  /** Gerilmiş skala fiilen uygulanıyor */
  gerilmis: boolean
  /** Gerilme istendi ama eşik altında (ya da eşik bilinmiyor) → kapalı */
  kapali: boolean
  /** Bahçe-içi aralık (fark katmanlarında genlik: en büyük |değer|), göstergenin biriminde */
  aralik: number | null
  esik: number | null
}

export interface SkalaGirdisi {
  istek: SkalaIstegi
  mutlak: [number, number]
  /** Verinin yüzdelik (ya da simetrik) gerilmiş alanı; ızgara yoksa null */
  gerilmisAlan: [number, number] | null
  esik: number | null
  /** İki yönlü fark katmanı: aralık = genlik */
  fark: boolean
}

export function skalaKarari({ istek, mutlak, gerilmisAlan, esik, fark }: SkalaGirdisi): SkalaKarari {
  const taban = { istenen: istek, esik }
  if (istek === 'genel' || !gerilmisAlan) return { ...taban, alan: mutlak, gerilmis: false, kapali: false, aralik: gerilmisAlan ? aralikOf(gerilmisAlan, fark) : null }
  const aralik = aralikOf(gerilmisAlan, fark)
  if (esik === null || !(aralik >= esik)) return { ...taban, alan: mutlak, gerilmis: false, kapali: true, aralik }
  return { ...taban, alan: gerilmisAlan, gerilmis: true, kapali: false, aralik }
}

const aralikOf = ([lo, hi]: [number, number], fark: boolean): number => (fark ? Math.max(Math.abs(lo), Math.abs(hi)) : hi - lo)

/** Katman → katalogdaki eşik anahtarı */
export const KATMAN_ESIK_ANAHTARI = {
  canlilik: 'ndvi',
  klorofil: 'ndre',
  yaprakAlani: 'lai',
  tacToprak: 'msavi',
  yaprakSuyu: 'ndmi',
  radarVh: 'radar_vh',
  radarDegisim: 'radar_degisim',
  yuzeySicakligi: 'yuzey_sicakligi',
  degisim: 'degisim',
  bolgeler: null,
} as const

/** «0,56 °C», «0,05» gibi: birimli aralık metni */
export function aralikMetni(aralik: number, birim: string | undefined, sayi: (v: number, d?: number) => string): string {
  const d = aralik < 0.1 ? 3 : aralik < 10 ? 2 : 1
  return `${sayi(aralik, d)}${birim ? ` ${birim}` : ''}`
}
