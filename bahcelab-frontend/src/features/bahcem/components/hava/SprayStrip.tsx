import { useMemo, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { Card } from '@/components/ui'
import type { WeatherHour } from '../../api/weatherApi'
import { formatHour, todayIstanbul, weekdayName } from '../../lib/dates'
import { SPRAY_CLASS, SPRAY_LABEL, SPRAY_MARK } from '../../lib/weather'

/** Çubukta gösterilen saat aralığı: 06:00–19:00 (gece ilaçlama önerilmez; yalnız lejantta belirtilir) */
const DAY_START = 6
const DAY_END = 19
const AXIS = ['06', '09', '12', '15', '18'] as const

interface Cell {
  hour: WeatherHour
  past: boolean
}

/** Aynı uygunluktaki ardışık saat blokları (doğrudan etiket için) */
function runs(cells: Cell[]): { bas: number; n: number; durum: Cell['hour']['ilaclama'] }[] {
  const r: { bas: number; n: number; durum: Cell['hour']['ilaclama'] }[] = []
  cells.forEach((c, i) => (r.length && r[r.length - 1].durum === c.hour.ilaclama ? (r[r.length - 1].n += 1) : r.push({ bas: i, n: 1, durum: c.hour.ilaclama })))
  return r
}

function DayRow({ day, label, cells, selected, onSelect }: { day: string; label: string; cells: Cell[]; selected: string | null; onSelect: (hour: WeatherHour) => void }) {
  const index = cells.findIndex((c) => c.hour.zaman === selected)

  function fromPointer(event: PointerEvent<HTMLDivElement>) {
    const box = event.currentTarget.getBoundingClientRect()
    const ratio = Math.min(0.999, Math.max(0, (event.clientX - box.left) / box.width))
    onSelect(cells[Math.floor(ratio * cells.length)].hour)
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (step === 0) return
    event.preventDefault()
    // Henüz saat seçilmediyse ilk basış baştan (00:00) başlar
    const next = Math.min(cells.length - 1, Math.max(0, index + step))
    onSelect(cells[next].hour)
  }

  const good = cells.filter((c) => c.hour.ilaclama === 'uygun').length
  return (
    <div className="flex items-center gap-2" data-testid="spray-row">
      <span className="w-[88px] shrink-0 text-small font-semibold text-app-text-muted max-[560px]:w-[78px]">{label}</span>
      <div
        role="group"
        tabIndex={0}
        aria-label={`${day} saatlik ilaçlama uygunluğu: ${good} saat uygun. Saatler arasında gezinmek için sol ve sağ ok tuşlarını kullanın.`}
        onPointerDown={fromPointer}
        onPointerMove={(event) => event.pointerType === 'mouse' && fromPointer(event)}
        onKeyDown={onKeyDown}
        className="relative flex h-11 flex-1 cursor-pointer touch-pan-y gap-px overflow-hidden rounded-sm"
      >
        {cells.map(({ hour, past }) => (
          <span
            key={hour.zaman}
            data-status={hour.ilaclama}
            aria-hidden
            className={`h-full min-w-0 flex-1 ${SPRAY_CLASS[hour.ilaclama]} ${past ? 'opacity-35' : ''} ${hour.zaman === selected ? 'ring-2 ring-inset ring-app-text' : ''}`}
          />
        ))}
        {runs(cells).filter((r) => r.n >= 4).map((r) => (
          <span key={r.bas} data-testid="spray-label" aria-hidden className="pointer-events-none absolute top-1/2 -translate-y-1/2 rounded-[4px] bg-app-card/90 px-1.5 text-caption font-semibold text-app-text" style={{ left: `calc(${((r.bas + r.n / 2) / cells.length) * 100}% )`, transform: 'translate(-50%, -50%)' }}>
            {SPRAY_MARK[r.durum]} {SPRAY_LABEL[r.durum].toLowerCase()}
          </span>
        ))}
      </div>
    </div>
  )
}

/** İlaçlama penceresi: her gün için 06:00–19:00 arası saatlik renkli bar (gece gösterilmez, yalnız lejantta anılır); dokununca/üzerine gelince/ok tuşlarıyla saatin nedeni görünür. */
export function SprayStrip({ hours, nowLocal }: { hours: WeatherHour[]; nowLocal: string }) {
  const days = useMemo(() => {
    const byDay = new Map<string, Cell[]>()
    for (const hour of hours) {
      const day = hour.zaman.slice(0, 10)
      const h = Number(hour.zaman.slice(11, 13))
      if (h < DAY_START || h >= DAY_END) continue
      byDay.set(day, [...(byDay.get(day) ?? []), { hour, past: hour.zaman.slice(0, 13) < nowLocal.slice(0, 13) }])
    }
    return [...byDay.entries()]
  }, [hours, nowLocal])

  const [picked, setPicked] = useState<WeatherHour | null>(null)
  const today = todayIstanbul()
  const current = hours.find((h) => h.zaman.slice(0, 13) === nowLocal.slice(0, 13)) ?? hours[0]
  const shown = picked ?? current

  return (
    <Card aria-label="Saat saat ilaçlama penceresi" data-testid="spray-strip">
      <h3 className="text-lead font-semibold text-app-text">Saat saat ilaçlama</h3>
      <p className="text-small text-app-text-muted">
        Gündüz saatlerinde önerilir. Uygun: rüzgâr 15 km/s ve hamle 25 km/s altı, yağış yok, sonraki 6 saatte yağış olasılığı %30 altı, sıcaklık 10–28 °C.
      </p>

      <div className="mt-3 space-y-1.5">
        {days.map(([day, cells]) => (
          <DayRow
            key={day}
            day={day}
            label={day === today ? 'Bugün' : weekdayName(day, false)}
            cells={cells}
            selected={picked?.zaman ?? null}
            onSelect={setPicked}
          />
        ))}
        <div className="flex justify-between pl-24 text-caption text-app-text-dim max-[560px]:pl-[86px]" aria-hidden>
          {AXIS.map((h) => (
            <span key={h}>{h}:00</span>
          ))}
        </div>
      </div>

      <div className="mt-3 min-h-16 rounded-md bg-app-text/5 px-3 py-2 text-small" aria-live="polite" data-testid="spray-info">
        {shown && (
          <>
            <p className="flex items-center gap-2 font-semibold text-app-text">
              <i className={`h-3 w-3 rounded-sm ${SPRAY_CLASS[shown.ilaclama]}`} aria-hidden />
              {weekdayName(shown.zaman.slice(0, 10))} {formatHour(shown.zaman)} · {SPRAY_MARK[shown.ilaclama]} {SPRAY_LABEL[shown.ilaclama]}
            </p>
            <p className="mt-0.5 text-app-text-muted">{shown.nedenler.join(' ')}</p>
          </>
        )}
      </div>

      <p className="mt-2 text-small text-app-text-dim">Bir saate dokunun ya da ok tuşlarıyla gezinin; nedeni yukarıda yazar. Soluk: geçmiş saatler. Çubuk 06:00–19:00 arasını gösterir; gece ilaçlama önerilmez.</p>
    </Card>
  )
}
