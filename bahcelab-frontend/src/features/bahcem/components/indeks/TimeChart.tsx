import { useMemo, useState, type KeyboardEvent } from 'react'
import type { Scene } from '../../api/indeksApi'
import { useElementWidth } from '../../hooks/useElementWidth'
import { monthLabelStep, niceTicks, paddedDomain } from '../../lib/chartScale'
import { CHART } from '../../lib/config'
import { dayOfYear, daysInYear, formatDate, MONTHS_SHORT } from '../../lib/dates'
import { INDEX_DEFS, formatIndexValue, type IndexId } from '../../lib/indices'

interface TimeChartProps {
  scenes: Scene[]
  indeks: IndexId
  /** Bu sezon (takvim yılı); bir önceki sezon kesikli çizilir */
  season: number
  activeDate?: string | null
  onSelect?: (tarih: string) => void
  /** İkincil parametre: kendi (sağ) ekseniyle, yalnızca bu sezon çizilir */
  compare?: IndexId | null
  /** Dar görünüm: arşiv sayfasının üstündeki ince grafik */
  compact?: boolean
  /** İmleç konumu (yılın günü) dışarıdan paylaşılabilir: hava grafiğiyle eşzamanlı çapraz imleç */
  hoverDoy?: number | null
  onHoverDoy?: (doy: number | null) => void
}

interface Point {
  year: number
  tarih: string
  value: number
  bulut: number | null
  doy: number
}

const FONT = { fontFamily: 'var(--font-sans)', fontSize: CHART.fontPx, fontVariantNumeric: 'tabular-nums' } as const

function pointsOf(scenes: Scene[], indeks: IndexId, year: number): Point[] {
  return scenes
    .filter((s) => s.durum === 'tamam' && s.indeksler[indeks] && s.tarih.startsWith(String(year)))
    .map((s) => ({
      year,
      tarih: s.tarih,
      value: (s.indeksler[indeks] as NonNullable<Scene['indeksler'][IndexId]>).ortalama,
      bulut: s.bulutOrani,
      doy: dayOfYear(s.tarih),
    }))
}

const nearestIn = (pts: Point[], doy: number, maxGap: number): Point | null => {
  let best: Point | null = null
  for (const p of pts) if (Math.abs(p.doy - doy) <= maxGap && (!best || Math.abs(p.doy - doy) < Math.abs(best.doy - doy))) best = p
  return best
}

