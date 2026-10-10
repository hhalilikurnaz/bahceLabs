import { useMemo, useState } from 'react'
import type { WeatherHour } from '../../api/weatherApi'
import { formatHour, todayIstanbul, weekdayName } from '../../lib/dates'
import { SPRAY_CLASS, SPRAY_LABEL } from '../../lib/weather'

const LEGEND = [
  ['uygun', 'Uygun'],
  ['sinirda', 'Sınırda'],
  ['uygun_degil', 'Uygun değil'],
] as const

interface Cell {
  hour: WeatherHour
  past: boolean
}

/** İlaçlama penceresi: her gün için 24 saatlik renkli bar. Üzerine gelince/dokununca o saatin nedeni görünür. */
export function SprayStrip({ hours, nowLocal }: { hours: WeatherHour[]; nowLocal: string }) {
  const days = useMemo(() => {
    const byDay = new Map<string, Cell[]>()
    for (const hour of hours) {
      const day = hour.zaman.slice(0, 10)
      byDay.set(day, [...(byDay.get(day) ?? []), { hour, past: hour.zaman.slice(0, 13) < nowLocal.slice(0, 13) }])
    }
    return [...byDay.entries()]
  }, [hours, nowLocal])

  const [picked, setPicked] = useState<WeatherHour | null>(null)
  const today = todayIstanbul()
  const current = hours.find((h) => h.zaman.slice(0, 13) === nowLocal.slice(0, 13)) ?? hours[0]
  const shown = picked ?? current

  return (
    <section className="rounded-2xl bg-app-card p-3.5" aria-label="İlaçlama penceresi">
      <h3 className="text-[13px] font-semibold text-app-text">İlaçlama penceresi</h3>
      <p className="mt-0.5 text-[11px] leading-snug text-app-text-muted">
        Rüzgâr 15 km/s ve hamle 25 km/s altı, yağış yok, sonraki 6 saatte yağış olasılığı %30 altı, sıcaklık 10–28 °C.
      </p>

      <div className="mt-3 space-y-1" onPointerLeave={() => setPicked(null)}>
        {days.map(([day, cells]) => (
          <div key={day} className="flex items-center gap-2" data-testid="spray-row">
            <span className="w-8 shrink-0 text-[11px] text-app-text-muted">{day === today ? 'Bugün' : weekdayName(day)}</span>
            <div className="flex h-4 flex-1 gap-px overflow-hidden rounded" role="group" aria-label={`${day} saatlik ilaçlama uygunluğu`}>
              {cells.map(({ hour, past }) => (
                <button
                  key={hour.zaman}
                  type="button"
                  data-status={hour.ilaclama}
                  aria-label={`${formatHour(hour.zaman)} ${SPRAY_LABEL[hour.ilaclama]}: ${hour.nedenler.join(' ')}`}
                  title={`${formatHour(hour.zaman)} · ${SPRAY_LABEL[hour.ilaclama]}\n${hour.nedenler.join('\n')}`}
                  onPointerEnter={() => setPicked(hour)}
                  onFocus={() => setPicked(hour)}
                  onClick={() => setPicked(hour)}
                  className={`h-full min-w-0 flex-1 transition-opacity focus-visible:outline-2 focus-visible:outline-white ${SPRAY_CLASS[hour.ilaclama]} ${
                    past ? 'opacity-35' : 'opacity-90 hover:opacity-100'
                  }`}
                />
              ))}
            </div>
          </div>
        ))}
        <div className="grid grid-cols-4 pl-10 text-[9px] text-app-text-dim" aria-hidden>
          {['00', '06', '12', '18'].map((h) => (
            <span key={h}>{h}:00</span>
          ))}
        </div>
      </div>

      <div className="mt-2 min-h-[3.25rem] rounded-xl bg-app-bg/50 px-3 py-2 text-[12px]" aria-live="polite" data-testid="spray-info">
        {shown && (
          <>
            <p className="flex items-center gap-2 font-medium text-app-text">
              <i className={`h-2.5 w-2.5 rounded-sm ${SPRAY_CLASS[shown.ilaclama]}`} aria-hidden />
              {weekdayName(shown.zaman.slice(0, 10))} {formatHour(shown.zaman)} · {SPRAY_LABEL[shown.ilaclama]}
            </p>
            <p className="mt-0.5 leading-snug text-app-text-muted">{shown.nedenler.join(' ')}</p>
          </>
        )}
      </div>

      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-app-text-muted">
        {LEGEND.map(([status, label]) => (
          <li key={status} className="flex items-center gap-1.5">
            <i className={`h-2.5 w-2.5 rounded-sm ${SPRAY_CLASS[status]}`} aria-hidden />
            {label}
          </li>
        ))}
        <li className="text-app-text-dim">Soluk: geçmiş saat</li>
      </ul>
    </section>
  )
}
