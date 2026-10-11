import { useMemo, type ReactNode } from 'react'
import { Card } from '@/components/ui'
import type { SeriesDay } from '../../api/agroApi'
import { shiftYears, type Band, type DateRange } from '../../lib/seasonAxis'
import { LineChartPanel, type ChartLine } from './LineChartPanel'

interface SeriesChartCardProps {
  title: string
  /** Büyük özet rakam ve altındaki karşılaştırma cümlesi */
  summary: { value: string; unit: string; caption: string } | null
  days: SeriesDay[]
  pick: (day: SeriesDay) => { current: number | null; previous: number | null }
  color: string
  unit: string
  format: (value: number) => string
  range: DateRange
  bands: Band[]
  bandNote?: string
  hoverDate: string | null
  onHoverDate: (date: string | null) => void
  emptyText: string
  note?: ReactNode
  testId: string
}

/** Birikimli seri kartı (yağış mm / GDD): solda grafik (bu sezon + geçen sezon aynı gün), sağda büyük özet rakam. */
export function SeriesChartCard({ title, summary, days, pick, color, unit, format, range, bands, bandNote, hoverDate, onHoverDate, emptyText, note, testId }: SeriesChartCardProps) {
  const lines = useMemo<ChartLine[]>(() => {
    const current = days.flatMap((d) => (pick(d).current === null ? [] : [{ date: d.tarih, value: pick(d).current as number }]))
    const previous = days.flatMap((d) => (pick(d).previous === null ? [] : [{ date: d.tarih, value: pick(d).previous as number }]))
    return [
      { id: 'onceki', label: 'Geçen sezon', color, points: previous, dashed: true, opacity: 0.7, secondary: true, originalDate: (d) => shiftYears(d, -1) },
      { id: 'bu', label: 'Bu sezon', color, points: current },
    ]
  }, [days, pick, color])

  return (
    <Card aria-label={title} className="p-3" data-testid={testId}>
      <h3 className="mb-1 font-display text-h2 text-app-text">{title}</h3>
      <div className="flex gap-3">
        <div className="min-w-0 flex-1">
          <LineChartPanel
            range={range}
            lines={lines}
            bands={bands}
            bandNote={bandNote}
            leftFormat={format}
            leftDefault={{ min: 0, max: 1 }}
            zeroBased
            minSpan={1}
            height={170}
            hoverDate={hoverDate}
            onHoverDate={onHoverDate}
            ariaLabel={`${title} (${unit})`}
            emptyText={emptyText}
          />
        </div>
        <div className="w-24 shrink-0 self-center text-right" data-testid={`${testId}-summary`}>
          {summary ? (
            <>
              <p className="tabular whitespace-nowrap font-display text-display text-app-text">{summary.value}</p>
              <p className="text-small font-semibold text-app-text-muted">{summary.unit}</p>
              <p className="mt-0.5 text-caption text-app-text-muted">{summary.caption}</p>
            </>
          ) : (
            <p className="text-caption text-app-text-dim">Veri yok</p>
          )}
        </div>
      </div>
      {note}
    </Card>
  )
}
