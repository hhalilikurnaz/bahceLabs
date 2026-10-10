import { Droplets, Wind, WifiOff } from 'lucide-react'
import type { Weather } from '../../api/weatherApi'
import { formatClockIstanbul, timeAgo } from '../../lib/dates'
import { formatMm, formatTemp, formatWind, windDirection } from '../../lib/weather'
import { WeatherIcon } from './WeatherIcon'

/** Şu anki hava durumu + veri tazeliği (internet yoksa son önbellek uyarısı). */
export function CurrentCard({ weather }: { weather: Weather }) {
  const { simdi, onbellekten, ornekVeri, guncelleme } = weather
  const direction = windDirection(simdi.yon)

  return (
    <section className="rounded-2xl bg-app-card p-3.5" aria-label="Şu anki hava durumu">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-app-text-dim">Şu an</p>
          <p className="mt-0.5 text-[34px] font-semibold leading-none text-app-text" data-testid="current-temp">
            {formatTemp(simdi.sicaklik)}
            <span className="ml-0.5 text-[16px] font-medium text-app-text-muted">C</span>
          </p>
          <p className="mt-1.5 text-[13px] text-app-text">{simdi.aciklama}</p>
          {simdi.hissedilen != null && (
            <p className="text-[12px] text-app-text-muted">Hissedilen {formatTemp(simdi.hissedilen)}</p>
          )}
        </div>
        <WeatherIcon name={simdi.ikon} className="h-14 w-14 text-app-accent" strokeWidth={1.25} aria-hidden />
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 text-[12px]">
        <div className="rounded-xl bg-app-bg/50 px-2.5 py-2">
          <dt className="flex items-center gap-1 text-app-text-dim">
            <Wind className="h-3.5 w-3.5" aria-hidden /> Rüzgâr
          </dt>
          <dd className="mt-0.5 font-medium text-app-text">{formatWind(simdi.ruzgar)}</dd>
          <dd className="text-[11px] text-app-text-dim">
            {simdi.hamle != null ? `hamle ${formatWind(simdi.hamle)}` : ''}
            {direction ? ` · ${direction}` : ''}
          </dd>
        </div>
        <div className="rounded-xl bg-app-bg/50 px-2.5 py-2">
          <dt className="flex items-center gap-1 text-app-text-dim">
            <Droplets className="h-3.5 w-3.5" aria-hidden /> Nem
          </dt>
          <dd className="mt-0.5 font-medium text-app-text">{simdi.nem != null ? `%${Math.round(simdi.nem)}` : '—'}</dd>
        </div>
        <div className="rounded-xl bg-app-bg/50 px-2.5 py-2">
          <dt className="text-app-text-dim">Yağış</dt>
          <dd className="mt-0.5 font-medium text-app-text">{formatMm(simdi.yagis)}</dd>
        </div>
      </dl>

      <p className="mt-3 text-[11px] text-app-text-dim" data-testid="weather-updated">
        {ornekVeri
          ? 'Örnek veri (ağsız demo) — internet olduğunda gerçek veriyle değişir.'
          : `Son güncelleme ${formatClockIstanbul(guncelleme)} · ${timeAgo(guncelleme) ?? ''}`}
      </p>
      {onbellekten && (
        <p
          role="status"
          className="mt-2 flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-[12px] leading-snug text-amber-200"
        >
          <WifiOff className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          Hava servisine ulaşılamıyor; son kaydedilen veri gösteriliyor ({formatClockIstanbul(guncelleme)}).
        </p>
      )}
    </section>
  )
}
