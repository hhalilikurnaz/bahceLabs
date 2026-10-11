import type { Scene } from '../api/indeksApi'
import { nearestDate, shiftDays } from './dates'
import { TRUE_COLOR, type IndexId, type LayerId } from './indices'

/** Bu katman için kullanılabilir (bulutsuz ve görüntüsü hazır) sahne mi? */
export function isUsable(scene: Scene, layer: LayerId): boolean {
  if (scene.durum !== 'tamam') return false
  return layer === TRUE_COLOR ? scene.gercekRenkVar : Boolean(scene.indeksler[layer as IndexId]?.pngVar)
}

export const usableDates = (scenes: Scene[] | undefined, layer: LayerId): string[] =>
  (scenes ?? []).filter((s) => isUsable(s, layer)).map((s) => s.tarih)

/** Ana ekranın gösterdiği görüntü: bu katman için en son geçerli (bulutsuz, hazır) sahne. */
export function latestUsableScene(scenes: Scene[] | undefined, layer: LayerId): Scene | null {
  const usable = (scenes ?? []).filter((s) => isUsable(s, layer))
  return usable[usable.length - 1] ?? null
}

export const findScene = (scenes: Scene[] | undefined, tarih: string | null): Scene | null =>
  tarih ? ((scenes ?? []).find((s) => s.tarih === tarih) ?? null) : null

/** Sahne (mutlak) ortalamasından rozet için değer */
export function latestIndexValue(scenes: Scene[] | undefined, indeks: IndexId): { tarih: string; ortalama: number } | null {
  for (const scene of [...(scenes ?? [])].reverse()) {
    const summary = scene.durum === 'tamam' ? scene.indeksler[indeks] : undefined
    if (summary) return { tarih: scene.tarih, ortalama: summary.ortalama }
  }
  return null
}

export interface ValueChange {
  /** Karşılaştırılan önceki değer ve tarihi */
  previous: { tarih: string; ortalama: number }
  latest: { tarih: string; ortalama: number }
  /** Yüzde değişim (önceki sıfıra yakınsa null) */
  percent: number | null
}

/** `date` tarihindeki (ya da ondan önceki en yakın) değer. */
function valueOnOrBefore(scenes: Scene[] | undefined, indeks: IndexId, date: string): { tarih: string; ortalama: number } | null {
  for (const scene of [...(scenes ?? [])].reverse()) {
    const summary = scene.durum === 'tamam' && scene.tarih <= date ? scene.indeksler[indeks] : undefined
    if (summary) return { tarih: scene.tarih, ortalama: summary.ortalama }
  }
  return null
}

/**
 * `date` tarihindeki değerin, yaklaşık `days` gün önceki en yakın geçerli görüntüye göre değişimi.
 * `toleranceDays` içinde görüntü yoksa null (uydurma karşılaştırma yapılmaz).
 */
export function changeAt(scenes: Scene[] | undefined, indeks: IndexId, date: string, days: number, toleranceDays: number): ValueChange | null {
  const latest = valueOnOrBefore(scenes, indeks, date)
  if (!latest) return null
  const candidates = (scenes ?? []).flatMap((scene) => {
    const summary = scene.durum === 'tamam' ? scene.indeksler[indeks] : undefined
    return summary && scene.tarih < latest.tarih ? [{ tarih: scene.tarih, ortalama: summary.ortalama }] : []
  })
  const nearest = nearestDate(shiftDays(latest.tarih, -days), candidates.map((c) => c.tarih), toleranceDays)
  const previous = candidates.find((c) => c.tarih === nearest)
  if (!previous) return null
  const percent = Math.abs(previous.ortalama) < 1e-6 ? null : ((latest.ortalama - previous.ortalama) / Math.abs(previous.ortalama)) * 100
  return { previous, latest, percent }
}

/** Son değerin, yaklaşık `days` gün önceki en yakın geçerli görüntüye göre değişimi. */
export function changeOverDays(scenes: Scene[] | undefined, indeks: IndexId, days: number, toleranceDays: number): ValueChange | null {
  const latest = latestIndexValue(scenes, indeks)
  return latest ? changeAt(scenes, indeks, latest.tarih, days, toleranceDays) : null
}

/** `date` tarihine kadar son `count` geçerli ortalama (eskiden yeniye) — mini grafik için. */
export function seriesUpTo(scenes: Scene[] | undefined, indeks: IndexId, date: string, count: number): number[] {
  return (scenes ?? [])
    .filter((s) => s.durum === 'tamam' && s.tarih <= date && s.indeksler[indeks])
    .slice(-count)
    .map((s) => (s.indeksler[indeks] as NonNullable<Scene['indeksler'][IndexId]>).ortalama)
}
