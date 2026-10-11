import { useMemo, useState, type KeyboardEvent } from 'react'
import { useElementWidth } from '../../hooks/useElementWidth'
import { monthLabelStep, niceTicks, paddedDomain, type Domain } from '../../lib/chartScale'
import { CHART } from '../../lib/config'
import { daysBetween, formatDate, shiftDays } from '../../lib/dates'
import { clipBand, dateAtFraction, monthTicks, stageAt, xFraction, type Band, type DateRange } from '../../lib/seasonAxis'

export interface ChartPoint {
  date: string
  value: number
}

export interface ChartLine {
  id: string
  label: string
  color: string
  points: ChartPoint[]
  axis?: 'left' | 'right'
  dashed?: boolean
  opacity?: number
  /** Noktalar işaretlenir (seyrek ölçümler: uydu görüntüleri); sürekli günlük seride kapalı */
  dots?: boolean
  /** Tooltip ve seçim için: geçen sezon gibi yardımcı çizgi birincil sayılmaz */
  secondary?: boolean
  /** Tooltip'te gösterilecek asıl tarih (kaydırılmış önceki sezon noktaları için) */
  originalDate?: (date: string) => string
  format?: (value: number) => string
}

interface LineChartPanelProps {
  range: DateRange
  lines: ChartLine[]
  bands?: Band[]
  /** Fenoloji bantlarının arkada doğrulanmamış (ön değer) olduğunu tooltip'te belirtir */
  bandNote?: string
  leftFormat: (value: number) => string
  rightFormat?: (value: number) => string
  leftDefault: Domain
  rightDefault?: Domain
  /** Eksen sıfırdan başlar (birikimli seriler) */
  zeroBased?: boolean
  minSpan: number
  height?: number
  compact?: boolean
  hoverDate: string | null
  onHoverDate: (date: string | null) => void
  activeDate?: string | null
  onSelectDate?: (date: string) => void
  ariaLabel: string
  emptyText: string
  testId?: string
}

const FONT = { fontFamily: 'var(--font-sans)', fontSize: CHART.fontPx, fontVariantNumeric: 'tabular-nums' } as const

function nearest(points: ChartPoint[], date: string, maxGapDays: number): ChartPoint | null {
  let best: ChartPoint | null = null
  let bestGap = maxGapDays + 1
  for (const p of points) {
    const gap = Math.abs(daysBetween(date, p.date))
    if (gap < bestGap) {
      best = p
      bestGap = gap
    }
  }
  return best
}

/**
 * Ortak zaman eksenli çizgi grafiği: aynı aralıkta alt alta dizilen kartlar aynı yatay ölçüyü ve imleci paylaşır.
 * Fenoloji bantları arka plandadır; imlecin altındaki evre ipucu kutusunda adıyla yazılır.
 */
