/** Bildirim yardımcıları (SAF). */
import type { AppNotification } from '../api/notificationsApi'

/** Rozet metni: 0 → boş, 99'dan fazlası "99+". */
export const badgeText = (count: number): string => (count <= 0 ? '' : count > 99 ? '99+' : String(count))

/**
 * Toast gösterilecek yeni KRİTİK bildirimler: okunmamış, kritik ve daha önce görülmemiş olanlar.
 * `seen` ilk yüklemede mevcut bildirimlerle doldurulur (sayfa açılınca eski bildirimler toast olmaz).
 */
export function newCritical(items: readonly AppNotification[], seen: ReadonlySet<string>): AppNotification[] {
  return items.filter((n) => !n.okundu && n.oncelik === 'kritik' && !n.sistem && !seen.has(n.id))
}

/** Aynı anda birden çok yeni kritik bildirim varsa tek toast: ilk başlık + "ve N bildirim daha". */
export function toastText(items: readonly AppNotification[]): string {
  if (items.length === 0) return ''
  const [first, ...rest] = items
  return rest.length === 0 ? first.baslik : `${first.baslik} ve ${rest.length} bildirim daha`
}
