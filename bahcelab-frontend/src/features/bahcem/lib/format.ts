/** Tek biçimlendirme noktası (Türkçe): sayı, yüzde, tarih, birim. Arayüzde sayı başka yerde biçimlenmez. */
import { MONTHS_SHORT, parseIso } from './dates'

const nf = (digits: number) => new Intl.NumberFormat('tr-TR', { minimumFractionDigits: digits, maximumFractionDigits: digits })

/** 0,43 */
export const sayi = (v: number | null | undefined, digits = 2): string => (v == null || !Number.isFinite(v) ? '—' : nf(digits).format(v))
/** %72 (0–100 girdisi) */
export const yuzde = (v: number | null | undefined, digits = 0): string => (v == null || !Number.isFinite(v) ? '—' : `%${nf(digits).format(v)}`)
/** +%4,6 / −%4,6 (işaretli değişim) */
export const degisim = (v: number | null | undefined, digits = 1): string =>
  v == null || !Number.isFinite(v) ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : '±'}%${nf(digits).format(Math.abs(v))}`
/** 31,4 °C */
export const sicaklik = (v: number | null | undefined, digits = 1): string => (v == null ? '—' : `${nf(digits).format(v)} °C`)
/** 12,8 mm */
export const mm = (v: number | null | undefined, digits = 1): string => (v == null ? '—' : `${nf(digits).format(v)} mm`)
/** 15,1 da */
export const dekar = (v: number | null | undefined, digits = 1): string => (v == null ? '—' : `${nf(digits).format(v)} da`)
/** 12 Eki (yıl farklıysa «12 Eki 2025») */
export function gunAy(iso: string | null | undefined, withYear: 'auto' | 'always' | 'never' = 'auto', now = new Date()): string {
  if (!iso) return '—'
  const { year, month, day } = parseIso(iso)
  const showYear = withYear === 'always' || (withYear === 'auto' && year !== now.getFullYear())
  return `${day} ${MONTHS_SHORT[month - 1]}${showYear ? ` ${year}` : ''}`
}
/** 10 m · 12 Eki · bulut %3 */
export const kaynakSatiri = (parts: (string | null | undefined)[]): string => parts.filter(Boolean).join(' · ')
