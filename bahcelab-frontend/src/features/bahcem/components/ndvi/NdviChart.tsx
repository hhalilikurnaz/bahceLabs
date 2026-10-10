import { useMemo, useRef, useState } from 'react'
import type { NdviObservation } from '../../api/ndviApi'
import { formatDate, formatNdvi, monthLabels } from '../../lib/ndvi'

interface NdviChartProps {
  observations: NdviObservation[]
  /** Bu sezon (takvim yılı); bir önceki sezon üst üste çizilir */
  season: number
  activeDate: string | null
  onSelect: (tarih: string) => void
}

const W = 320
const H = 176
const M = { left: 32, right: 10, top: 12, bottom: 24 }
const Y_MIN = 0
const Y_MAX = 0.9
const Y_TICKS = [0, 0.3, 0.6, 0.9]

const dayOfYear = (iso: string): number => {
  const [y, m, d] = iso.split('-').map(Number)
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 0)) / 86_400_000)
}
const daysInYear = (year: number) => (new Date(year, 1, 29).getMonth() === 1 ? 366 : 365)

const x = (doy: number, year: number) =>
  M.left + ((doy - 1) / (daysInYear(year) - 1)) * (W - M.left - M.right)
const y = (value: number) =>
  M.top +
  (1 - (Math.min(Y_MAX, Math.max(Y_MIN, value)) - Y_MIN) / (Y_MAX - Y_MIN)) * (H - M.top - M.bottom)

interface Point {
  tarih: string
  value: number
  px: number
  py: number
}

function toPoints(observations: NdviObservation[], year: number): Point[] {
  return observations
    .filter((o) => o.durum === 'tamam' && o.ortalama !== null && o.tarih.startsWith(String(year)))
    .sort((a, b) => a.tarih.localeCompare(b.tarih))
    .map((o) => ({
      tarih: o.tarih,
      value: o.ortalama as number,
      px: x(dayOfYear(o.tarih), year),
      py: y(o.ortalama as number),
    }))
}

