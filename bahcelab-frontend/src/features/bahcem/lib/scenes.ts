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
