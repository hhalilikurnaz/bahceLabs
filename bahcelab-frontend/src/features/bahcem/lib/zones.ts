import type { IndexId } from './indices'
import { INDEX_DEFS } from './indices'

export type Severity = 'yuksek' | 'orta' | 'dusuk'

/** Bölge ortalaması, bahçe medyanının eşiğin kaç katı altındaysa o kadar şiddetli sayılır. */
const SEVERITY_RATIO = { yuksek: 2, orta: 1.5 } as const

/**
 * Sorunlu bölgenin şiddeti: bahçe medyanı ile bölge ortalaması arasındaki fark, o parametrenin sorun eşiğiyle
 * (backend `indices.py` ile aynı) kıyaslanır. Bölge zaten eşiğin altında olduğundan en düşük sınıf "düşük"tür.
 */
export function zoneSeverity(indeks: IndexId, zoneMean: number | null, gardenMedian: number): Severity {
  if (zoneMean === null) return 'dusuk'
  const ratio = (gardenMedian - zoneMean) / INDEX_DEFS[indeks].sorunEsigi
  if (ratio >= SEVERITY_RATIO.yuksek) return 'yuksek'
  if (ratio >= SEVERITY_RATIO.orta) return 'orta'
  return 'dusuk'
}

export const SEVERITY_LABEL: Record<Severity, string> = { yuksek: 'Yüksek', orta: 'Orta', dusuk: 'Düşük' }
export const SEVERITY_ORDER: Record<Severity, number> = { yuksek: 0, orta: 1, dusuk: 2 }
