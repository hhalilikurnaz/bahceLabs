import { useMemo, useRef, useState } from 'react'
import { Cloud } from 'lucide-react'
import type { Scene } from '../../api/indeksApi'
import type { HistoryDay } from '../../api/weatherApi'
import { dayOfYear, daysInYear, formatDate, MONTHS_SHORT } from '../../lib/dates'
import { INDEX_DEFS, INDEX_IDS, formatIndexValue, type IndexId } from '../../lib/indices'
import { formatMm, formatTemp } from '../../lib/weather'

interface IndexChartProps {
  scenes: Scene[]
  /** Bu sezon (takvim yılı); bir önceki sezon üst üste çizilir */
  season: number
  active: IndexId[]
  activeDate: string | null
  onToggle: (indeks: IndexId) => void
  onSelect: (tarih: string) => void
  /** Hava katmanı: günlük yağış çubukları ve sıcaklık çizgisi aynı zaman ekseninde (null = kapalı) */
  weather: HistoryDay[] | null
  weatherLoading?: boolean
  onWeatherToggle: () => void
}

function weatherNote(day: HistoryDay | undefined): string {
  if (!day) return ''
  const parts = [day.yagisMm != null ? formatMm(day.yagisMm) : null, day.min != null && day.max != null ? `${formatTemp(day.min)}/${formatTemp(day.max)}` : null]
  const text = parts.filter(Boolean).join(' · ')
  return text ? ` · hava: ${text}` : ''
}

/** Bu sezon noktasına verilen avantaj (viewBox birimi): aynı konumdaki iki sezondan bu sezon kazanır */
const SEASON_TIE_BREAK = 4
const W = 320
const H = 176
/** Hava katmanı açıkken indeks alanının altına eklenen şerit */
const WEATHER_H = 78
const WX = { tempTop: 6, tempBottom: 38, rainTop: 44, rainBottom: 74, rainCapMm: 30 }
const M = { left: 32, right: 10, top: 12, bottom: 24 }

const x = (doy: number, year: number) => M.left + ((doy - 1) / (daysInYear(year) - 1)) * (W - M.left - M.right)
/** Normalize değer (0–1) → y. Her indeks kendi mutlak skalasına göre normalize edilir. */
const y = (norm: number) => M.top + (1 - Math.min(1, Math.max(0, norm))) * (H - M.top - M.bottom)

interface Point {
  indeks: IndexId
  year: number
  tarih: string
  value: number
  bulut: number | null
  px: number
  py: number
}

const norm = (id: IndexId, value: number) => (value - INDEX_DEFS[id].min) / (INDEX_DEFS[id].max - INDEX_DEFS[id].min)

function toPoints(scenes: Scene[], indeks: IndexId, year: number): Point[] {
  return scenes
    .filter((s) => s.durum === 'tamam' && s.indeksler[indeks] && s.tarih.startsWith(String(year)))
    .map((s) => {
      const value = (s.indeksler[indeks] as NonNullable<Scene['indeksler'][IndexId]>).ortalama
      return {
        indeks,
        year,
        tarih: s.tarih,
        value,
        bulut: s.bulutOrani,
        px: x(dayOfYear(s.tarih), year),
        py: y(norm(indeks, value)),
      }
    })
}

