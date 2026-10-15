/** Kesintisiz canlılık eğrisi çizim yardımcıları (SAF): gözlem destekli / tahmini parçalar, bant yolu, yıl filtresi. */
import type { EgriNoktasi } from '../api/egriApi'
import { yilIciKonum } from './sezon'

export interface Parca {
  tahmini: boolean
  noktalar: EgriNoktasi[]
}

/** Ardışık noktaları «gözlem destekli» ve «tahmini» parçalara böler; komşu parçalar bir ortak noktayla birleşir (çizgide kopukluk olmasın). */
export function parcala(noktalar: EgriNoktasi[]): Parca[] {
  const out: Parca[] = []
  for (const n of noktalar) {
    const son = out[out.length - 1]
    if (son && son.tahmini === n.tahmini) {
      son.noktalar.push(n)
    } else {
      out.push({ tahmini: n.tahmini, noktalar: son ? [son.noktalar[son.noktalar.length - 1], n] : [n] })
    }
  }
  return out
}

export function yilNoktalari<T extends { tarih: string }>(list: T[], yil: number): T[] {
  return list.filter((n) => n.tarih.startsWith(`${yil}-`))
}

/** Çizgi yolu (`x`: yıl içi konum 0–12, `y`: ölçeklenmiş piksel). */
export function cizgiYolu(noktalar: EgriNoktasi[], X: (konum: number) => number, Y: (v: number) => number): string {
  return noktalar.length ? `M${noktalar.map((n) => `${X(yilIciKonum(n.tarih)).toFixed(1)},${Y(n.deger).toFixed(1)}`).join(' L')}` : ''
}

/** Belirsizlik bandı yolu: üst sınır soldan sağa, alt sınır sağdan sola. */
export function bantYolu(noktalar: EgriNoktasi[], X: (konum: number) => number, Y: (v: number) => number): string {
  if (!noktalar.length) return ''
  const ust = noktalar.map((n) => `${X(yilIciKonum(n.tarih)).toFixed(1)},${Y(n.ust).toFixed(1)}`)
  const alt = [...noktalar].reverse().map((n) => `${X(yilIciKonum(n.tarih)).toFixed(1)},${Y(n.alt).toFixed(1)}`)
  return `M${[...ust, ...alt].join(' L')}Z`
}

export interface RadarAraligi {
  baslangic: string
  bitis: string
  /** aralıktaki radar geçişi sayısı */
  gecis: number
  /** aralıkta «değişim var» denen geçiş tarihleri (yalnız bunlar ayrıca işaretlenir) */
  degisimler: string[]
}

const gunFarki = (a: string, b: string): number => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000)

/** Ardışık radar geçişlerini TEK «radar izleme» aralığında birleştirir (geçişler arası ≤ `maxBosluk` gün): çubuklarda üçgen kalabalığı olmaz. */
export function radarAraliklari(isaretler: { tarih: string; degisim: boolean }[], maxBosluk = 14): RadarAraligi[] {
  const sirali = [...isaretler].sort((a, b) => a.tarih.localeCompare(b.tarih))
  const out: RadarAraligi[] = []
  for (const r of sirali) {
    const son = out[out.length - 1]
    if (son && gunFarki(son.bitis, r.tarih) <= maxBosluk) {
      son.bitis = r.tarih
      son.gecis += 1
      if (r.degisim) son.degisimler.push(r.tarih)
    } else {
      out.push({ baslangic: r.tarih, bitis: r.tarih, gecis: 1, degisimler: r.degisim ? [r.tarih] : [] })
    }
  }
  return out
}

/** Eğrinin en son noktası tahminiyse gösterilecek etiket metni; yoksa null. */
export function tahminEtiketi(noktalar: EgriNoktasi[]): string | null {
  const son = noktalar[noktalar.length - 1]
  return son?.tahmini ? 'tahmini' : null
}
