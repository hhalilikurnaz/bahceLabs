import { SprayCan } from 'lucide-react'
import { Card } from '@/components/ui'
import type { WeatherDay } from '../../api/weatherApi'
import { formatDayMonth, shiftDays, todayIstanbul, weekdayName } from '../../lib/dates'
import { formatMm, formatPercent, formatTemp, formatWind } from '../../lib/weather'
import { WeatherIcon } from './WeatherIcon'

function dayLabel(iso: string, today: string): string {
  if (iso === today) return 'Bugün'
  return iso === shiftDays(today, 1) ? 'Yarın' : weekdayName(iso)
}

const TH = 'px-1 py-1.5 @sm:px-2 text-left text-caption font-semibold text-app-text-dim'
const TD = 'tabular whitespace-nowrap px-1 py-2 align-middle @sm:px-2'

/**
 * 7 günlük tahmin tablosu: gün | ikon | en yüksek/en düşük | yağış mm | yağış olasılığı % | rüzgâr km/s.
 * Dar kartta önce rüzgâr, sonra olasılık sütunu gizlenir (sözcükler bölünmez). İlaçlama aralığı satırın altında çip.
 */
export function DailyForecast({ days }: { days: WeatherDay[] }) {
  const today = todayIstanbul()
  return (
    <Card aria-label="7 günlük tahmin" data-testid="daily-forecast" className="@container p-3">
      <h3 className="mb-1 px-1 font-display text-h2 text-app-text">7 günlük tahmin</h3>
      <table className="w-full border-collapse text-small @sm:text-body">
        <thead>
          <tr className="border-b border-app-border">
            <th scope="col" className={TH}>Gün</th>
            <th scope="col" className={`${TH} hidden @sm:table-cell`}><span className="sr-only">Durum</span></th>
            <th scope="col" className={TH}>Yük./düş.</th>
            <th scope="col" className={TH}>Yağış mm</th>
            <th scope="col" className={`${TH} hidden @sm:table-cell`}>Olasılık %</th>
            <th scope="col" className={`${TH} hidden @md:table-cell`}>Rüzgâr km/s</th>
          </tr>
        </thead>
        <tbody>
          {days.map((day) => {
            const window = day.ilaclama.enIyiAralik
            return (
              <tr key={day.tarih} className="border-b border-app-border last:border-b-0" data-testid="forecast-day">
                <th scope="row" className={`${TD} text-left font-normal`}>
                  <span className="flex items-center gap-1 font-semibold text-app-text">
                    {dayLabel(day.tarih, today)}
                    <WeatherIcon name={day.ikon} className="h-5 w-5 text-app-accent @sm:hidden" strokeWidth={1.5} aria-label={day.aciklama} role="img" />
                  </span>
                  <span className="block text-caption text-app-text-dim">{formatDayMonth(day.tarih)}</span>
                  <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-app-text/6 px-2 py-0.5 text-caption text-app-text-muted" data-testid="spray-chip">
                    <SprayCan className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    {window ? (
                      <>
                        <span className="hidden @sm:inline">İlaçlama:</span>
                        <span className="sr-only @sm:hidden">İlaçlama:</span>
                        <i className="spray-ok h-2.5 w-2.5 rounded-sm" aria-hidden />
                        <strong className="text-app-text">{window[0]}–{window[1]}</strong>
                      </>
                    ) : (
                      <>
                        <span className="hidden @sm:inline">İlaçlama: uygun saat yok</span>
                        <span className="@sm:hidden">Uygun saat yok</span>
                      </>
                    )}
                  </span>
                </th>
                <td className={`${TD} hidden @sm:table-cell`}>
                  <WeatherIcon name={day.ikon} className="h-7 w-7 text-app-accent" strokeWidth={1.5} aria-label={day.aciklama} role="img" />
                </td>
                <td className={`${TD} text-app-text`}>
                  <span className="font-semibold">{formatTemp(day.max)}</span>
                  <span className="text-app-text-dim"> / {formatTemp(day.min)}</span>
                </td>
                <td className={`${TD} text-app-text-muted`}>
                  {formatMm(day.yagisMm)}
                  <span className="block text-caption text-app-text-dim @sm:hidden">{formatPercent(day.yagisOlasiligi)} olasılık</span>
                </td>
                <td className={`${TD} hidden text-app-text-muted @sm:table-cell`}>{formatPercent(day.yagisOlasiligi)}</td>
                <td className={`${TD} hidden text-app-text-muted @md:table-cell`}>{formatWind(day.ruzgarMax)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </Card>
  )
}
