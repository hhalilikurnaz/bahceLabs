import { Flame, ShieldCheck, Snowflake } from 'lucide-react'
import { Badge, Card, cx } from '@/components/ui'
import type { WeatherAlert } from '../../api/weatherApi'
import { formatHour, todayIstanbul } from '../../lib/dates'
import { whenText } from '../../lib/weather'

/** Don ve sıcak uyarıları — uydu uyarılarıyla aynı kart dili; kırmızı önce. `quiet`: uyarı yoksa hiçbir şey göstermez. */
export function WeatherAlertsCard({ alerts, quiet = false }: { alerts: WeatherAlert[]; quiet?: boolean }) {
  const today = todayIstanbul()
  if (alerts.length === 0 && quiet) return null
  if (alerts.length === 0) {
    return (
      <Card className="flex items-start gap-3" aria-label="Hava uyarıları">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-app-success" aria-hidden />
        <p className="text-body text-app-text-muted">Önümüzdeki 7 günde don veya aşırı sıcak beklenmiyor.</p>
      </Card>
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
            className={cx('flex items-start gap-3 rounded-md border p-3.5', high ? 'border-app-danger/40 bg-app-danger/8' : 'border-app-warn/40 bg-app-warn/8')}
          >
            <Icon className={cx('mt-0.5 h-5 w-5 shrink-0', high ? 'text-app-danger' : 'text-app-warn')} aria-hidden />
            <div className="min-w-0">
              <p className={cx('flex flex-wrap items-center gap-2 text-body font-semibold', high ? 'text-app-danger' : 'text-app-warn')}>
                {alert.baslik}
                {high && <Badge tone="danger">Öncelikli</Badge>}
              </p>
              <p className="text-small text-app-text-dim">
                {whenText(alert.baslangic, today)}
                {alert.tur === 'don' ? ` – ${formatHour(alert.bitis)} · yaklaşık ${alert.sureSaat} saat` : ''}
              </p>
              <p className="mt-1 text-small text-app-text-muted">{alert.mesaj}</p>
            </div>
          </div>
        )
      })}
    </section>
  )
}
