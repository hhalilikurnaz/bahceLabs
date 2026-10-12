/** Saha defteri paletleri. İndeks: algısal olarak düzgün (açık saman → turkuaz → koyu lacivert; L tek yönlü azalır).
 *  Bölge: renk körü testinden geçmiş kategorik sıra (validate_palette: ΔE ≥ 8 CVD, ≥ 15 normal). Durum: ayrı, simge+etiketle. */
export type Rgb = [number, number, number]
export const INDEX_STOPS: [number, Rgb][] = [
  [0, [243, 233, 190]],
  [0.25, [200, 207, 154]],
  [0.5, [120, 175, 160]],
  [0.75, [53, 127, 156]],
  [1, [18, 58, 102]],
]
export const INDEX_CSS = 'linear-gradient(90deg,#f3e9be,#c8cf9a,#78afa0,#357f9c,#123a66)'

export function rampColor(t: number): Rgb {
  const v = Math.min(1, Math.max(0, t))
  for (let i = 1; i < INDEX_STOPS.length; i++) {
    const [x1, c1] = INDEX_STOPS[i]
    if (v <= x1) {
      const [x0, c0] = INDEX_STOPS[i - 1]
      const f = (v - x0) / (x1 - x0 || 1)
      return [0, 1, 2].map((k) => Math.round(c0[k] + (c1[k] - c0[k]) * f)) as Rgb
    }
  }
  return INDEX_STOPS[INDEX_STOPS.length - 1][1]
}
export const rampCss = (t: number): string => `rgb(${rampColor(t).join(',')})`

/** Bölge sınıfı (1 = en zayıf) → renk. */
export const ZONE_HEX = ['#eb6834', '#2a78d6', '#eda100', '#1baf7a', '#6250d6']
export const STATUS = {
  iyi: { color: '#008300', label: 'İyi', mark: '●' },
  izle: { color: '#b87a00', label: 'İzle', mark: '▲' },
  dikkat: { color: '#d1302f', label: 'Dikkat', mark: '◆' },
  veri_yok: { color: '#6f7376', label: 'Veri yok', mark: '○' },
} as const
export type StatusKey = keyof typeof STATUS
export const statusOf = (s: string | undefined): (typeof STATUS)[StatusKey] => STATUS[(s as StatusKey) in STATUS ? (s as StatusKey) : 'veri_yok']
