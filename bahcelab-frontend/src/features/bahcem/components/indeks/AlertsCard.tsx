import { TriangleAlert } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge, cx } from '@/components/ui'
import type { Alert } from '../../api/indeksApi'
import { INDEX_DEFS } from '../../lib/indices'
import { archivePath } from '../../lib/archive'
import { useBahcemRoute } from '../../hooks/useBahcemRoute'

/** Uydu uyarıları; aynı bölgede birden fazla parametre düşüyorsa öncelikli (kırmızı) gösterilir. */
export function AlertsCard({ alerts }: { alerts: Alert[] }) {
  const { gardenId } = useBahcemRoute()
  if (alerts.length === 0) return null

  return (
    <section className="space-y-2" aria-label="Uydu uyarıları">
      {alerts.map((alert, i) => {
        const high = alert.oncelik === 'yuksek'
        const target = alert.indeks ?? alert.indeksler[0] ?? null
        return (
          <div
            key={`${alert.tur}-${alert.indeks ?? 'coklu'}-${i}`}
            role="alert"
            data-priority={alert.oncelik}
            className={cx(
              'flex items-start gap-3 rounded-md border p-3.5',
              high ? 'border-app-danger/40 bg-app-danger/8' : 'border-app-warn/40 bg-app-warn/8',
            )}
          >
            <TriangleAlert className={cx('mt-0.5 h-5 w-5 shrink-0', high ? 'text-app-danger' : 'text-app-warn')} aria-hidden />
            <div className="min-w-0">
              <p className={cx('flex flex-wrap items-center gap-2 text-body font-semibold', high ? 'text-app-danger' : 'text-app-warn')}>
                {alert.baslik}
                {high && <Badge tone="danger">Öncelikli</Badge>}
              </p>
              <p className="mt-1 text-small text-app-text-muted">{alert.mesaj}</p>
              {target && gardenId && (
                <Link
                  className="mt-1 inline-flex min-h-11 items-center text-small font-semibold text-app-accent underline-offset-2 hover:underline"
                  to={archivePath(gardenId, { parametre: target, tarih: alert.sonTarih })}
                >
                  {INDEX_DEFS[target].ad} görüntüsünü arşivde aç
                </Link>
              )}
            </div>
          </div>
        )
      })}
    </section>
  )
}
