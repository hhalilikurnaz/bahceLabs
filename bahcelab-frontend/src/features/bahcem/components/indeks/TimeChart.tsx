import { useMemo } from 'react'
import type { Scene } from '../../api/indeksApi'
import { CHART } from '../../lib/config'
import { INDEX_DEFS, formatIndexValue, type IndexId } from '../../lib/indices'
import { shiftYears, type Band, type DateRange } from '../../lib/seasonAxis'
import { LineChartPanel, type ChartLine } from './LineChartPanel'

interface TimeChartProps {
  scenes: Scene[]
  indeks: IndexId
  /** Eksen aralığı (sezon, özel aralık ya da takvim yılı) */
  range: DateRange
  /** İkincil parametre: kendi (sağ) ekseniyle çizilir */
  compare?: IndexId | null
  activeDate?: string | null
  onSelect?: (tarih: string) => void
  compact?: boolean
  bands?: Band[]
  seasonMarks?: string[]
  bandNote?: string
  hoverDate: string | null
  onHoverDate: (date: string | null) => void
}

function seriesOf(scenes: Scene[], indeks: IndexId) {
  return scenes
    .filter((s) => s.durum === 'tamam' && s.indeksler[indeks])
    .map((s) => ({ date: s.tarih, value: (s.indeksler[indeks] as NonNullable<Scene['indeksler'][IndexId]>).ortalama }))
}

/** Seçili parametrenin uydu ortalamaları: bu dönem + bir yıl önceki aynı dönem (kesikli) ve isteğe bağlı ikinci parametre. */
export function TimeChart({ scenes, indeks, range, compare = null, activeDate = null, onSelect, compact = false, bands, seasonMarks, bandNote, hoverDate, onHoverDate }: TimeChartProps) {
  const def = INDEX_DEFS[indeks]
  const def2 = compare && compare !== indeks ? INDEX_DEFS[compare] : null
  const lines = useMemo<ChartLine[]>(() => {
    const own = seriesOf(scenes, indeks)
    const result: ChartLine[] = [
      {
        id: 'onceki',
        label: 'Geçen yıl',
        color: def.cizgi,
        points: own.map((p) => ({ date: shiftYears(p.date, 1), value: p.value })),
        dashed: true,
        opacity: 0.7,
        secondary: true,
        dots: true,
        originalDate: (d) => shiftYears(d, -1),
        format: (v) => formatIndexValue(indeks, v),
      },
      { id: 'bu', label: def.ad, color: def.cizgi, points: own, dots: true, format: (v) => formatIndexValue(indeks, v) },
    ]
    if (def2) {
      result.push({ id: 'ikinci', label: def2.ad, color: def2.cizgi, points: seriesOf(scenes, def2.id), axis: 'right', secondary: true, format: (v) => formatIndexValue(def2.id, v) })
    }
    return result
  }, [scenes, indeks, def, def2])

  return (
    <LineChartPanel
      range={range}
      lines={lines}
      bands={bands}
      seasonMarks={seasonMarks}
      bandNote={bandNote}
      leftFormat={(v) => formatIndexValue(indeks, v)}
      rightFormat={def2 ? (v) => formatIndexValue(def2.id, v) : undefined}
      leftDefault={{ min: def.min, max: def.max }}
      rightDefault={def2 ? { min: def2.min, max: def2.max } : undefined}
      minSpan={(def.max - def.min) * CHART.minSpanShare}
      compact={compact}
      hoverDate={hoverDate}
      onHoverDate={onHoverDate}
      activeDate={activeDate}
      onSelectDate={onSelect}
      ariaLabel={`${def.ad} zaman grafiği`}
      emptyText="Bu dönem için görüntü yok"
      testId="time-chart-body"
    />
  )
}
