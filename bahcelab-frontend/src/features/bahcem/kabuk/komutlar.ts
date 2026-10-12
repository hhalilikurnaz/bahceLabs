/**
 * ⌘K komut kaydı (SAF): metin → eylem. Kural tabanlı; LLM yok (Asistan Adım 16'da).
 * Her komut bir eylem nesnesi üretir; uygulayan kabuktur (gezinme, harita katmanı).
 */
import { fold } from '../lib/metin'

export type Eylem =
  | { tur: 'git'; yol: string }
  | { tur: 'katman'; katman: 'bolgeler' | 'canlilik' | 'klorofil' | 'yaprakAlani' | 'tacToprak' | 'yaprakSuyu' | 'degisim' }
  | { tur: 'tema' }

export interface Komut {
  id: string
  baslik: string
  ipucu: string
  anahtarlar: string[]
  eylem: Eylem
}

export interface KomutBaglami {
  bahceler: { id: string; ad: string }[]
  seciliBahce: string | null
}

/** Mevcut bağlamda kullanılabilir komutlar. */
export function komutlar(ctx: KomutBaglami): Komut[] {
  const id = ctx.seciliBahce
  const list: Komut[] = []
  if (id) {
    list.push(
      { id: 'zayif', baslik: 'Zayıf bölgeleri göster', ipucu: 'Haritada çok yıllık bölgeler', anahtarlar: ['zayıf', 'bölge', 'zayif bolge'], eylem: { tur: 'katman', katman: 'bolgeler' } },
      { id: 'gecenyil', baslik: 'Geçen yılla karşılaştır', ipucu: 'Geçmiş sayfası', anahtarlar: ['geçen yıl', 'karşılaştır', 'gecen yil'], eylem: { tur: 'git', yol: `/bahceler/${id}/gecmis` } },
      { id: 'ilaclama', baslik: 'İlaçlama zamanı', ipucu: 'Hava sekmesi', anahtarlar: ['ilaçlama', 'ilac', 'püskürt'], eylem: { tur: 'git', yol: `/bahceler/${id}/hava` } },
      { id: 'canlilik', baslik: 'Canlılık katmanı', ipucu: 'NDVI', anahtarlar: ['canlılık', 'ndvi'], eylem: { tur: 'katman', katman: 'canlilik' } },
      { id: 'klorofil', baslik: 'Klorofil katmanı', ipucu: 'NDRE', anahtarlar: ['klorofil', 'ndre', 'sarı', 'azot'], eylem: { tur: 'katman', katman: 'klorofil' } },
      { id: 'yaprakalani', baslik: 'Yaprak alanı katmanı (deneysel)', ipucu: 'LAI', anahtarlar: ['yaprak alanı', 'lai', 'gür'], eylem: { tur: 'katman', katman: 'yaprakAlani' } },
      { id: 'tac', baslik: 'Taç ve toprak katmanı', ipucu: 'MSAVI', anahtarlar: ['taç', 'toprak', 'msavi'], eylem: { tur: 'katman', katman: 'tacToprak' } },
      { id: 'su', baslik: 'Yaprak suyu katmanı', ipucu: 'NDMI', anahtarlar: ['yaprak suyu', 'su', 'ndmi'], eylem: { tur: 'katman', katman: 'yaprakSuyu' } },
      { id: 'degisim', baslik: 'Değişimi göster', ipucu: 'Önceki net görüntüyle fark', anahtarlar: ['değişim', 'fark'], eylem: { tur: 'katman', katman: 'degisim' } },
    )
  }
  for (const b of ctx.bahceler) list.push({ id: `ac-${b.id}`, baslik: `${b.ad} aç`, ipucu: 'Bahçe', anahtarlar: [b.ad, `${b.ad} aç`], eylem: { tur: 'git', yol: `/bahceler/${b.id}` } })
  list.push({ id: 'tema', baslik: 'Açık / koyu tema', ipucu: 'Görünüm', anahtarlar: ['tema', 'koyu', 'açık'], eylem: { tur: 'tema' } })
  return list
}

/** Sorguya uyan komutlar (Türkçe harf duyarsız, kelime başı eşleşmesi önce). */
export function ara(list: Komut[], sorgu: string): Komut[] {
  const q = fold(sorgu).trim()
  if (!q) return list
  const score = (k: Komut): number => {
    const keys = [k.baslik, ...k.anahtarlar].map(fold)
    if (keys.some((x) => x === q)) return 3
    if (keys.some((x) => x.startsWith(q))) return 2
    if (keys.some((x) => x.includes(q))) return 1
    return 0
  }
  return list
    .map((k) => [k, score(k)] as const)
    .filter(([, s]) => s > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k)
}