/** Bu sezon ve geçen sezon: otomatik Y ekseni, çapraz imleç ve ortak ipucu kutusu; isteğe bağlı ikinci parametre (sağ eksen). */
export function TimeChart({ scenes, indeks, season, activeDate = null, onSelect, compare = null, compact = false, hoverDoy: controlled, onHoverDoy }: TimeChartProps) {
  const def = INDEX_DEFS[indeks]
  const def2 = compare && compare !== indeks ? INDEX_DEFS[compare] : null
  const [ref, width] = useElementWidth<HTMLDivElement>()
  const [localHover, setLocalHover] = useState<number | null>(null)
  const hoverDoy = controlled !== undefined ? controlled : localHover
  const setHover = (doy: number | null) => (onHoverDoy ? onHoverDoy(doy) : setLocalHover(doy))

  const current = useMemo(() => pointsOf(scenes, indeks, season), [scenes, indeks, season])
  const previous = useMemo(() => pointsOf(scenes, indeks, season - 1), [scenes, indeks, season])
  const second = useMemo(() => (def2 ? pointsOf(scenes, def2.id, season) : []), [scenes, def2, season])

  const height = compact ? CHART.compactHeightPx : CHART.heightPx
  const base = compact ? CHART.marginCompact : CHART.margin
  // Sağ eksen (ikinci parametre ve hava grafiğinin °C ekseni) için aynı boşluk: iki grafiğin zaman ekseni hizalı kalır
  const m = { ...base, right: compact ? base.right : CHART.marginRightCompare }
  const plotW = Math.max(40, width - m.left - m.right)
  const plotH = height - m.top - m.bottom

  const domainFor = (values: number[], d: { min: number; max: number }) =>
    paddedDomain(values, CHART.yPaddingShare, (d.max - d.min) * CHART.minSpanShare, d)
  const domain = useMemo(() => domainFor([...current, ...previous].map((p) => p.value), def), [current, previous, def])
  const domain2 = useMemo(() => (def2 ? domainFor(second.map((p) => p.value), def2) : null), [second, def2])
  const ticks = useMemo(() => niceTicks(domain, compact ? 3 : CHART.yTicks), [domain, compact])
  const ticks2 = useMemo(() => (domain2 ? niceTicks(domain2, CHART.yTicks) : []), [domain2])
  const x = (doy: number, year = season) => m.left + ((doy - 1) / (daysInYear(year) - 1)) * plotW
  const yOf = (v: number, d: { min: number; max: number }) => m.top + (1 - (v - d.min) / (d.max - d.min)) * plotH
  const path = (pts: Point[], d: { min: number; max: number }) => pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.doy, p.year).toFixed(1)} ${yOf(p.value, d).toFixed(1)}`).join(' ')

  const hoverCur = hoverDoy === null ? null : nearestIn(current, hoverDoy, CHART.hoverGapDays)
  const hoverPrev = hoverDoy === null ? null : nearestIn(previous, hoverDoy, CHART.hoverGapDays)
  const hoverSecond = hoverDoy === null ? null : nearestIn(second, hoverDoy, CHART.hoverGapDays)
  const cross = hoverCur ?? hoverPrev
  const activePoint = current.find((p) => p.tarih === activeDate) ?? null

  const doyAt = (event: { clientX: number; currentTarget: Element }): number => {
    const rect = event.currentTarget.getBoundingClientRect()
    const frac = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
    return 1 + frac * (daysInYear(season) - 1)
  }

  function onKey(event: KeyboardEvent<SVGSVGElement>) {
    if (current.length === 0) return
    const index = hoverCur ? current.indexOf(hoverCur) : current.length
    if (event.key === 'ArrowLeft') setHover(current[Math.max(0, index - 1)].doy)
    else if (event.key === 'ArrowRight') setHover(current[Math.min(current.length - 1, index + 1)].doy)
    else if (event.key === 'Enter' && hoverCur) onSelect?.(hoverCur.tarih)
    else return
    event.preventDefault()
  }

  const step = monthLabelStep(plotW, CHART.monthLabelPx)
  const monthStarts = MONTHS_SHORT.map((label, i) => ({ label, i, px: x(dayOfYear(`${season}-${String(i + 1).padStart(2, '0')}-01`)) })).filter((mo) => mo.i % step === 0)
  const tooltipLeft = cross ? Math.min(Math.max(x(cross.doy, cross.year) + 10, 4), width - CHART.tooltipWidthPx - 4) : 0
  const flip = cross ? x(cross.doy, cross.year) + 10 + CHART.tooltipWidthPx > width - 4 : false
  const empty = current.length === 0 && previous.length === 0

  return (
    <div ref={ref} className="relative w-full" data-testid="time-chart-body">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="group"
        aria-label={`${def.ad} zaman grafiği; sol ve sağ ok tuşlarıyla tarihler arasında gezinin`}
        tabIndex={0}
        onKeyDown={onKey}
        onBlur={() => setHover(null)}
        className="block overflow-visible rounded-sm focus-visible:outline-2 focus-visible:outline-app-accent"
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={m.left} x2={width - m.right} y1={yOf(t, domain)} y2={yOf(t, domain)} style={{ stroke: 'var(--color-app-border)' }} />
            <text x={m.left - 6} y={yOf(t, domain) + 4} textAnchor="end" style={{ ...FONT, fill: 'var(--color-app-text-dim)' }}>
              {formatIndexValue(indeks, t)}
            </text>
          </g>
        ))}
        {def2 &&
          domain2 &&
          ticks2.map((t) => (
            <text key={t} x={width - m.right + 6} y={yOf(t, domain2) + 4} style={{ ...FONT, fill: def2.cizgi }}>
              {formatIndexValue(def2.id, t)}
            </text>
          ))}
        {monthStarts.map((mo) => (
          <text key={mo.label} x={mo.px + 2} y={height - 8} style={{ ...FONT, fill: 'var(--color-app-text-dim)' }}>
            {mo.label}
          </text>
        ))}

        {previous.length > 1 && <path d={path(previous, domain)} fill="none" strokeWidth={1.5} strokeDasharray="4 3" strokeLinecap="round" opacity={0.7} style={{ stroke: def.cizgi }} />}
        {current.length > 1 && <path d={path(current, domain)} fill="none" strokeWidth={2.25} strokeLinejoin="round" strokeLinecap="round" style={{ stroke: def.cizgi }} />}
        {def2 && domain2 && second.length > 1 && <path d={path(second, domain2)} fill="none" strokeWidth={2} strokeLinejoin="round" style={{ stroke: def2.cizgi }} />}
        {current.map((p) => (
          <circle key={p.tarih} cx={x(p.doy)} cy={yOf(p.value, domain)} r={p.tarih === activeDate ? 4.5 : 2.25} style={{ fill: p.tarih === activeDate ? 'var(--color-app-text)' : def.cizgi, stroke: 'var(--color-app-panel)' }} strokeWidth={1} />
        ))}

        {activePoint && !cross && (
          <line x1={x(activePoint.doy)} x2={x(activePoint.doy)} y1={m.top} y2={height - m.bottom} strokeDasharray="2 3" style={{ stroke: 'var(--color-app-text-muted)' }} />
        )}
        {hoverDoy !== null && (
          <g pointerEvents="none">
            <line x1={x(hoverDoy)} x2={x(hoverDoy)} y1={m.top} y2={height - m.bottom} style={{ stroke: 'var(--color-app-text-muted)' }} />
            {[hoverCur, hoverPrev].map((p) => p && <circle key={p.tarih} cx={x(p.doy, p.year)} cy={yOf(p.value, domain)} r={5} fill="none" strokeWidth={2} style={{ stroke: 'var(--color-app-text)' }} />)}
          </g>
        )}

        <rect
          x={m.left}
          y={0}
          width={plotW}
          height={height}
          fill="transparent"
          className={onSelect ? 'cursor-pointer' : undefined}
          onPointerMove={(e) => setHover(doyAt(e))}
          onPointerLeave={() => setHover(null)}
          onClick={(e) => {
            const doy = doyAt(e)
            const hit = nearestIn(current, doy, CHART.hoverGapDays) ?? nearestIn(previous, doy, CHART.hoverGapDays)
            if (hit) onSelect?.(hit.tarih)
          }}
        />
        {empty && (
          <text x={width / 2} y={height / 2} textAnchor="middle" style={{ ...FONT, fill: 'var(--color-app-text-dim)' }}>
            Bu sezon için görüntü yok
          </text>
        )}
      </svg>

      {cross && (
        <div
          role="status"
          aria-live="polite"
          data-testid="chart-tooltip"
          className="pointer-events-none absolute top-1 z-10 rounded-md border border-app-border bg-app-panel px-3 py-2 text-small shadow-e2"
          style={{ left: flip ? undefined : tooltipLeft, right: flip ? 4 : undefined, width: CHART.tooltipWidthPx }}
        >
          <p className="font-semibold text-app-text">{def.ad}</p>
          {hoverCur && (
            <p className="tabular text-app-text">
              {formatDate(hoverCur.tarih)} · <strong>{formatIndexValue(indeks, hoverCur.value)}</strong>
              {hoverCur.bulut !== null && <span className="text-app-text-muted"> · bulut %{Math.round(hoverCur.bulut)}</span>}
            </p>
          )}
          {hoverPrev && (
            <p className="tabular text-app-text-muted">
              {formatDate(hoverPrev.tarih)} · {formatIndexValue(indeks, hoverPrev.value)} (geçen sezon)
            </p>
          )}
          {def2 && hoverSecond && (
            <p className="tabular" style={{ color: def2.cizgi }}>
              {def2.ad} · {formatIndexValue(def2.id, hoverSecond.value)}
            </p>
          )}
          {onSelect && <p className="mt-1 text-caption text-app-text-dim">Tıklayınca bu tarih Arşiv'de açılır</p>}
        </div>
      )}

      {!compact && (
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-app-text-muted">
          <span className="flex items-center gap-1.5">
            <i className="h-0.5 w-4 rounded" style={{ background: def.cizgi }} aria-hidden />
            {season} sezonu
          </span>
          <span className="flex items-center gap-1.5">
            <i className="h-0 w-4 border-t-2 border-dashed" style={{ borderColor: def.cizgi }} aria-hidden />
            {season - 1} sezonu
          </span>
          {def2 && (
            <span className="flex items-center gap-1.5">
              <i className="h-0.5 w-4 rounded" style={{ background: def2.cizgi }} aria-hidden />
              {def2.ad} (sağ eksen)
            </span>
          )}
        </div>
      )}
    </div>
  )
}
