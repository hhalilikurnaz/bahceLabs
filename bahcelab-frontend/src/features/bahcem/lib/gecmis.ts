/** Geçmiş sayfası yardımcıları (SAF): olay türü süzgeçleri, yıla göre gruplama, zaman çizelgesi konumu. */
import type { Olay } from '../api/olayApi'

export const TUR_SUZGECLERI = [
  { id: 'don', ad: 'Don', isaret: '❄' },
  { id: 'yagis', ad: 'Aşırı yağış', isaret: '▼' },
  { id: 'ruzgar', ad: 'Rüzgâr', isaret: '≈' },
  { id: 'optik', ad: 'Optik düşüş', isaret: '◆' },
  { id: 'radar', ad: 'Radar değişimi', isaret: '■' },
] as const
export type TurSuzgeci = (typeof TUR_SUZGECLERI)[number]['id']

const ESLEME: Record<string, TurSuzgeci> = { don: 'don', asiri_yagis: 'yagis', ruzgar: 'ruzgar', s2_dusus: 'optik', radar_degisim: 'radar' }

/** Bir olayın süzgeç anahtarları: birleşen olay («don + optik hasar izi») hem Don hem Optik düşüş altında bulunur ama listede TEK satırdır. */
export function turAnahtarlari(o: Pick<Olay, 'tur' | 'turler'>): TurSuzgeci[] {
  const out = new Set<TurSuzgeci>()
  for (const t of [o.tur, ...o.turler]) if (ESLEME[t]) out.add(ESLEME[t])
  return [...out]
}

export const birlesikMi = (o: Pick<Olay, 'tur' | 'turler'>): boolean => o.tur === 'don' && o.turler.includes('s2_dusus')

/** Boş küme = o boyutta süzgeç yok (hepsi). */
export function suz(olaylar: Olay[], turler: ReadonlySet<TurSuzgeci>, guvenler: ReadonlySet<Olay['guven']>, yil: number | null = null): Olay[] {
  return olaylar.filter((o) => (turler.size === 0 || turAnahtarlari(o).some((t) => turler.has(t))) && (guvenler.size === 0 || guvenler.has(o.guven)) && (yil === null || o.baslangic.startsWith(`${yil}-`)))
}

export interface YilGrubu {
  yil: number
  olaylar: Olay[]
}
/** Yeniden eskiye yıl grupları; grup içinde de yeniden eskiye. */
export function yilaGore(olaylar: Olay[]): YilGrubu[] {
  const map = new Map<number, Olay[]>()
  for (const o of [...olaylar].sort((a, b) => b.baslangic.localeCompare(a.baslangic))) {
    const y = Number(o.baslangic.slice(0, 4))
    map.set(y, [...(map.get(y) ?? []), o])
  }
  return [...map.entries()].map(([yil, list]) => ({ yil, olaylar: list })).sort((a, b) => b.yil - a.yil)
}

/** Çizelge x konumu: tarihin [ilk yıl başı, son yıl sonu] aralığındaki oranı (0–1). */
export function zamanOrani(tarih: string, ilkYil: number, sonYil: number): number {
  const t0 = Date.UTC(ilkYil, 0, 1)
  const t1 = Date.UTC(sonYil + 1, 0, 1)
  return Math.min(1, Math.max(0, (Date.parse(`${tarih}T00:00:00Z`) - t0) / (t1 - t0)))
}
