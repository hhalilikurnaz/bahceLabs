import { Flame, ShieldCheck, Snowflake } from 'lucide-react'
import type { WeatherAlert } from '../../api/weatherApi'
import { formatHour, todayIstanbul } from '../../lib/dates'
import { whenText } from '../../lib/weather'

/** Don ve sıcak uyarıları — uydu uyarılarıyla aynı kart dili; kırmızı önce. */
export function WeatherAlertsCard({ alerts }: { alerts: WeatherAlert[] }) {
  const today = todayIstanbul()
  if (alerts.length === 0) {
    return (
      <section className="flex items-start gap-2.5 rounded-2xl bg-app-card p-3.5" aria-label="Hava uyarıları">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-app-accent" aria-hidden />
        <p className="text-caption leading-snug text-app-text-muted">
          Önümüzdeki 7 günde don veya aşırı sıcak beklenmiyor.
        </p>
      </section>
    )
  }

  return (
    <section className="space-y-2" aria-label="Hava uyarıları">
      {alerts.map((alert, i) => {
        const high = alert.seviye === 'kirmizi'
        const Icon = alert.tur === 'don' ? Snowflake : Flame
        return (
          <div
            key={`${alert.tur}-${alert.baslangic}-${i}`}
            role="alert"
            data-priority={alert.seviye}
            data-kind={alert.tur}
            className={`flex items-start gap-2.5 rounded-2xl border p-3.5 ${
              high ? 'border-app-danger/40 bg-app-danger/10' : 'border-app-warn/30 bg-app-warn/10'
            }`}
          >
            <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${high ? 'text-app-danger' : 'text-app-warn'}`} aria-hidden />
            <div className="min-w-0">
              <p className={`flex flex-wrap items-center gap-2 text-small font-semibold ${high ? 'text-app-danger' : 'text-app-warn'}`}>
                {alert.baslik}
                {high && (
                  <span className="rounded-full bg-app-danger/20 px-2 py-0.5 text-caption font-semibold uppercase tracking-wide text-app-danger">
                    Öncelikli
                  </span>
                )}
              </p>
              <p className="mt-0.5 text-caption text-app-text-dim">
                {whenText(alert.baslangic, today)}
                {alert.tur === 'don' ? ` – ${formatHour(alert.bitis)} · yaklaşık ${alert.sureSaat} saat` : ''}
              </p>
              <p className="mt-1 text-caption leading-snug text-app-text-muted">{alert.mesaj}</p>
            </div>
          </div>
        )
      })}
    </section>
  )
}