const linePath = (points: Point[]) =>
  points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.px.toFixed(1)} ${p.py.toFixed(1)}`).join(' ')

interface SeriesProps {
  points: Point[]
  year: number
  dim: boolean
  activeDate: string | null
}

function Series({ points, year, dim, activeDate }: SeriesProps) {
  if (points.length === 0) return null
  return (
    <g aria-label={`${year} sezonu`}>
      <path
        d={linePath(points)}
        fill="none"
        strokeWidth={dim ? 1.5 : 2}
        strokeLinejoin="round"
        strokeLinecap="round"
        strokeDasharray={dim ? '4 3' : undefined}
        style={{ stroke: dim ? 'var(--color-app-text-muted)' : 'var(--color-app-accent)' }}
        opacity={dim ? 0.7 : 1}
      />
      {points.map((p) => (
        <g key={p.tarih}>
          <circle
            cx={p.px}
            cy={p.py}
            r={p.tarih === activeDate ? 4.5 : 2.4}
            style={{
              fill:
                p.tarih === activeDate
                  ? 'var(--color-app-text)'
                  : dim
                    ? 'var(--color-app-text-muted)'
                    : 'var(--color-app-accent)',
              stroke: 'var(--color-app-panel)',
            }}
            strokeWidth={1}
          />
        </g>
      ))}
    </g>
  )
}

/** Bu sezon ve geçen sezon üst üste; ay ekseni; noktaya tıklayınca o tarihin görüntüsü açılır. */
export function NdviChart({ observations, season, activeDate, onSelect }: NdviChartProps) {
  const [hover, setHover] = useState<Point | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const current = useMemo(() => toPoints(observations, season), [observations, season])
  const previous = useMemo(() => toPoints(observations, season - 1), [observations, season])

  const monthStarts = useMemo(
    () =>
      monthLabels.map((label, month) => ({
        label,
        px: x(dayOfYear(`${season}-${String(month + 1).padStart(2, '0')}-01`), season),
      })),
    [season],
  )

  const activePoint = [...current, ...previous].find((p) => p.tarih === activeDate)
  const empty = current.length === 0 && previous.length === 0
  const shown = hover ?? activePoint
  const allPoints = useMemo(() => [...current, ...previous], [current, previous])

  /** Noktalar (5 günde bir) birbirine çok yakın olduğundan tıklama, imlece en yakın noktayı seçer. */
  function nearestPoint(event: React.PointerEvent<SVGRectElement>): Point | null {
    const svg = svgRef.current
    if (!svg || allPoints.length === 0) return null
    const rect = svg.getBoundingClientRect()
    const scale = W / rect.width
    const px = (event.clientX - rect.left) * scale
    const py = (event.clientY - rect.top) * scale
    let best: Point | null = null
    let bestDistance = 18 // viewBox birimi
    for (const point of allPoints) {
      const distance = Math.hypot(point.px - px, (point.py - py) * 0.6)
      if (distance < bestDistance) {
        best = point
        bestDistance = distance
      }
    }
    return best
  }

  return (
    <div>
      <div className="mb-1 flex h-5 items-center justify-between text-[12px]">
        <span className="font-medium text-app-text">NDVI geçmişi</span>
        <span className="text-app-text-muted" aria-live="polite">
          {shown ? `${formatDate(shown.tarih)} · ${formatNdvi(shown.value)}` : ''}
        </span>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="NDVI zaman grafiği; tarihlere alttaki şeritten de erişebilirsiniz"
      >
        {Y_TICKS.map((tick) => (
          <g key={tick}>
            <line
              x1={M.left}
              x2={W - M.right}
              y1={y(tick)}
              y2={y(tick)}
              style={{ stroke: 'var(--color-app-border)' }}
              strokeWidth={1}
            />
            <text
              x={M.left - 6}
              y={y(tick) + 3}
              textAnchor="end"
              fontSize={9}
              style={{ fill: 'var(--color-app-text-dim)' }}
            >
              {formatNdvi(tick)}
            </text>
          </g>
        ))}
        {monthStarts.map((m) => (
          <text
            key={m.label}
            x={m.px + 1}
            y={H - 8}
            fontSize={8.5}
            style={{ fill: 'var(--color-app-text-dim)' }}
          >
            {m.label}
          </text>
        ))}

        {activePoint && (
          <line
            x1={activePoint.px}
            x2={activePoint.px}
            y1={M.top}
            y2={H - M.bottom}
            strokeDasharray="2 3"
            strokeWidth={1}
            style={{ stroke: 'var(--color-app-text-muted)' }}
          />
        )}

        <Series
          points={previous}
          year={season - 1}
          dim
          activeDate={activeDate}
        />
        <Series
          points={current}
          year={season}
          dim={false}
          activeDate={activeDate}
        />

        {/* Tüm grafik alanı: imleç konumundan en yakın noktayı bulur */}
        <rect
          x={M.left}
          y={0}
          width={W - M.left - M.right}
          height={H - M.bottom}
          fill="transparent"
          className="cursor-pointer"
          onPointerMove={(e) => setHover(nearestPoint(e))}
          onPointerLeave={() => setHover(null)}
          onClick={(e) => {
            const point = nearestPoint(e as unknown as React.PointerEvent<SVGRectElement>)
            if (point) onSelect(point.tarih)
          }}
        />

        {empty && (
          <text
            x={W / 2}
            y={H / 2}
            textAnchor="middle"
            fontSize={11}
            style={{ fill: 'var(--color-app-text-dim)' }}
          >
            Bu sezon için görüntü yok
          </text>
        )}
      </svg>

      <div className="mt-1 flex items-center gap-4 text-[11px] text-app-text-muted">
        <span className="flex items-center gap-1.5">
          <i className="h-0.5 w-4 rounded bg-app-accent" aria-hidden />
          {season} sezonu
        </span>
        <span className="flex items-center gap-1.5">
          <i className="h-0 w-4 border-t-2 border-dashed border-app-text-muted" aria-hidden />
          {season - 1} sezonu
        </span>
      </div>
    </div>
  )
}
