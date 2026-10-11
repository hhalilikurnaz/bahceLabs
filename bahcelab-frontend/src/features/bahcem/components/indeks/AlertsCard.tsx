import { TriangleAlert } from 'lucide-react'
import { Badge, Button, cx } from '@/components/ui'
import type { Alert } from '../../api/indeksApi'
import { INDEX_DEFS } from '../../lib/indices'
import { useBahcemStore } from '../../stores/bahcemStore'

/** Uydu uyarıları; aynı bölgede birden fazla parametre düşüyorsa öncelikli (kırmızı) gösterilir. */
export function AlertsCard({ alerts }: { alerts: Alert[] }) {
  const setSelectedDate = useBahcemStore((s) => s.setSelectedDate)
  const setKatman = useBahcemStore((s) => s.setKatman)
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
              {target && (
                <Button
                  className="mt-2 -ml-2"
                  variant="ghost"
                  onClick={() => {
                    setKatman(target)
                    setSelectedDate(alert.sonTarih)
                  }}
                >
                  {INDEX_DEFS[target].ad} görüntüsünü haritada göster
                </Button>
              )}
            </div>
          </div>
        )
      })}
    </section>
  )
}
