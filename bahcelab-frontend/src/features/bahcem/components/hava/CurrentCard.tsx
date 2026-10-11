import { Droplets, Wind, WifiOff } from 'lucide-react'
import { Card } from '@/components/ui'
import type { Weather } from '../../api/weatherApi'
import { formatClockIstanbul, timeAgo } from '../../lib/dates'
import { formatMm, formatTemp, formatWind, windDirection } from '../../lib/weather'
import { WeatherIcon } from './WeatherIcon'

/** Şu anki hava durumu + veri tazeliği (internet yoksa son önbellek uyarısı). */
export function CurrentCard({ weather }: { weather: Weather }) {
  const { simdi, onbellekten, guncelleme } = weather
  const direction = windDirection(simdi.yon)

  return (
    <Card aria-label="Şu anki hava durumu" data-testid="current-weather">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-caption font-semibold uppercase tracking-wide text-app-text-dim">Şu an</p>
          <p className="tabular font-display text-metric text-app-text" data-testid="current-temp">
            {formatTemp(simdi.sicaklik)}
            <span className="ml-0.5 text-lead font-medium text-app-text-muted">C</span>
          </p>
          <p className="text-body text-app-text">{simdi.aciklama}</p>
          {simdi.hissedilen != null && <p className="text-small text-app-text-muted">Hissedilen {formatTemp(simdi.hissedilen)}</p>}
        </div>
        <WeatherIcon name={simdi.ikon} className="h-16 w-16 text-app-accent" strokeWidth={1.25} aria-hidden />
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 text-small">
        <div className="rounded-md bg-app-text/5 px-3 py-2">
          <dt className="flex items-center gap-1 text-app-text-dim">
            <Wind className="h-4 w-4" aria-hidden /> Rüzgâr
          </dt>
          <dd className="mt-0.5 font-semibold text-app-text">{formatWind(simdi.ruzgar)}</dd>
          {simdi.hamle != null && <dd className="text-caption text-app-text-dim">hamle {formatWind(simdi.hamle).replace(' km/s', '')}</dd>}
        </div>
        <div className="rounded-md bg-app-text/5 px-3 py-2">
          <dt className="flex items-center gap-1 text-app-text-dim">
            <Droplets className="h-4 w-4" aria-hidden /> Nem
          </dt>
          <dd className="mt-0.5 font-semibold text-app-text">{simdi.nem != null ? `%${Math.round(simdi.nem)}` : '—'}</dd>
        </div>
        <div className="rounded-md bg-app-text/5 px-3 py-2">
          <dt className="text-app-text-dim">Yağış (şu an)</dt>
          <dd className="mt-0.5 font-semibold text-app-text">{formatMm(simdi.yagis)}</dd>
        </div>
      </dl>
      {direction && <p className="mt-2 text-caption text-app-text-dim">Rüzgâr {direction} yönünden esiyor.</p>}

      <p className="mt-3 text-caption text-app-text-dim" data-testid="weather-updated">
        Son güncelleme {formatClockIstanbul(guncelleme)} · {timeAgo(guncelleme) ?? ''}
      </p>
      {onbellekten && (
        <p role="status" className="mt-2 flex items-start gap-2 rounded-md border border-app-warn/40 bg-app-warn/8 px-3 py-2 text-small text-app-warn">
          <WifiOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          Hava servisine ulaşılamıyor; son kaydedilen veri gösteriliyor ({formatClockIstanbul(guncelleme)}).
        </p>
      )}
    </Card>
  )
}
