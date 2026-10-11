import { useMemo, useState, type KeyboardEvent } from 'react'
import type { Scene } from '../../api/indeksApi'
import type { HistoryDay } from '../../api/weatherApi'
import { useElementWidth } from '../../hooks/useElementWidth'
import { monthLabelStep, niceTicks, paddedDomain } from '../../lib/chartScale'
import { CHART } from '../../lib/config'
import { dayOfYear, daysInYear, formatDate, MONTHS_SHORT } from '../../lib/dates'
import { INDEX_DEFS, formatIndexValue, type IndexId } from '../../lib/indices'
import { formatMm, formatTemp } from '../../lib/weather'

interface TimeChartProps {
  scenes: Scene[]
  indeks: IndexId
  /** Bu sezon (takvim yılı); bir önceki sezon kesikli çizilir */
  season: number
  activeDate?: string | null
  onSelect?: (tarih: string) => void
  /** Günlük yağış ve sıcaklık (null = kapalı) */
  weather?: HistoryDay[] | null
  weatherLoading?: boolean
  /** Dar görünüm: arşiv sayfasının üstündeki ince grafik */
  compact?: boolean
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

/** Bu sezon ve geçen sezon: tek parametre, otomatik Y ekseni, çapraz imleç ve ortak ipucu kutusu. */
export function TimeChart({ scenes, indeks, season, activeDate = null, onSelect, weather = null, weatherLoading = false, compact = false }: TimeChartProps) {
  const def = INDEX_DEFS[indeks]
  const [ref, width] = useElementWidth<HTMLDivElement>()
  const [hoverDoy, setHoverDoy] = useState<number | null>(null)

  const current = useMemo(() => pointsOf(scenes, indeks, season), [scenes, indeks, season])
  const previous = useMemo(() => pointsOf(scenes, indeks, season - 1), [scenes, indeks, season])

  const height = compact ? CHART.compactHeightPx : CHART.heightPx
  const weatherH = weather && !compact ? CHART.weatherHeightPx : 0
  const m = compact ? CHART.marginCompact : CHART.margin
  const plotW = Math.max(40, width - m.left - m.right)
  const plotH = height - m.top - m.bottom
  const total = height + weatherH

  const domain = useMemo(
    () =>
      paddedDomain([...current, ...previous].map((p) => p.value), CHART.yPaddingShare, (def.max - def.min) * CHART.minSpanShare, {
        min: def.min,
        max: def.max,
      }),
    [current, previous, def],
  )
  const ticks = useMemo(() => niceTicks(domain, compact ? 3 : CHART.yTicks), [domain, compact])
  const x = (doy: number, year = season) => m.left + ((doy - 1) / (daysInYear(year) - 1)) * plotW
  const y = (v: number) => m.top + (1 - (v - domain.min) / (domain.max - domain.min)) * plotH
  const path = (pts: Point[]) => pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.doy, p.year).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ')

  const nearestIn = (pts: Point[], doy: number, maxGap: number): Point | null => {
    let best: Point | null = null
    for (const p of pts) if (Math.abs(p.doy - doy) <= maxGap && (!best || Math.abs(p.doy - doy) < Math.abs(best.doy - doy))) best = p
    return best
  }

  const hoverCur = hoverDoy === null ? null : nearestIn(current, hoverDoy, CHART.hoverGapDays)
  const hoverPrev = hoverDoy === null ? null : nearestIn(previous, hoverDoy, CHART.hoverGapDays)
  const anchor = hoverCur ?? hoverPrev
  const activePoint = current.find((p) => p.tarih === activeDate) ?? null
  const cross = anchor ?? null
  const weatherByDate = useMemo(() => new Map((weather ?? []).map((d) => [d.tarih, d])), [weather])

  const doyAt = (event: { clientX: number; currentTarget: Element }): number => {
    const rect = event.currentTarget.getBoundingClientRect()
    const frac = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
    return 1 + frac * (daysInYear(season) - 1)
  }

