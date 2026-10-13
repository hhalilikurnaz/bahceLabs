/**
 * Veri renkleri (tek yer). Arayüz nötr; renk yalnız veride.
 * - Sıralı veri → tek tonlu sıralı skala (açık → koyu, algısal açıklık tek yönlü): Canlılık (yeşil), Yaprak suyu (mavi).
 * - Değişim → ortası nötr iki yönlü skala (kahve ← nötr → yeşil).
 * - Bölgeler SIRALIDIR (zayıf · orta · güçlü): tek tonun 3 derecesi; zayıf ayrıca taramalı.
 * Doğrulama: tests/paletler.test.ts (OKLab açıklık tekdüzeliği, komşu ΔE, kontrast).
 */
export type Rgb = [number, number, number]
export type Stops = [number, Rgb][]

const hex = (h: string): Rgb => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
const stops = (list: string[]): Stops => list.map((c, i) => [i / (list.length - 1), hex(c)])

export const RAMPS = {
  canlilik: stops(['#eef3e4', '#cfe3b9', '#93c08a', '#4e8f5c', '#1e5235']),
  yaprakSuyu: stops(['#eef3f7', '#c9dcea', '#8cb4d2', '#4c7fa8', '#1f4766']),
  degisim: stops(['#8c510a', '#d8b365', '#f1efe9', '#90c48a', '#1b7837']),
  /** Klorofil (NDRE): sarı → yeşil */
  klorofil: stops(['#f6efb0', '#e3dc7a', '#b4cf6a', '#6fae5e', '#2a7048']),
  /** Yaprak alanı (LAI): kare dolgusu tek ton koyu yeşil (kare büyüklüğü değeri taşır); lejant bu ton skalasıyla boyanır */
  yaprakAlani: stops(['#dfe9d4', '#b6d1a2', '#82b073', '#4e8750', '#255a3a']),
  /** Radar (VH): gri-mavi ışık şiddeti dokusu; koyu = zayıf yansıma, açık = güçlü yansıma */
  radar: stops(['#26323d', '#4a5e70', '#7c93a6', '#b3c3cf', '#eaf0f4']),
  /** Radar değişimi: ortası nötr iki yönlü (azalma = turuncu-kahve ← nötr → artış = mavi) */
  radarDegisim: stops(['#a8470a', '#e0a15f', '#eeeeea', '#8fb6d6', '#1f5f99']),
  /** Taç ve toprak (MSAVI): taç daireleri açık → koyu yeşil */
  tacToprak: stops(['#c9dca4', '#9cc774', '#62a255', '#357a43', '#1b5232']),
} as const
export type RampId = keyof typeof RAMPS

/** MSAVI/LAI görsel dili için zemin tonları: toprak (taç ve toprak) ve nötr kâğıt (yaprak alanı kareleri) */
export const ZEMIN = { toprak: '#b79b78', notr: '#efece4' } as const

/** Bölge sınıfı (1 = zayıf … 3 = güçlü) → aynı tonun dereceleri */
export const ZONE_SHADES: Record<number, string> = { 1: '#dbe6d3', 2: '#8fb383', 3: '#3a6b46' }
export const ZONE_LABEL: Record<number, string> = { 1: 'Zayıf', 2: 'Orta', 3: 'Güçlü' }

export function rampColor(ramp: Stops, t: number): Rgb {
  const v = Math.min(1, Math.max(0, Number.isFinite(t) ? t : 0))
  for (let i = 1; i < ramp.length; i++) {
    const [x1, c1] = ramp[i]
    if (v <= x1) {
      const [x0, c0] = ramp[i - 1]
      const f = (v - x0) / (x1 - x0 || 1)
      return [0, 1, 2].map((k) => Math.round(c0[k] + (c1[k] - c0[k]) * f)) as Rgb
    }
  }
  return ramp[ramp.length - 1][1]
}
export const rampCss = (ramp: Stops, t: number): string => `rgb(${rampColor(ramp, t).join(',')})`
export const rampGradient = (ramp: Stops): string => `linear-gradient(90deg, ${ramp.map(([p, c]) => `rgb(${c.join(',')}) ${Math.round(p * 100)}%`).join(', ')})`

// ----------------------------------------------------------------------------- doğrulama yardımcıları (testler)
const lin = (c: number) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 }
/** sRGB → OKLab [L, a, b] */
export function oklab([r, g, b]: Rgb): [number, number, number] {
  const R = lin(r), G = lin(g), B = lin(b)
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B)
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B)
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B)
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s]
}
export const deltaE = (a: Rgb, b: Rgb): number => { const [x, y, z] = oklab(a); const [p, q, w] = oklab(b); return Math.hypot(x - p, y - q, z - w) * 100 }
export function contrast(a: Rgb, b: Rgb): number {
  const L = (c: Rgb) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2])
  const [x, y] = [L(a), L(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}
export { hex as parseHex }
