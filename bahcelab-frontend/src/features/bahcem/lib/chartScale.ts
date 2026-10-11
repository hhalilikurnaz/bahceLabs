/** Grafik ekseni için SAF yardımcılar: dolgulu otomatik Y aralığı ve "yuvarlak" çentikler. */

export interface Domain {
  min: number
  max: number
}

/** Değerlerin aralığını `padShare` kadar genişletir; hepsi aynıysa `minSpan` kadar açar. Boşsa varsayılanı verir. */
export function paddedDomain(values: readonly number[], padShare: number, minSpan: number, fallback: Domain): Domain {
  const finite = values.filter(Number.isFinite)
  if (finite.length === 0) return fallback
  const lo = Math.min(...finite)
  const hi = Math.max(...finite)
  const span = Math.max(hi - lo, minSpan)
  const mid = (hi + lo) / 2
  const pad = span * padShare
  return { min: mid - span / 2 - pad, max: mid + span / 2 + pad }
}

/** [min, max] içinde yaklaşık `count` adet 1-2-5 adımlı çentik. */
export function niceTicks(domain: Domain, count: number): number[] {
  const span = domain.max - domain.min
  if (!(span > 0) || count < 2) return [domain.min]
  const raw = span / (count - 1)
  const pow = 10 ** Math.floor(Math.log10(raw))
  const step = ([1, 2, 5, 10].find((m) => m * pow >= raw) ?? 10) * pow
  const first = Math.ceil(domain.min / step) * step
  const ticks: number[] = []
  for (let v = first; v <= domain.max + step * 1e-9; v += step) ticks.push(Number(v.toFixed(10)))
  return ticks
}

/** Alan genişliğine göre kaç ayın etiketleneceği: 12 etiket sığmıyorsa ikişer ay atlanır (kesilmez). */
export function monthLabelStep(widthPx: number, labelPx: number): 1 | 2 | 3 | 4 {
  const per = widthPx / 12
  if (per >= labelPx) return 1
  if (per * 2 >= labelPx) return 2
  return per * 3 >= labelPx ? 3 : 4
}
