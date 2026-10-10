import { Droplets, SprayCan, Wind } from 'lucide-react'
import type { WeatherDay } from '../../api/weatherApi'
import { formatDayMonth, todayIstanbul, weekdayName } from '../../lib/dates'
import { formatMm, formatPercent, formatTemp, formatWind } from '../../lib/weather'
import { WeatherIcon } from './WeatherIcon'

function dayLabel(iso: string, today: string): string {
  if (iso === today) return 'Bugün'
  const tomorrow = new Date(Date.parse(`${today}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10)
  return iso === tomorrow ? 'Yarın' : weekdayName(iso)
}

/** 7 günlük tahmin: ikon, min/max, yağış (mm ve olasılık), rüzgâr ve o günün en iyi ilaçlama aralığı. */
export function DailyForecast({ days }: { days: WeatherDay[] }) {
  const today = todayIstanbul()
  return (
    <section className="rounded-2xl bg-app-card p-3.5" aria-label="7 günlük tahmin">
      <h3 className="mb-2 text-[13px] font-semibold text-app-text">7 günlük tahmin</h3>
      <ul className="divide-y divide-app-border/60">
        {days.map((day) => {
          const window = day.ilaclama.enIyiAralik
          return (
            <li key={day.tarih} className="py-2" data-testid="forecast-day">
              <div className="grid grid-cols-[2.75rem_1.25rem_3.25rem_1fr_auto] items-center gap-x-1.5 text-[12px]">
                <div>
                  <p className="font-medium text-app-text">{dayLabel(day.tarih, today)}</p>
                  <p className="text-[10px] text-app-text-dim">{formatDayMonth(day.tarih)}</p>
                </div>
                <WeatherIcon name={day.ikon} className="h-5 w-5 text-app-accent" strokeWidth={1.5} aria-label={day.aciklama} role="img" />
                <p className="whitespace-nowrap text-app-text">
                  <span className="font-semibold">{formatTemp(day.max)}</span>
                  <span className="text-app-text-dim"> / {formatTemp(day.min)}</span>
                </p>
                <p className="flex items-center gap-1 whitespace-nowrap text-app-text-muted">
                  <Droplets className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {formatMm(day.yagisMm)}
                  <span className="text-[10px] text-app-text-dim">{formatPercent(day.yagisOlasiligi)}</span>
                </p>
                <p className="flex items-center gap-1 whitespace-nowrap text-[11px] text-app-text-muted">
                  <Wind className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {formatWind(day.ruzgarMax)}
                </p>
              </div>
              <p className="mt-1 flex items-center gap-1.5 pl-[2.75rem] text-[11px] text-app-text-dim">
                <SprayCan className="h-3 w-3" aria-hidden />
                {window ? (
                  <span>
                    En iyi gündüz aralığı{' '}
                    <span className="font-medium text-emerald-300">
                      {window[0]}–{window[1]}
                    </span>
                  </span>
                ) : (
                  <span>İlaçlamaya uygun saat yok</span>
                )}
              </p>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
