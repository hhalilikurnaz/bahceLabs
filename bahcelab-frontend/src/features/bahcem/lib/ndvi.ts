import { MONTHS_SHORT } from './dates'
import type { NdviObservation } from '../api/ndviApi'

/**
 * NDVI renk skalası (kırmızı → sarı → yeşil, 0,0–0,9). Backend `processing.COLOR_STOPS` ile aynı
 * duraklar kullanılır; harita PNG'si, lejant, rozet ve grafik birbirini tutsun diye.
 */
export const NDVI_MIN = 0
export const NDVI_MAX = 0.9
export const NDVI_STOPS: [number, [number, number, number]][] = [
  [0.0, [215, 48, 39]],
  [0.3, [252, 141, 89]],
  [0.5, [254, 224, 139]],
  [0.7, [145, 207, 96]],
  [0.9, [26, 152, 80]],
]

export function ndviRgb(value: number): [number, number, number] {
  const v = Math.min(NDVI_MAX, Math.max(NDVI_MIN, value))
  for (let i = 1; i < NDVI_STOPS.length; i++) {
    const [x1, c1] = NDVI_STOPS[i]
    if (v <= x1) {
      const [x0, c0] = NDVI_STOPS[i - 1]
      const t = (v - x0) / (x1 - x0)
      return [0, 1, 2].map((k) => Math.round(c0[k] + (c1[k] - c0[k]) * t)) as [number, number, number]
    }
  }
  return NDVI_STOPS[NDVI_STOPS.length - 1][1]
}

export function ndviColor(value: number): string {
  const [r, g, b] = ndviRgb(value)
  return `rgb(${r} ${g} ${b})`
}

/** CSS gradient: lejant çubuğu için */
export function ndviGradient(): string {
  const stops = NDVI_STOPS.map(([x, [r, g, b]]) => `rgb(${r} ${g} ${b}) ${(x / NDVI_MAX) * 100}%`)
  return `linear-gradient(to right, ${stops.join(', ')})`
}

export function formatNdvi(value: number | null | undefined): string {
  return value == null ? '—' : value.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export const monthLabels = MONTHS_SHORT

/** Seçili tarih geçerliyse onu, değilse en son geçerli (bulutsuz) görüntüyü verir. */
export function pickActiveObservation(
  observations: NdviObservation[] | undefined,
  selectedDate: string | null,
): NdviObservation | null {
  const usable = (observations ?? []).filter((o) => o.durum === 'tamam' && o.pngVar)
  return usable.find((o) => o.tarih === selectedDate) ?? usable[usable.length - 1] ?? null
}
