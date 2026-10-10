/**
 * Tüm ekranlarda tarih gösterimi için TEK kaynak.
 *
 * Tarihler API'den "YYYY-MM-DD" metni olarak gelir ve hiçbir zaman `Date` nesnesine çevrilip
 * yerel saat dilimiyle yeniden yorumlanmaz (saat dilimi kayması yanlış gün/yıl gösterebilir).
 * Gün/ay/yıl doğrudan metinden okunur; gün aritmetiği UTC'de yapılır.
 */

export const MONTHS_SHORT = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']

export const WEEKDAYS = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi']
export const WEEKDAYS_SHORT = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt']

export interface IsoDate {
  year: number
  month: number // 1–12
  day: number
}

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/

export function parseIso(iso: string): IsoDate {
  const match = ISO.exec(iso)
  if (!match) throw new Error(`Geçersiz tarih: ${iso}`)
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) }
}

export const yearOf = (iso: string): number => parseIso(iso).year

/** "2026-10-09" → "9 Eki" (yıl gerekmeyen dar alanlar için; belirsizlik varsa formatDate kullanın) */
export function formatDayMonth(iso: string): string {
  const { month, day } = parseIso(iso)
  return `${day} ${MONTHS_SHORT[month - 1]}`
}

/** "2026-10-09" → "9 Eki 2026" (varsayılan gösterim) */
export function formatDate(iso: string): string {
  return `${formatDayMonth(iso)} ${parseIso(iso).year}`
}

const toUtcMs = (iso: string): number => {
  const { year, month, day } = parseIso(iso)
  return Date.UTC(year, month - 1, day)
}

const fromUtcMs = (ms: number): string => {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

/** Tarihe gün ekler/çıkarır ("2026-03-01", -1 → "2026-02-28") */
export const shiftDays = (iso: string, days: number): string => fromUtcMs(toUtcMs(iso) + days * 86_400_000)

/** b − a gün olarak */
export const daysBetween = (a: string, b: string): number => Math.round((toUtcMs(b) - toUtcMs(a)) / 86_400_000)

/** Yılın kaçıncı günü (1–366) */
export const dayOfYear = (iso: string): number => {
  const { year } = parseIso(iso)
  return daysBetween(`${year}-01-01`, iso) + 1
}

export const daysInYear = (year: number): number => daysBetween(`${year}-01-01`, `${year + 1}-01-01`)

/** Verilen tarihe en yakın tarihi listeden seçer; `maxDays` aşılırsa null */
export function nearestDate(target: string, candidates: string[], maxDays: number): string | null {
  let best: string | null = null
  let bestDistance = Infinity
  for (const candidate of candidates) {
    const distance = Math.abs(daysBetween(target, candidate))
    if (distance < bestDistance) {
      best = candidate
      bestDistance = distance
    }
  }
  return best !== null && bestDistance <= maxDays ? best : null
}

/** "3 saat önce" gibi göreli süre (ISO zaman damgası) */
export function timeAgo(iso: string | null, now = Date.now()): string | null {
  if (!iso) return null
  const minutes = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000))
  if (minutes < 1) return 'az önce'
  if (minutes < 60) return `${minutes} dk önce`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} saat önce`
  return `${Math.round(hours / 24)} gün önce`
}

/** Haftanın günü (0 = Pazar) — saat dilimine bakmadan metinden hesaplanır */
export function weekdayIndex(iso: string): number {
  const { year, month, day } = parseIso(iso)
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay()
}

/** "2026-10-12" → "Pzt" ya da "Pazartesi" */
export const weekdayName = (iso: string, short = true): string => (short ? WEEKDAYS_SHORT : WEEKDAYS)[weekdayIndex(iso)]

/** "2026-10-12T14:00" → "14:00" */
export const formatHour = (moment: string): string => moment.slice(11, 16)

/** Zaman damgasını (UTC ISO) Europe/Istanbul saatine göre "14:35" yazar */
export function formatClockIstanbul(iso: string): string {
  return new Date(iso).toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' })
}

/** Bugünün tarihi, Europe/Istanbul takvimine göre ("YYYY-MM-DD") */
export function todayIstanbul(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}
