import { TriangleAlert } from 'lucide-react'
import type { Alert } from '../../api/indeksApi'
import { INDEX_DEFS } from '../../lib/indices'
import { useBahcemStore } from '../../stores/bahcemStore'

/** İndeks bazlı uyarılar; aynı bölgede birden fazla indeks düşüyorsa öncelikli (kırmızı) gösterilir. */
export function AlertsCard({ alerts }: { alerts: Alert[] }) {
  const setSelectedDate = useBahcemStore((s) => s.setSelectedDate)
  const setKatman = useBahcemStore((s) => s.setKatman)
  if (alerts.length === 0) return null

  return (
    <section className="space-y-2" aria-label="Uyarılar">
      {alerts.map((alert, i) => {
        const high = alert.oncelik === 'yuksek'
        const target = alert.indeks ?? alert.indeksler[0] ?? null
        return (
          <div
            key={`${alert.tur}-${alert.indeks ?? 'coklu'}-${i}`}
            role="alert"
            data-priority={alert.oncelik}
            className={`flex items-start gap-2.5 rounded-2xl border p-3.5 ${
              high ? 'border-app-danger/40 bg-app-danger/10' : 'border-app-warn/30 bg-app-warn/10'
            }`}
          >
            <TriangleAlert className={`mt-0.5 h-4 w-4 shrink-0 ${high ? 'text-app-danger' : 'text-app-warn'}`} aria-hidden />
            <div className="min-w-0">
              <p className={`flex flex-wrap items-center gap-2 text-small font-semibold ${high ? 'text-app-danger' : 'text-app-warn'}`}>
                {alert.baslik}
                {high && (
                  <span className="rounded-full bg-app-danger/20 px-2 py-0.5 text-caption font-semibold uppercase tracking-wide text-app-danger">
                    Öncelikli
                  </span>
                )}
              </p>
              <p className="mt-1 text-caption leading-snug text-app-text-muted">{alert.mesaj}</p>
              {target && (
                <button
                  type="button"
                  onClick={() => {
                    setKatman(target)
                    setSelectedDate(alert.sonTarih)
                  }}
                  className={`mt-2 text-caption font-medium underline-offset-2 hover:underline ${high ? 'text-app-danger' : 'text-app-warn'}`}
                >
                  {INDEX_DEFS[target].ad} görüntüsünü haritada göster
                </button>
              )}
            </div>
          </div>
        )
      })}
    </section>
  )
}
