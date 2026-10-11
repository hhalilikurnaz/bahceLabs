/** İlaçlama zamanı özeti (SAF): haftanın en iyi aralığı ve yoksa nedeni. */
import { shiftDays, weekdayName } from './dates'

export interface SprayDay {
  tarih: string
  uygunSaat: number
  /** ["06:00", "10:00"] ya da null */
  enIyiAralik: [string, string] | null
}

export interface SprayHour {
  ilaclama: 'uygun' | 'sinirda' | 'uygun_degil'
  nedenler: string[]
}

export interface BestSpray {
  tarih: string
  gun: string
  aralik: [string, string]
}

/** Gün etiketi: "Bugün", "Yarın", ardından hafta günü adı. */
export function dayLabel(iso: string, today: string): string {
  if (iso === today) return 'Bugün'
  return iso === shiftDays(today, 1) ? 'Yarın' : weekdayName(iso, false)
}

/** En çok uygun saati olan günün aralığı (eşitlikte en erken gün). Aralığı olan gün yoksa null. */
export function bestSprayTime(days: readonly SprayDay[], today: string): BestSpray | null {
  let best: SprayDay | null = null
  for (const day of days) {
    if (!day.enIyiAralik || day.tarih < today) continue
    if (!best || day.uygunSaat > best.uygunSaat) best = day
  }
  return best && best.enIyiAralik ? { tarih: best.tarih, gun: dayLabel(best.tarih, today), aralik: best.enIyiAralik } : null
}

/** Uygun saat yokken neden: uygun olmayan saatlerin en sık görülen nedeni (veri yoksa genel cümle). */
export function noSprayReason(hours: readonly SprayHour[]): string {
  const counts = new Map<string, number>()
  for (const hour of hours) {
    if (hour.ilaclama !== 'uygun_degil') continue
    for (const reason of hour.nedenler) counts.set(reason, (counts.get(reason) ?? 0) + 1)
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'tr'))[0]
  return top ? top[0] : 'Önümüzdeki günlerin tahmininde uygun gündüz saati bulunamadı.'
}
