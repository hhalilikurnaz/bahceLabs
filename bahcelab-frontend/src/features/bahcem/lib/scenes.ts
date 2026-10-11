import type { Scene } from '../api/indeksApi'
import { nearestDate, shiftDays } from './dates'
import { TRUE_COLOR, type IndexId, type LayerId } from './indices'
import type { ChangePreset } from '../stores/bahcemStore'

/** Bu katman için kullanılabilir (bulutsuz ve görüntüsü hazır) sahne mi? */
export function isUsable(scene: Scene, layer: LayerId): boolean {
  if (scene.durum !== 'tamam') return false
  return layer === TRUE_COLOR ? scene.gercekRenkVar : Boolean(scene.indeksler[layer as IndexId]?.pngVar)
}

export const usableDates = (scenes: Scene[] | undefined, layer: LayerId): string[] =>
  (scenes ?? []).filter((s) => isUsable(s, layer)).map((s) => s.tarih)

/** Seçili tarih geçerliyse onu, değilse en son kullanılabilir sahneyi verir. */
export function pickScene(scenes: Scene[] | undefined, layer: LayerId, selectedDate: string | null): Scene | null {
  const usable = (scenes ?? []).filter((s) => isUsable(s, layer))
  return usable.find((s) => s.tarih === selectedDate) ?? usable[usable.length - 1] ?? null
}

export const findScene = (scenes: Scene[] | undefined, tarih: string | null): Scene | null =>
  tarih ? ((scenes ?? []).find((s) => s.tarih === tarih) ?? null) : null

/**
 * Değişim haritası için karşılaştırılacak (önceki) tarih.
 * "ikihafta": seçili tarihten ~14 gün önceye en yakın görüntü (±7 gün); "gecenyil": ~1 yıl önce (±15 gün).
 */
export function referenceDate(
  preset: ChangePreset,
  selected: string,
  dates: string[],
  custom: string | null,
): string | null {
  const others = dates.filter((d) => d !== selected)
  if (preset === 'ozel') return custom && others.includes(custom) ? custom : null
  if (preset === 'ikihafta') return nearestDate(shiftDays(selected, -14), others.filter((d) => d < selected), 7)
  return nearestDate(shiftDays(selected, -365), others, 15)
}

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

/**
 * Son değerin, yaklaşık `days` gün önceki en yakın geçerli görüntüye göre değişimi.
 * `toleranceDays` içinde görüntü yoksa null (uydurma karşılaştırma yapılmaz).
 */
export function changeOverDays(
  scenes: Scene[] | undefined,
  indeks: IndexId,
  days: number,
  toleranceDays: number,
): ValueChange | null {
  const latest = latestIndexValue(scenes, indeks)
  if (!latest) return null
  const candidates = (scenes ?? []).flatMap((scene) => {
    const summary = scene.durum === 'tamam' ? scene.indeksler[indeks] : undefined
    return summary && scene.tarih < latest.tarih ? [{ tarih: scene.tarih, ortalama: summary.ortalama }] : []
  })
  const target = shiftDays(latest.tarih, -days)
  const nearest = nearestDate(target, candidates.map((c) => c.tarih), toleranceDays)
  const previous = candidates.find((c) => c.tarih === nearest)
  if (!previous) return null
  const percent = Math.abs(previous.ortalama) < 1e-6 ? null : ((latest.ortalama - previous.ortalama) / Math.abs(previous.ortalama)) * 100
  return { previous, latest, percent }
}