  function onKey(event: KeyboardEvent<SVGSVGElement>) {
    if (current.length === 0) return
    const index = hoverCur ? current.indexOf(hoverCur) : current.length
    if (event.key === 'ArrowLeft') setHoverDoy(current[Math.max(0, index - 1)].doy)
    else if (event.key === 'ArrowRight') setHoverDoy(current[Math.min(current.length - 1, index + 1)].doy)
    else if (event.key === 'Enter' && hoverCur) onSelect?.(hoverCur.tarih)
    else return
    event.preventDefault()
  }

  const step = monthLabelStep(plotW, CHART.monthLabelPx)
  const monthStarts = MONTHS_SHORT.map((label, i) => ({ label, i, px: x(dayOfYear(`${season}-${String(i + 1).padStart(2, '0')}-01`)) })).filter((mo) => mo.i % step === 0)
  const wx = useMemo(() => {
    const days = (weather ?? []).filter((d) => d.tarih.startsWith(String(season)))
    const means = days.flatMap((d) => (d.min != null && d.max != null ? [(d.min + d.max) / 2] : []))
    const lo = means.length ? Math.floor(Math.min(...means) / 5) * 5 : 0
    const hi = means.length ? Math.ceil(Math.max(...means) / 5) * 5 : 30
    return { days, lo, hi }
  }, [weather, season])
  const tempY = (t: number) => height + CHART.weatherTempBottom - ((t - wx.lo) / Math.max(1, wx.hi - wx.lo)) * (CHART.weatherTempBottom - CHART.weatherTempTop)
  const rainBottom = height + weatherH - 6
  const tooltipLeft = cross ? Math.min(Math.max(x(cross.doy, cross.year) + 10, 4), width - CHART.tooltipWidthPx - 4) : 0
  const flip = cross ? x(cross.doy, cross.year) + 10 + CHART.tooltipWidthPx > width - 4 : false
  const empty = current.length === 0 && previous.length === 0

