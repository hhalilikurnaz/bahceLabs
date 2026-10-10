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
              high ? 'border-app-danger/40 bg-app-danger/10' : 'border-amber-400/30 bg-amber-400/10'
            }`}
          >
            <TriangleAlert className={`mt-0.5 h-4 w-4 shrink-0 ${high ? 'text-app-danger' : 'text-amber-300'}`} aria-hidden />
            <div className="min-w-0">
              <p className={`flex flex-wrap items-center gap-2 text-[13px] font-semibold ${high ? 'text-red-200' : 'text-amber-200'}`}>
                {alert.baslik}
                {high && (
                  <span className="rounded-full bg-app-danger/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-200">
                    Öncelikli
                  </span>
                )}
              </p>
              <p className="mt-1 text-[12px] leading-snug text-app-text-muted">{alert.mesaj}</p>
              {target && (
                <button
                  type="button"
                  onClick={() => {
                    setKatman(target)
                    setSelectedDate(alert.sonTarih)
                  }}
                  className={`mt-2 text-[12px] font-medium underline-offset-2 hover:underline ${high ? 'text-red-200' : 'text-amber-200'}`}
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