export function LineChartPanel({
  range, lines, bands = [], bandNote, leftFormat, rightFormat, leftDefault, rightDefault, zeroBased = false, minSpan,
  height, compact = false, hoverDate, onHoverDate, activeDate = null, onSelectDate, ariaLabel, emptyText, testId,
}: LineChartPanelProps) {
  const [ref, width] = useElementWidth<HTMLDivElement>()
  const [focused, setFocused] = useState(false)
  const h = height ?? (compact ? CHART.compactHeightPx : CHART.heightPx)
  const base = compact ? CHART.marginCompact : CHART.margin
  const m = { ...base, right: compact ? base.right : CHART.marginRightCompare }
  const plotW = Math.max(40, width - m.left - m.right)
  const plotH = h - m.top - m.bottom

  const left = lines.filter((l) => (l.axis ?? 'left') === 'left')
  const right = lines.filter((l) => l.axis === 'right')
  const domainOf = (set: ChartLine[], fallback: Domain): Domain => {
    const values = set.flatMap((l) => l.points.map((p) => p.value))
    if (zeroBased) return { min: 0, max: Math.max(...values, minSpan) * 1.08 }
    return paddedDomain(values, CHART.yPaddingShare, minSpan, fallback)
  }
  const leftDomain = useMemo(() => domainOf(left, leftDefault), [left, leftDefault, zeroBased, minSpan]) // eslint-disable-line react-hooks/exhaustive-deps
  const rightDomain = useMemo(() => (right.length ? domainOf(right, rightDefault ?? leftDefault) : null), [right, rightDefault, leftDefault, zeroBased, minSpan]) // eslint-disable-line react-hooks/exhaustive-deps
  const leftTicks = useMemo(() => niceTicks(leftDomain, compact ? 3 : CHART.yTicks), [leftDomain, compact])
  const rightTicks = useMemo(() => (rightDomain ? niceTicks(rightDomain, CHART.yTicks) : []), [rightDomain])

  const x = (date: string) => m.left + xFraction(date, range) * plotW
  const yOf = (value: number, domain: Domain) => m.top + (1 - (value - domain.min) / (domain.max - domain.min || 1)) * plotH
  const domainFor = (line: ChartLine) => (line.axis === 'right' && rightDomain ? rightDomain : leftDomain)
  const inRange = (p: ChartPoint) => p.date >= range.from && p.date <= range.to
  const pathOf = (line: ChartLine) =>
    line.points.filter(inRange).map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.date).toFixed(1)} ${yOf(p.value, domainFor(line)).toFixed(1)}`).join(' ')

  const ticks = monthTicks(range)
  const step = monthLabelStep(plotW, CHART.monthLabelPx + (range.to > range.from && ticks.some((t) => t.year) ? 18 : 0))
  const visibleBands = bands.map((b) => clipBand(b, range)).filter((b): b is Band => b !== null)

  const primary = lines.find((l) => !l.secondary) ?? lines[0]
  const hoverPoint = hoverDate && primary ? nearest(primary.points.filter(inRange), hoverDate, CHART.hoverGapDays) : null
  const rows = hoverDate
    ? lines.flatMap((l) => {
        const p = nearest(l.points.filter(inRange), hoverDate, l.dots ? CHART.hoverGapDays : 1)
        return p ? [{ line: l, point: p }] : []
      })
    : []
  const stage = hoverDate ? stageAt(bands, hoverDate) : null
  const empty = lines.every((l) => l.points.filter(inRange).length === 0)
  const hoverX = hoverDate ? x(hoverDate) : 0
  const flip = hoverX + 10 + CHART.tooltipWidthPx > width - 4

  const frac = (clientX: number, el: Element) => {
    const r = el.getBoundingClientRect()
    return (clientX - r.left) / r.width
  }
  const totalDays = Math.max(1, daysBetween(range.from, range.to))
  const keyStep = Math.max(1, Math.round(totalDays / 60))

  function onKey(event: KeyboardEvent<SVGSVGElement>) {
    const current = hoverDate ?? range.to
    if (event.key === 'ArrowLeft') onHoverDate(shiftDays(current, -keyStep) < range.from ? range.from : shiftDays(current, -keyStep))
    else if (event.key === 'ArrowRight') onHoverDate(shiftDays(current, keyStep) > range.to ? range.to : shiftDays(current, keyStep))
    else if (event.key === 'Enter' && hoverPoint) onSelectDate?.(hoverPoint.date)
    else return
    event.preventDefault()
  }

  return (
    <div ref={ref} className="relative w-full" data-testid={testId}>
      <svg
        width={width}
        height={h}
        viewBox={`0 0 ${width} ${h}`}
        role="group"
        aria-label={`${ariaLabel}; sol ve sağ ok tuşlarıyla tarihler arasında gezinin`}
        tabIndex={0}
        onKeyDown={onKey}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false)
          onHoverDate(null)
        }}
        className="block overflow-visible rounded-sm focus-visible:outline-2 focus-visible:outline-app-accent"
        data-focused={focused}
      >
        {visibleBands.map((b, i) => {
          const x1 = x(b.baslangic)
          const x2 = x(b.bitis)
          return (
            <g key={`${b.kod}-${b.baslangic}`}>
              <rect x={x1} y={m.top} width={Math.max(1, x2 - x1)} height={plotH} style={{ fill: 'var(--color-app-text)' }} opacity={i % 2 === 0 ? 0.045 : 0.085} data-testid="phenology-band" data-stage={b.kod}>
                <title>{`${b.ad}${b.ozel ? ' (bahçe düzeltmesi)' : ''}`}</title>
              </rect>
              {!compact && x2 - x1 > 54 && (
                <text x={x1 + 4} y={m.top + 11} style={{ ...FONT, fill: 'var(--color-app-text-dim)', fontSize: 11 }} pointerEvents="none">
                  {b.ad.length * 5.6 > x2 - x1 - 8 ? `${b.ad.slice(0, Math.max(3, Math.floor((x2 - x1 - 8) / 5.6) - 1))}…` : b.ad}
                </text>
              )}
            </g>
          )
        })}

        {leftTicks.map((t) => (
          <g key={`l${t}`}>
            <line x1={m.left} x2={width - m.right} y1={yOf(t, leftDomain)} y2={yOf(t, leftDomain)} style={{ stroke: 'var(--color-app-border)' }} />
            <text x={m.left - 6} y={yOf(t, leftDomain) + 4} textAnchor="end" style={{ ...FONT, fill: 'var(--color-app-text-dim)' }}>
              {leftFormat(t)}
            </text>
          </g>
        ))}
        {rightDomain &&
          rightTicks.map((t) => (
            <text key={`r${t}`} x={width - m.right + 6} y={yOf(t, rightDomain) + 4} style={{ ...FONT, fill: right[0]?.color }}>
              {(rightFormat ?? leftFormat)(t)}
            </text>
          ))}
        {ticks.map((t, i) =>
          i % step === 0 ? (
            <text key={t.date} x={x(t.date) + 2} y={h - 8} style={{ ...FONT, fill: 'var(--color-app-text-dim)' }}>
              {t.label}
              {t.year ? ` ${t.year}` : ''}
            </text>
          ) : null,
        )}

        {lines.map((line) => (
          <g key={line.id}>
            {line.points.filter(inRange).length > 1 && (
              <path
                d={pathOf(line)}
                fill="none"
                strokeWidth={line.secondary ? 1.5 : 2.25}
                strokeDasharray={line.dashed ? '4 3' : undefined}
                strokeLinejoin="round"
                strokeLinecap="round"
                opacity={line.opacity ?? 1}
                style={{ stroke: line.color }}
              />
            )}
            {line.dots &&
              line.points.filter(inRange).map((p) => (
                <circle
                  key={p.date}
                  cx={x(p.date)}
                  cy={yOf(p.value, domainFor(line))}
                  r={p.date === activeDate ? 4.5 : 2.25}
                  strokeWidth={1}
                  style={{ fill: p.date === activeDate ? 'var(--color-app-text)' : line.color, stroke: 'var(--color-app-panel)' }}
                />
              ))}
          </g>
        ))}

        {activeDate && !hoverDate && <line x1={x(activeDate)} x2={x(activeDate)} y1={m.top} y2={h - m.bottom} strokeDasharray="2 3" style={{ stroke: 'var(--color-app-text-muted)' }} />}
        {hoverDate && (
          <g pointerEvents="none">
            <line x1={hoverX} x2={hoverX} y1={m.top} y2={h - m.bottom} style={{ stroke: 'var(--color-app-text-muted)' }} />
            {rows.map(({ line, point }) => (
              <circle key={line.id} cx={x(point.date)} cy={yOf(point.value, domainFor(line))} r={4.5} fill="none" strokeWidth={2} style={{ stroke: line.color }} />
            ))}
          </g>
        )}

        <rect
          x={m.left}
          y={0}
          width={plotW}
          height={h}
          fill="transparent"
          className={onSelectDate ? 'cursor-pointer' : undefined}
          onPointerMove={(e) => onHoverDate(dateAtFraction(frac(e.clientX, e.currentTarget), range))}
          onPointerLeave={() => onHoverDate(null)}
          onClick={(e) => {
            const point = primary ? nearest(primary.points.filter(inRange), dateAtFraction(frac(e.clientX, e.currentTarget), range), CHART.hoverGapDays) : null
            if (point) onSelectDate?.(point.date)
          }}
        />
        {empty && (
          <text x={width / 2} y={h / 2} textAnchor="middle" style={{ ...FONT, fill: 'var(--color-app-text-dim)' }}>
            {emptyText}
          </text>
        )}
      </svg>

      {hoverDate && rows.length > 0 && (
        <div
          role="status"
          aria-live="polite"
          data-testid="chart-tooltip"
          className="pointer-events-none absolute top-1 z-10 rounded-md border border-app-border bg-app-panel px-3 py-2 text-small shadow-e2"
          style={{ left: flip ? undefined : Math.max(4, hoverX + 10), right: flip ? 4 : undefined, width: CHART.tooltipWidthPx }}
        >
          <p className="font-semibold text-app-text">{formatDate(hoverDate)}</p>
          {stage && (
            <p className="text-app-text-muted" data-testid="tooltip-stage">
              {stage.ad}
              {bandNote ? ` · ${bandNote}` : ''}
            </p>
          )}
          {rows.map(({ line, point }) => (
            <p key={line.id} className="tabular" style={{ color: line.secondary ? 'var(--color-app-text-muted)' : 'var(--color-app-text)' }}>
              <i className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ background: line.color }} aria-hidden />
              {line.label}: <strong>{(line.format ?? leftFormat)(point.value)}</strong>
              {line.originalDate ? <span className="text-app-text-dim"> ({formatDate(line.originalDate(point.date))})</span> : null}
            </p>
          ))}
          {onSelectDate && hoverPoint && <p className="mt-1 text-caption text-app-text-dim">Tıklayınca bu tarih Arşiv'de açılır</p>}
        </div>
      )}
    </div>
  )
}
