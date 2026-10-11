import { useMemo, useState, type PointerEvent } from 'react'
import { useElementWidth } from '../bahcem/hooks/useElementWidth'
import { daysBetween, formatDate } from '../bahcem/lib/dates'
import { stageShortName } from '../bahcem/lib/phenology'
import { monthTicks, type DateRange } from '../bahcem/lib/seasonAxis'
import { fmt } from './parts'

export interface Pt {
  date: string
  value: number
}
export interface BandIn {
  kod: string
  ad: string
  baslangic: string
  bitis: string
}
export interface Mark {
  date: string
  label: string
}

interface Props {
  height: number
  range: DateRange
  domain: [number, number]
  line: Pt[]
  prev?: Pt[]
  reference?: { value: number; from: string; to: string; label: string }
  bands?: BandIn[]
  rain?: Pt[]
  gdd?: Pt[]
  netDates: string[]
  selected: string | null
  onSelect: (date: string) => void
  marks?: Mark[]
  unitLabel?: string
  lanes?: boolean
}

/** Önizleme zaman grafiği: seri + geçen sezon + çok yıllık referans; fenoloji şeridi; net görüntü noktaları; yağış ve GDD şeritleri; sürüklenebilir işaretçi. */
export function TimeChart({ height, range, domain, line, prev = [], reference, bands = [], rain = [], gdd = [], netDates, selected, onSelect, marks = [], unitLabel = 'Canlılık', lanes = true }: Props) {
  const [boxRef, width] = useElementWidth<HTMLDivElement>(640)
  const [hover, setHover] = useState<string | null>(null)
  const m = { l: 34, r: 12, t: bands.length ? 20 : 8, b: 20 }
  const rainH = lanes && height > 150 ? 26 : 0
  const gddH = lanes && height > 190 ? 26 : 0
  const plotH = height - m.t - m.b - rainH - gddH - (rainH || gddH ? 6 : 0)
  const total = Math.max(1, daysBetween(range.from, range.to))
  const x = (d: string) => m.l + (daysBetween(range.from, d) / total) * (width - m.l - m.r)
  const y = (v: number) => m.t + (1 - (v - domain[0]) / (domain[1] - domain[0])) * plotH
  const path = (pts: Pt[]) => pts.filter((p) => p.date >= range.from && p.date <= range.to).map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)} ${y(p.value).toFixed(1)}`).join('')
  const ticks = useMemo(() => monthTicks(range), [range])
  const step = width < 520 ? 3 : width < 800 ? 2 : 1
  const yTicks = [0, 1, 2, 3].map((i) => domain[0] + ((domain[1] - domain[0]) * i) / 3)
  const dates = useMemo(() => netDates.filter((d) => d >= range.from && d <= range.to), [netDates, range])
  const valueAt = (d: string) => line.find((p) => p.date === d)?.value ?? null
  const near = (clientX: number, el: SVGSVGElement): string | null => {
    const rect = el.getBoundingClientRect()
    const frac = Math.min(1, Math.max(0, (clientX - rect.left - m.l) / (width - m.l - m.r)))
    const target = daysBetween(range.from, range.to) * frac
    let best: string | null = null
    let bestD = Infinity
    for (const d of dates) {
      const diff = Math.abs(daysBetween(range.from, d) - target)
      if (diff < bestD) {
        bestD = diff
        best = d
      }
    }
    return best
  }
  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const d = near(e.clientX, e.currentTarget)
    setHover(d)
    if (e.buttons === 1 && d) onSelect(d)
  }
  const shown = hover ?? selected
  const hv = shown ? valueAt(shown) : null
  const rainMax = Math.max(8, ...rain.map((r) => r.value))
  const gddMax = Math.max(1, ...gdd.map((g) => g.value))
  const lane1 = m.t + plotH + 6
  const lane2 = lane1 + rainH

  return (
    <div ref={boxRef} style={{ width: '100%', height }}>
      <svg width={width} height={height} onPointerMove={onMove} onPointerLeave={() => setHover(null)} onPointerDown={(e) => { const d = near(e.clientX, e.currentTarget); if (d) onSelect(d) }} style={{ display: 'block', touchAction: 'none', cursor: 'crosshair' }} role="img" aria-label={`${unitLabel} zaman grafiği`}>
        {bands.map((b, i) => {
          const x1 = Math.max(m.l, x(b.baslangic))
          const x2 = Math.min(width - m.r, x(b.bitis))
          if (x2 <= x1) return null
          const label = x2 - x1 > stageShortName(b.kod, b.ad).length * 6.4 + 10 ? stageShortName(b.kod, b.ad) : null
          return (
            <g key={b.kod + b.baslangic}>
              <rect x={x1} y={m.t - 16} width={x2 - x1} height={12} fill="var(--kc-s3)" opacity={i % 2 ? 0.55 : 0.9} rx={2}>
                <title>{b.ad}</title>
              </rect>
              {label && <text x={x1 + 5} y={m.t - 7} fontSize={9.5} fontWeight={700} fill="var(--kc-ink3)" style={{ textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</text>}
              <rect x={x1} y={m.t} width={x2 - x1} height={plotH} fill="var(--kc-ink)" opacity={i % 2 ? 0.03 : 0} />
            </g>
          )
        })}
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={m.l} x2={width - m.r} y1={y(t)} y2={y(t)} stroke="var(--kc-line)" strokeWidth={1} />
            <text x={m.l - 6} y={y(t) + 3.5} textAnchor="end" fontSize={10} fill="var(--kc-ink3)" className="num">{fmt(t, 2)}</text>
          </g>
        ))}
        {reference && (
          <g>
            <rect x={Math.max(m.l, x(reference.from))} y={y(reference.value) - 9} width={Math.max(0, Math.min(width - m.r, x(reference.to)) - Math.max(m.l, x(reference.from)))} height={18} fill="var(--kc-band)" />
            <line x1={Math.max(m.l, x(reference.from))} x2={Math.min(width - m.r, x(reference.to))} y1={y(reference.value)} y2={y(reference.value)} stroke="var(--kc-ink2)" strokeDasharray="2 3" />
            <text x={Math.max(m.l, x(reference.from)) + 4} y={y(reference.value) - 12} fontSize={10} fill="var(--kc-ink2)" fontWeight={600}>{reference.label}</text>
          </g>
        )}
        {prev.length > 1 && <path d={path(prev)} fill="none" stroke="var(--kc-prev)" strokeWidth={1.4} strokeDasharray="4 4" />}
        <path d={path(line)} fill="none" stroke="var(--kc-series)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {dates.map((d) => {
          const v = valueAt(d)
          return v == null ? null : <circle key={d} cx={x(d)} cy={y(v)} r={d === selected ? 0 : 2.3} fill="var(--kc-bg)" stroke="var(--kc-series)" strokeWidth={1.3} />
        })}
        {marks.map((mk) => (
          <g key={mk.date}>
            <line x1={x(mk.date)} x2={x(mk.date)} y1={m.t} y2={m.t + plotH} stroke="var(--kc-water)" strokeDasharray="2 2" opacity={0.8} />
            <text x={x(mk.date) + 4} y={m.t + 11} fontSize={10} fill="var(--kc-water)" fontWeight={700}>{mk.label}</text>
          </g>
        ))}
        {rainH > 0 && (
          <g>
            <text x={m.l - 6} y={lane1 + 10} textAnchor="end" fontSize={9} fill="var(--kc-ink3)">mm</text>
            {rain.filter((r) => r.date >= range.from && r.date <= range.to && r.value > 0).map((r) => (
              <rect key={r.date} x={x(r.date) - 0.8} width={1.6} y={lane1 + rainH - (r.value / rainMax) * rainH} height={(r.value / rainMax) * rainH} fill="var(--kc-water)" opacity={0.85} />
            ))}
          </g>
        )}
        {gddH > 0 && (
          <g>
            <text x={m.l - 6} y={lane2 + 10} textAnchor="end" fontSize={9} fill="var(--kc-ink3)">GDD</text>
            <path d={gdd.filter((g) => g.date >= range.from && g.date <= range.to).map((g, i) => `${i ? 'L' : 'M'}${x(g.date).toFixed(1)} ${(lane2 + gddH - (g.value / gddMax) * gddH).toFixed(1)}`).join('')} fill="none" stroke="var(--kc-warn)" strokeWidth={1.4} />
          </g>
        )}
        {ticks.filter((_, i) => i % step === 0).map((t) => (
          <text key={t.date} x={x(t.date) + 2} y={height - 5} fontSize={10} fill="var(--kc-ink3)" className="num">{t.label}{t.year ? ` ’${String(t.year).slice(2)}` : ''}</text>
        ))}
        {shown && (
          <g>
            <line x1={x(shown)} x2={x(shown)} y1={m.t - (bands.length ? 4 : 0)} y2={height - m.b} stroke={hover && hover !== selected ? 'var(--kc-ink2)' : 'var(--kc-lemon)'} strokeWidth={1.5} />
            {hv != null && <circle cx={x(shown)} cy={y(hv)} r={5} fill="var(--kc-lemon)" stroke="var(--kc-bg)" strokeWidth={2} />}
            {hv != null && (
              <g transform={`translate(${Math.min(width - 128, Math.max(m.l + 4, x(shown) + 10))} ${Math.max(m.t + 2, y(hv) - 44)})`}>
                <rect width={116} height={38} rx={6} fill="var(--kc-s2)" stroke="var(--kc-line2)" />
                <text x={10} y={15} fontSize={10.5} fill="var(--kc-ink2)" fontWeight={600}>{formatDate(shown)}</text>
                <text x={10} y={31} fontSize={13} fill="var(--kc-ink)" fontWeight={700} className="num">{unitLabel} {fmt(hv, 2)}</text>
              </g>
            )}
          </g>
        )}
      </svg>
    </div>
  )
}
