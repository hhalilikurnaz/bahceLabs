/** Ortak zaman ekseni (SAF): sezon ya da özel aralık; grafikler, fenoloji bantları ve imleç aynı eksende çalışır. */
import { MONTHS_SHORT, daysBetween, parseIso, shiftDays } from './dates'

export interface DateRange {
  from: string
  to: string
}

export type PeriodKind = 'bu' | 'gecen' | 'ozel'

export const SEASON_START_MONTH = 10 // su yılı 1 Ekim (sunucu `katalog.yaml: sezon_baslangici` ile aynı)

const pad = (n: number) => String(n).padStart(2, '0')

/** Bugünün ait olduğu sezonun başlangıç yılı (1 Ekim'den önceyse bir önceki yıl). */
export function seasonStartYear(today: string): number {
  const { year, month } = parseIso(today)
  return month >= SEASON_START_MONTH ? year : year - 1
}

/** `year` sezonu: 1 Ekim `year` – 30 Eylül `year + 1` */
export const seasonRange = (year: number): DateRange => ({ from: `${year}-10-01`, to: `${year + 1}-09-30` })

/** Bir tarihi tam `years` yıl kaydırır (29 Şubat → 28 Şubat). */
export function shiftYears(iso: string, years: number): string {
  const { year, month, day } = parseIso(iso)
  const d = month === 2 && day === 29 ? 28 : day
  return `${year + years}-${pad(month)}-${pad(d)}`
}

/** Seçilen dönem türüne göre eksen aralığı. `custom` geçersizse (başlangıç > bitiş) bu sezona düşer. */
export function periodRange(kind: PeriodKind, today: string, custom?: DateRange): DateRange {
  const year = seasonStartYear(today)
  if (kind === 'gecen') return seasonRange(year - 1)
  if (kind === 'ozel' && custom && custom.from <= custom.to) return custom
  return seasonRange(year)
}

/** Bir tarihin eksendeki konumu (0–1); aralık dışı değerler de döner (kırpma çağıranın işidir). */
export function xFraction(date: string, range: DateRange): number {
  const total = daysBetween(range.from, range.to)
  return total <= 0 ? 0 : daysBetween(range.from, date) / total
}

/** 0–1 konumundaki gün (aralık içine sıkıştırılır). */
export function dateAtFraction(fraction: number, range: DateRange): string {
  const total = daysBetween(range.from, range.to)
  return shiftDays(range.from, Math.round(Math.min(1, Math.max(0, fraction)) * total))
}

export interface MonthTick {
  date: string
  label: string
  /** Ocak (ya da aralığın başı) ise yıl da yazılır */
  year: number | null
}

/** Aralık içindeki her ayın 1'i; etiket "Eki", yıl başlangıcında "Oca 2027". */
export function monthTicks(range: DateRange): MonthTick[] {
  const ticks: MonthTick[] = []
  const start = parseIso(range.from)
  let year = start.year
  let month = start.day === 1 ? start.month : start.month === 12 ? 1 : start.month + 1
  if (start.day !== 1 && start.month === 12) year += 1
  for (;;) {
    const date = `${year}-${pad(month)}-01`
    if (date > range.to) break
    ticks.push({ date, label: MONTHS_SHORT[month - 1], year: month === 1 || ticks.length === 0 ? year : null })
    month += 1
    if (month > 12) {
      month = 1
      year += 1
    }
  }
  return ticks
}

export interface Band {
  kod: string
  ad: string
  baslangic: string
  bitis: string
  ozel: boolean
}

/** Bandı eksen aralığına kırpar; kesişim yoksa null. */
export function clipBand(band: Band, range: DateRange): Band | null {
  if (band.bitis < range.from || band.baslangic > range.to) return null
  return { ...band, baslangic: band.baslangic < range.from ? range.from : band.baslangic, bitis: band.bitis > range.to ? range.to : band.bitis }
}

/** Bir tarihe denk gelen fenoloji evresi (yoksa null). */
export const stageAt = (bands: readonly Band[], date: string): Band | null =>
  bands.find((b) => b.baslangic <= date && date <= b.bitis) ?? null

/** Aynı sezonun önceki yıl karşılığındaki tarih: önceki-sezon çizgisi bu kaydırmayla aynı eksene oturur. */
export const sameDayLastYear = (iso: string): string => shiftYears(iso, -1)
