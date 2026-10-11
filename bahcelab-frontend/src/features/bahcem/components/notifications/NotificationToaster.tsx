import { useEffect, useRef } from 'react'
import { useUnreadPoll } from '../../api/notificationsApi'
import { newCritical, toastText } from '../../lib/notifications'
import { useToast } from '../layout/toastContext'

/**
 * Görünmez: okunmamışları yoklar; yeni (sayfa açıldıktan sonra gelen) kritik bildirim için toast gösterir.
 * İlk yüklemede mevcut bildirimler "görüldü" sayılır, böylece eski bildirimler toast olmaz.
 */
export function NotificationToaster() {
  const { data } = useUnreadPoll()
  const toast = useToast()
  const seen = useRef<Set<string> | null>(null)

  useEffect(() => {
    if (!data) return
    if (seen.current === null) {
      seen.current = new Set(data.ogeler.map((n) => n.id))
      return
    }
    const fresh = newCritical(data.ogeler, seen.current)
    for (const n of data.ogeler) seen.current.add(n.id)
    if (fresh.length > 0) toast.show(toastText(fresh), { tone: 'warn' })
  }, [data, toast])

  return null
}