const linePath = (points: Point[]) =>
  points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.px.toFixed(1)} ${p.py.toFixed(1)}`).join(' ')

/** Birden fazla indeks aynı grafikte; bu sezon düz, geçen sezon kesikli çizgi; en yakın noktaya tıklayınca tarih seçilir. */
export function IndexChart({
  scenes,
  season,
  active,
  activeDate,
  onToggle,
  onSelect,
  weather,
  weatherLoading = false,
  onWeatherToggle,
}: IndexChartProps) {
  const [hover, setHover] = useState<Point | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const series = useMemo(
    () =>
      active.flatMap((indeks) => [
        { indeks, year: season - 1, dim: true, points: toPoints(scenes, indeks, season - 1) },
        { indeks, year: season, dim: false, points: toPoints(scenes, indeks, season) },
      ]),
    [scenes, active, season],
  )
  const allPoints = useMemo(() => series.flatMap((s) => s.points), [series])

  // Hava katmanı: yalnızca bu sezonun takvim yılındaki günler
  const wx = useMemo(() => {
    const days = (weather ?? []).filter((d) => d.tarih.startsWith(String(season)))
    const means = days.flatMap((d) => (d.min != null && d.max != null ? [(d.min + d.max) / 2] : []))
    const lo = means.length ? Math.floor(Math.min(...means) / 5) * 5 : 0
    const hi = means.length ? Math.ceil(Math.max(...means) / 5) * 5 : 30
    const tempY = (t: number) => H + WX.tempBottom - ((t - lo) / Math.max(1, hi - lo)) * (WX.tempBottom - WX.tempTop)
    const line = days
      .filter((d) => d.min != null && d.max != null)
      .map((d, i) => {
        const mean = ((d.min as number) + (d.max as number)) / 2
        return `${i === 0 ? 'M' : 'L'}${x(dayOfYear(d.tarih), season).toFixed(1)} ${tempY(mean).toFixed(1)}`
      })
      .join(' ')
    const byDate = new Map(days.map((d) => [d.tarih, d]))
    return { days, lo, hi, tempY, line, byDate }
  }, [weather, season])

  const monthStarts = useMemo(
    () => MONTHS_SHORT.map((label, m) => ({ label, px: x(dayOfYear(`${season}-${String(m + 1).padStart(2, '0')}-01`), season) })),
    [season],
  )

  const single = active.length === 1 ? INDEX_DEFS[active[0]] : null
  const ticks = single
    ? [0, 1 / 3, 2 / 3, 1].map((t) => ({ t, label: formatIndexValue(single.id, single.min + (single.max - single.min) * t) }))
    : [0, 1 / 3, 2 / 3, 1].map((t) => ({ t, label: `%${Math.round(t * 100)}` }))

  const activePoints = allPoints.filter((p) => p.tarih === activeDate)
  const shown = hover ?? activePoints[0]
  const empty = allPoints.length === 0

  /** Noktalar (5 günde bir) çok yakın olduğundan tıklama, imlece en yakın noktayı seçer. */
  function nearest(event: React.PointerEvent<SVGRectElement>): Point | null {
    const svg = svgRef.current
    if (!svg || allPoints.length === 0) return null
    const rect = svg.getBoundingClientRect()
    const scale = W / rect.width
    const px = (event.clientX - rect.left) * scale
    const py = (event.clientY - rect.top) * scale
    let best: Point | null = null
    let bestScore = 18
    for (const point of allPoints) {
      // Geçen sezonun noktaları bu sezonun aynı aylarının üstüne biner: eşit uzaklıkta bu sezon seçilir
      const score = Math.hypot(point.px - px, (point.py - py) * 0.6) + (point.year === season ? 0 : SEASON_TIE_BREAK)
      if (score < bestScore) {
        best = point
        bestScore = score
      }
    }
    return best
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1.5" role="group" aria-label="Grafikte gösterilecek indeksler">
        {INDEX_IDS.map((id) => {
          const on = active.includes(id)
          return (
            <button
              key={id}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(id)}
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-app-accent ${
                on ? 'border-app-border bg-app-card-hover text-app-text' : 'border-transparent text-app-text-dim hover:text-app-text-muted'
              }`}
            >
              <i className="h-2 w-2 rounded-full" style={{ background: on ? INDEX_DEFS[id].cizgi : 'var(--color-app-border)' }} aria-hidden />
              {INDEX_DEFS[id].ad}
            </button>
          )
        })}
        <button
          type="button"
          aria-pressed={weather !== null}
          onClick={onWeatherToggle}
          className={`ml-auto flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-app-accent ${
            weather !== null ? 'border-app-border bg-app-card-hover text-app-text' : 'border-transparent text-app-text-dim hover:text-app-text-muted'
          }`}
        >
          <Cloud className="h-3 w-3" aria-hidden />
          Hava katmanı
        </button>
      </div>

      <div className="mb-1 flex min-h-5 items-center justify-between gap-2 text-[11px]">
        <span className="shrink-0 font-medium text-app-text">Zaman grafiği</span>
        <span className="truncate text-right text-app-text-muted" aria-live="polite" data-testid="chart-tooltip">
          {shown
            ? `${INDEX_DEFS[shown.indeks].ad} · ${formatDate(shown.tarih)} · ${formatIndexValue(shown.indeks, shown.value)}${shown.bulut !== null ? ` · bulut %${Math.round(shown.bulut)}` : ''}${shown.year !== season ? ' · geçen sezon' : ''}${weatherNote(wx.byDate.get(shown.tarih))}`
            : ''}
        </span>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H + (weather ? WEATHER_H : 0)}`}
        className="w-full"
        role="img"
        aria-label="İndeks zaman grafiği; tarihlere alttaki şeritten de erişebilirsiniz"
      >
        {ticks.map(({ t, label }) => (
          <g key={t}>
            <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} style={{ stroke: 'var(--color-app-border)' }} strokeWidth={1} />
            <text x={M.left - 6} y={y(t) + 3} textAnchor="end" fontSize={9} style={{ fill: 'var(--color-app-text-dim)' }}>
              {label}
            </text>
          </g>
        ))}
        {monthStarts.map((m) => (
          <text key={m.label} x={m.px + 1} y={H - 8} fontSize={8.5} style={{ fill: 'var(--color-app-text-dim)' }}>
            {m.label}
          </text>
        ))}

        {activePoints.length > 0 && (
          <line
            x1={activePoints[0].px}
            x2={activePoints[0].px}
            y1={M.top}
            y2={weather ? H + WX.rainBottom : H - M.bottom}
            strokeDasharray="2 3"
            strokeWidth={1}
            style={{ stroke: 'var(--color-app-text-muted)' }}
          />
        )}

        {series.map(({ indeks, year, dim, points }) =>
          points.length === 0 ? null : (
            <g key={`${indeks}-${year}`} aria-label={`${INDEX_DEFS[indeks].ad} ${year} sezonu`}>
              <path
                d={linePath(points)}
                fill="none"
                strokeWidth={dim ? 1.4 : 1.9}
                strokeLinejoin="round"
                strokeLinecap="round"
                strokeDasharray={dim ? '4 3' : undefined}
                opacity={dim ? 0.6 : 1}
                style={{ stroke: INDEX_DEFS[indeks].cizgi }}
              />
              {points.map((p) => (
                <circle
                  key={p.tarih}
                  cx={p.px}
                  cy={p.py}
                  r={p.tarih === activeDate ? 4 : 2}
                  opacity={dim && p.tarih !== activeDate ? 0.6 : 1}
                  strokeWidth={1}
                  style={{ fill: p.tarih === activeDate ? 'var(--color-app-text)' : INDEX_DEFS[indeks].cizgi, stroke: 'var(--color-app-panel)' }}
                />
              ))}
            </g>
          ),
        )}

        {weather && (
          <g aria-label="Hava katmanı: günlük yağış ve sıcaklık" data-testid="weather-layer">
            <line x1={M.left} x2={W - M.right} y1={H + WX.rainBottom} y2={H + WX.rainBottom} style={{ stroke: 'var(--color-app-border)' }} strokeWidth={1} />
            {wx.days.map((d) =>
              d.yagisMm && d.yagisMm > 0 ? (
                <rect
                  key={d.tarih}
                  x={x(dayOfYear(d.tarih), season) - 0.9}
                  width={1.8}
                  y={H + WX.rainBottom - (Math.min(d.yagisMm, WX.rainCapMm) / WX.rainCapMm) * (WX.rainBottom - WX.rainTop)}
                  height={(Math.min(d.yagisMm, WX.rainCapMm) / WX.rainCapMm) * (WX.rainBottom - WX.rainTop)}
                  rx={0.6}
                  fill="#60a5fa"
                  opacity={0.85}
                />
              ) : null,
            )}
            <path d={wx.line} fill="none" strokeWidth={1.4} strokeLinejoin="round" style={{ stroke: '#fb923c' }} />
            <text x={M.left - 6} y={wx.tempY(wx.hi) + 3} textAnchor="end" fontSize={8.5} style={{ fill: 'var(--color-app-text-dim)' }}>
              {wx.hi}°
            </text>
            <text x={M.left - 6} y={wx.tempY(wx.lo) + 3} textAnchor="end" fontSize={8.5} style={{ fill: 'var(--color-app-text-dim)' }}>
              {wx.lo}°
            </text>
            <text x={M.left - 6} y={H + WX.rainBottom} textAnchor="end" fontSize={8.5} style={{ fill: 'var(--color-app-text-dim)' }}>
              mm
            </text>
            {wx.days.length === 0 && (
              <text x={W / 2} y={H + WEATHER_H / 2} textAnchor="middle" fontSize={10} style={{ fill: 'var(--color-app-text-dim)' }}>
                {weatherLoading ? 'Hava verisi yükleniyor…' : 'Bu sezon için hava verisi yok'}
              </text>
            )}
          </g>
        )}

        {hover && (
          <circle
            cx={hover.px}
            cy={hover.py}
            r={5.5}
            fill="none"
            strokeWidth={1.5}
            style={{ stroke: 'var(--color-app-text)' }}
          />
        )}

        {/* Tüm grafik alanı: imleç konumundan en yakın noktayı bulur */}
        <rect
          x={M.left}
          y={0}
          width={W - M.left - M.right}
          height={H - M.bottom}
          fill="transparent"
          className="cursor-pointer"
          onPointerMove={(e) => setHover(nearest(e))}
          onPointerLeave={() => setHover(null)}
          onClick={(e) => {
            const point = nearest(e as unknown as React.PointerEvent<SVGRectElement>)
            if (point) onSelect(point.tarih)
          }}
        />

        {empty && (
          <text x={W / 2} y={H / 2} textAnchor="middle" fontSize={11} style={{ fill: 'var(--color-app-text-dim)' }}>
            Bu sezon için görüntü yok
          </text>
        )}
      </svg>

      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-app-text-muted">
        <span className="flex items-center gap-1.5">
          <i className="h-0.5 w-4 rounded bg-app-text-muted" aria-hidden />
          {season} sezonu
        </span>
        <span className="flex items-center gap-1.5">
          <i className="h-0 w-4 border-t-2 border-dashed border-app-text-muted" aria-hidden />
          {season - 1} sezonu
        </span>
        {weather && (
          <>
            <span className="flex items-center gap-1.5">
              <i className="h-2 w-2 rounded-sm bg-blue-400" aria-hidden />
              Günlük yağış
            </span>
            <span className="flex items-center gap-1.5">
              <i className="h-0.5 w-4 rounded" style={{ background: '#fb923c' }} aria-hidden />
              Ortalama sıcaklık
            </span>
          </>
        )}
        {!single && <span className="text-app-text-dim">Çizgiler her indeksin kendi skalasına göre normalize edilir</span>}
      </div>
    </div>
  )
}
