import { Droplets, SprayCan, Wind } from 'lucide-react'
import { Card } from '@/components/ui'
import type { WeatherDay } from '../../api/weatherApi'
import { formatDayMonth, shiftDays, todayIstanbul, weekdayName } from '../../lib/dates'
import { formatMm, formatPercent, formatTemp, formatWind } from '../../lib/weather'
import { WeatherIcon } from './WeatherIcon'

function dayLabel(iso: string, today: string): string {
  if (iso === today) return 'Bugün'
  return iso === shiftDays(today, 1) ? 'Yarın' : weekdayName(iso)
}

/** 7 günlük tahmin: ikon, en yüksek/en düşük sıcaklık, yağış (mm ve olasılık, etiketli), rüzgâr, en iyi ilaçlama aralığı. */
export function DailyForecast({ days }: { days: WeatherDay[] }) {
  const today = todayIstanbul()
  return (
    <Card aria-label="7 günlük tahmin" data-testid="daily-forecast">
      <h3 className="mb-1 font-display text-h2 text-app-text">7 günlük tahmin</h3>
      <ul className="divide-y divide-app-border">
        {days.map((day) => {
          const window = day.ilaclama.enIyiAralik
          return (
            <li key={day.tarih} className="py-2.5" data-testid="forecast-day">
              <div className="flex items-center gap-3">
                <div className="w-14 shrink-0">
                  <p className="text-body font-semibold text-app-text">{dayLabel(day.tarih, today)}</p>
                  <p className="text-caption text-app-text-dim">{formatDayMonth(day.tarih)}</p>
                </div>
                <WeatherIcon name={day.ikon} className="h-7 w-7 shrink-0 text-app-accent" strokeWidth={1.5} aria-label={day.aciklama} role="img" />
                <p className="tabular w-20 shrink-0 text-body text-app-text">
                  <span className="font-semibold">{formatTemp(day.max)}</span>
                  <span className="text-app-text-dim"> / {formatTemp(day.min)}</span>
                </p>
                <p className="tabular flex min-w-0 flex-1 items-start gap-1.5 text-small text-app-text-muted">
                  <Droplets className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span>
                    {formatMm(day.yagisMm)}
                    <span className="block text-caption text-app-text-dim">yağış olasılığı {formatPercent(day.yagisOlasiligi)}</span>
                  </span>
                </p>
                <p className="tabular hidden shrink-0 items-center gap-1 text-small text-app-text-muted @xl:flex">
                  <Wind className="h-4 w-4" aria-hidden />
                  {formatWind(day.ruzgarMax)}
                </p>
              </div>
              <p className="mt-1 flex items-center gap-1.5 pl-[4.5rem] text-small text-app-text-muted">
                <SprayCan className="h-4 w-4" aria-hidden />
                {window ? (
                  <span>
                    İlaçlama için en iyi gündüz aralığı{' '}
                    <strong className="tabular text-app-success">
                      {window[0]}–{window[1]}
                    </strong>
                  </span>
                ) : (
                  <span>İlaçlamaya uygun gündüz saati yok</span>
                )}
              </p>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
