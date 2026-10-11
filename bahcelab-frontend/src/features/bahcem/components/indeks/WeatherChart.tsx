import { useMemo } from 'react'
import type { HistoryDay } from '../../api/weatherApi'
import { useElementWidth } from '../../hooks/useElementWidth'
import { monthLabelStep, niceTicks } from '../../lib/chartScale'
import { dateAtFraction, monthTicks, xFraction, type DateRange } from '../../lib/seasonAxis'
import { CHART } from '../../lib/config'
import { daysBetween, formatDate } from '../../lib/dates'
import { formatMm, formatTemp } from '../../lib/weather'

interface WeatherChartProps {
  days: HistoryDay[]
  /** Eksen aralığı (ortak zaman ekseni) */
  range: DateRange
  loading?: boolean
  /** Paylaşılan imleç konumu (ISO tarih) */
  hoverDoy: string | null
  onHoverDoy: (date: string | null) => void
}

const FONT = { fontFamily: 'var(--font-sans)', fontSize: CHART.fontPx, fontVariantNumeric: 'tabular-nums' } as const

/** Günlük yağış (mm, çubuk — sol eksen) ve sıcaklık (°C, çizgi — sağ eksen). Zaman ekseni ve imleç indeks grafiğiyle ortaktır. */
export function WeatherChart({ days, range, loading = false, hoverDoy, onHoverDoy }: WeatherChartProps) {
  const [ref, width] = useElementWidth<HTMLDivElement>()
  const height = CHART.weatherChartHeightPx
  const m = { left: CHART.margin.left, right: CHART.marginRightCompare, top: 22, bottom: CHART.margin.bottom }
  const plotW = Math.max(40, width - m.left - m.right)
  const plotH = height - m.top - m.bottom

  const data = useMemo(() => days.filter((d) => d.tarih >= range.from && d.tarih <= range.to), [days, range])
  const rainMax = useMemo(() => Math.max(CHART.rainMinAxisMm, ...data.map((d) => d.yagisMm ?? 0)), [data])
  const rainTicks = useMemo(() => niceTicks({ min: 0, max: rainMax }, 3), [rainMax])
  const rainTop = rainTicks[rainTicks.length - 1] ?? rainMax
  const temps = data.flatMap((d) => (d.min != null && d.max != null ? [d.min, d.max] : []))
  const tempDomain = temps.length ? { min: Math.floor(Math.min(...temps) / 5) * 5, max: Math.ceil(Math.max(...temps) / 5) * 5 } : { min: 0, max: 30 }
  const tempTicks = niceTicks(tempDomain, 3)

  const x = (date: string) => m.left + xFraction(date, range) * plotW
  const yRain = (mm: number) => m.top + (1 - mm / rainTop) * plotH
  const yTemp = (t: number) => m.top + (1 - (t - tempDomain.min) / Math.max(1, tempDomain.max - tempDomain.min)) * plotH
  const step = monthLabelStep(plotW, CHART.monthLabelPx)
  const months = monthTicks(range).map((t, i) => ({ label: `${t.label}${t.year ? ` ${t.year}` : ''}`, i, px: x(t.date) })).filter((mo) => mo.i % step === 0)

  const line = data
    .filter((d) => d.min != null && d.max != null)
    .map((d, i) => `${i === 0 ? 'M' : 'L'}${x(d.tarih).toFixed(1)} ${yTemp(((d.min as number) + (d.max as number)) / 2).toFixed(1)}`)
    .join(' ')
  const hovered = hoverDoy === null ? null : data.reduce<HistoryDay | null>((best, d) => (!best || Math.abs(daysBetween(hoverDoy, d.tarih)) < Math.abs(daysBetween(hoverDoy, best.tarih)) ? d : best), null)
  const barW = Math.max(1.5, Math.min(4, plotW / Math.max(1, daysBetween(range.from, range.to))))

  return (
    <div ref={ref} className="relative w-full" data-testid="weather-chart">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Günlük yağış (mm) ve sıcaklık (°C) grafiği" className="block overflow-visible">
        <text x={m.left - 6} y={12} textAnchor="end" style={{ ...FONT, fill: 'var(--color-app-water)', fontWeight: 600 }}>
          mm
        </text>
        <text x={width - m.right + 6} y={12} style={{ ...FONT, fill: 'var(--color-app-warn)', fontWeight: 600 }}>
          °C
        </text>
        {rainTicks.map((t) => (
          <g key={`r${t}`}>
            <line x1={m.left} x2={width - m.right} y1={yRain(t)} y2={yRain(t)} style={{ stroke: 'var(--color-app-border)' }} />
            <text x={m.left - 6} y={yRain(t) + 4} textAnchor="end" style={{ ...FONT, fill: 'var(--color-app-text-dim)' }}>
              {t}
            </text>
          </g>
        ))}
        {tempTicks.map((t) => (
          <text key={`t${t}`} x={width - m.right + 6} y={yTemp(t) + 4} style={{ ...FONT, fill: 'var(--color-app-text-dim)' }}>
            {t}°
          </text>
        ))}
        {months.map((mo) => (
          <text key={mo.label} x={mo.px + 2} y={height - 8} style={{ ...FONT, fill: 'var(--color-app-text-dim)' }}>
            {mo.label}
          </text>
        ))}
        {data.map((d) =>
          d.yagisMm && d.yagisMm > 0 ? (
            <rect key={d.tarih} x={x(d.tarih) - barW / 2} width={barW} y={yRain(Math.min(d.yagisMm, rainTop))} height={yRain(0) - yRain(Math.min(d.yagisMm, rainTop))} rx={0.6} style={{ fill: 'var(--color-app-water)' }} opacity={0.85} />
          ) : null,
        )}
        <path d={line} fill="none" strokeWidth={1.75} strokeLinejoin="round" style={{ stroke: 'var(--color-app-warn)' }} />
        {hoverDoy !== null && <line x1={x(hoverDoy)} x2={x(hoverDoy)} y1={m.top} y2={height - m.bottom} pointerEvents="none" style={{ stroke: 'var(--color-app-text-muted)' }} />}
        <rect x={m.left} y={0} width={plotW} height={height} fill="transparent" onPointerMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); onHoverDoy(dateAtFraction((e.clientX - r.left) / r.width, range)) }} onPointerLeave={() => onHoverDoy(null)} />
        {data.length === 0 && (
          <text x={width / 2} y={height / 2} textAnchor="middle" style={{ ...FONT, fill: 'var(--color-app-text-dim)' }}>
            {loading ? 'Hava verisi yükleniyor…' : 'Bu sezon için hava verisi yok'}
          </text>
        )}
      </svg>
      {hovered && (
        <p className="tabular pointer-events-none mt-1 text-small text-app-text-muted" role="status" data-testid="weather-chart-readout">
          {formatDate(hovered.tarih)} · yağış {hovered.yagisMm != null ? formatMm(hovered.yagisMm) : '—'} · {hovered.min != null && hovered.max != null ? `${formatTemp(hovered.min)} / ${formatTemp(hovered.max)}` : 'sıcaklık yok'}
        </p>
      )}
    </div>
  )
}