  return (
    <div ref={ref} className="relative w-full" data-testid="time-chart-body">
      <svg
        width={width}
        height={total}
        viewBox={`0 0 ${width} ${total}`}
        role="group"
        aria-label={`${def.ad} zaman grafiği; sol ve sağ ok tuşlarıyla tarihler arasında gezinin`}
        tabIndex={0}
        onKeyDown={onKey}
        onBlur={() => setHoverDoy(null)}
        className="block overflow-visible rounded-sm focus-visible:outline-2 focus-visible:outline-app-accent"
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={m.left} x2={width - m.right} y1={y(t)} y2={y(t)} style={{ stroke: 'var(--color-app-border)' }} />
            <text x={m.left - 6} y={y(t) + 4} textAnchor="end" style={{ ...FONT, fill: 'var(--color-app-text-dim)' }}>
              {formatIndexValue(indeks, t)}
            </text>
          </g>
        ))}
        {monthStarts.map((mo) => (
          <text key={mo.label} x={mo.px + 2} y={height - 8} style={{ ...FONT, fill: 'var(--color-app-text-dim)' }}>
            {mo.label}
          </text>
        ))}

        {previous.length > 1 && (
          <path d={path(previous)} fill="none" strokeWidth={1.5} strokeDasharray="4 3" strokeLinecap="round" opacity={0.7} style={{ stroke: def.cizgi }} />
        )}
        {current.length > 1 && <path d={path(current)} fill="none" strokeWidth={2.25} strokeLinejoin="round" strokeLinecap="round" style={{ stroke: def.cizgi }} />}
        {current.map((p) => (
          <circle key={p.tarih} cx={x(p.doy)} cy={y(p.value)} r={p.tarih === activeDate ? 4.5 : 2.25} style={{ fill: p.tarih === activeDate ? 'var(--color-app-text)' : def.cizgi, stroke: 'var(--color-app-panel)' }} strokeWidth={1} />
        ))}

        {activePoint && !cross && (
          <line x1={x(activePoint.doy)} x2={x(activePoint.doy)} y1={m.top} y2={height - m.bottom} strokeDasharray="2 3" style={{ stroke: 'var(--color-app-text-muted)' }} />
        )}

        {weather && !compact && (
          <g aria-label="Günlük yağış ve sıcaklık" data-testid="weather-layer">
            <line x1={m.left} x2={width - m.right} y1={rainBottom} y2={rainBottom} style={{ stroke: 'var(--color-app-border)' }} />
            {wx.days.map((d) =>
              d.yagisMm && d.yagisMm > 0 ? (
                <rect
                  key={d.tarih}
                  x={x(dayOfYear(d.tarih)) - 1}
                  width={2}
                  y={rainBottom - (Math.min(d.yagisMm, CHART.rainCapMm) / CHART.rainCapMm) * (rainBottom - height - CHART.weatherRainTop)}
                  height={(Math.min(d.yagisMm, CHART.rainCapMm) / CHART.rainCapMm) * (rainBottom - height - CHART.weatherRainTop)}
                  rx={0.6}
                  style={{ fill: 'var(--color-app-water)' }}
                  opacity={0.85}
                />
              ) : null,
            )}
            <path
              d={wx.days
                .filter((d) => d.min != null && d.max != null)
                .map((d, i) => `${i === 0 ? 'M' : 'L'}${x(dayOfYear(d.tarih)).toFixed(1)} ${tempY(((d.min as number) + (d.max as number)) / 2).toFixed(1)}`)
                .join(' ')}
              fill="none"
              strokeWidth={1.5}
              style={{ stroke: 'var(--color-app-warn)' }}
            />
            <text x={m.left - 6} y={tempY(wx.hi) + 4} textAnchor="end" style={{ ...FONT, fill: 'var(--color-app-text-dim)' }}>
              {wx.hi}°
            </text>
            <text x={m.left - 6} y={tempY(wx.lo) + 4} textAnchor="end" style={{ ...FONT, fill: 'var(--color-app-text-dim)' }}>
              {wx.lo}°
            </text>
            {wx.days.length === 0 && (
              <text x={width / 2} y={height + weatherH / 2} textAnchor="middle" style={{ ...FONT, fill: 'var(--color-app-text-dim)' }}>
                {weatherLoading ? 'Hava verisi yükleniyor…' : 'Bu sezon için hava verisi yok'}
              </text>
            )}
          </g>
        )}

        {cross && (
          <g pointerEvents="none">
            <line x1={x(cross.doy, cross.year)} x2={x(cross.doy, cross.year)} y1={m.top} y2={total - 4} style={{ stroke: 'var(--color-app-text-muted)' }} />
            {[hoverCur, hoverPrev].map(
              (p) => p && <circle key={p.tarih} cx={x(p.doy, p.year)} cy={y(p.value)} r={5} fill="none" strokeWidth={2} style={{ stroke: 'var(--color-app-text)' }} />,
            )}
          </g>
        )}

        <rect
          x={m.left}
          y={0}
          width={plotW}
          height={total}
          fill="transparent"
          className={onSelect ? 'cursor-pointer' : undefined}
          onPointerMove={(e) => setHoverDoy(doyAt(e))}
          onPointerLeave={() => setHoverDoy(null)}
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
          {hoverCur && weatherByDate.get(hoverCur.tarih) && (
            <p className="tabular text-app-text-muted">
              {[
                weatherByDate.get(hoverCur.tarih)?.yagisMm != null ? formatMm(weatherByDate.get(hoverCur.tarih)?.yagisMm as number) : null,
                weatherByDate.get(hoverCur.tarih)?.min != null ? `${formatTemp(weatherByDate.get(hoverCur.tarih)?.min as number)}/${formatTemp(weatherByDate.get(hoverCur.tarih)?.max as number)}` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
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
        </div>
      )}
    </div>
  )
}
