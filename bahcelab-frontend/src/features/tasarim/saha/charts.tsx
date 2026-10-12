import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { useElementWidth } from '../../bahcem/hooks/useElementWidth'
import { daysBetween, formatDayMonth, shiftDays, weekdayIndex } from '../../bahcem/lib/dates'
import { stageShortName } from '../../bahcem/lib/phenology'
import { monthTicks, type DateRange } from '../../bahcem/lib/seasonAxis'
import { paintGrid, type PGrid } from './grids'
import { rampCss } from './palette'

export interface Pt { date: string; value: number }
export interface Stage { kod: string; ad: string; baslangic: string; bitis: string }
export const f2 = (v: number | null | undefined, d = 2): string => (v == null || !Number.isFinite(v) ? '—' : v.toFixed(d).replace('.', ','))

/** Izgara tuvali (küçük çoklu haritalar, yıl haritaları): hepsi aynı alan ve aynı skala. */
export function GridCanvas({ grid, domain, scale = 4, contourStep = null, weak = null, label, sub, marked = false, dim = false, ring = null }: { grid: PGrid; domain: [number, number]; scale?: number; contourStep?: number | null; weak?: number | null; label?: string; sub?: string; marked?: boolean; dim?: boolean; ring?: number[][] | null }) {
  const host = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const c = paintGrid(grid, { domain, scale, contourStep, weak, clip: ring })
    c.style.cssText = 'width:100%;height:100%;object-fit:contain;image-rendering:pixelated;display:block'
    host.current?.replaceChildren(c)
  }, [grid, domain, scale, contourStep, weak, ring])
  return (
    <figure style={{ margin: 0, display: 'grid', gap: 4, opacity: dim ? 0.5 : 1 }}>
      <div ref={host} style={{ aspectRatio: '1 / 1.1', background: 'var(--paper-2)', border: `1px solid ${marked ? 'var(--ink)' : 'var(--rule)'}`, outline: marked ? '1px solid var(--ink)' : 'none', outlineOffset: 2 }} />
      {label && (
        <figcaption style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
          <span className="mono" style={{ fontWeight: 600 }}>{label}</span>
          <span className="mono" style={{ color: 'var(--ink-3)' }}>{sub}</span>
        </figcaption>
      )}
    </figure>
  )
}

// ----------------------------------------------------------------------------- Limon yılı çarkı
const TAU = Math.PI * 2
const pol = (cx: number, cy: number, r: number, a: number): [number, number] => [cx + Math.cos(a) * r, cy + Math.sin(a) * r]
function arc(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number): string {
  const [x0, y0] = pol(cx, cy, r1, a0)
  const [x1, y1] = pol(cx, cy, r1, a1)
  const [x2, y2] = pol(cx, cy, r0, a1)
  const [x3, y3] = pol(cx, cy, r0, a0)
  const large = a1 - a0 > Math.PI ? 1 : 0
  return `M${x0} ${y0}A${r1} ${r1} 0 ${large} 1 ${x1} ${y1}L${x2} ${y2}A${r0} ${r0} 0 ${large} 0 ${x3} ${y3}Z`
}

/** Radyal yıl grafiği: dışta fenoloji evreleri, ortada canlılık (her gün bir dilim), içte yağış çubukları; «bugün» işareti tepede. Son 12 ay. */
export function YearWheel({ size = 188, today, ndvi, rain, stages, center }: { size?: number; today: string; ndvi: Pt[]; rain: Pt[]; stages: Stage[]; center: { value: string; unit?: string; note?: string } }) {
  const start = shiftDays(today, -364)
  const R = size / 2
  const cx = R
  const cy = R
  const ang = (d: string): number => (daysBetween(start, d) / 365) * TAU - Math.PI / 2
  const rs = { stage: [R * 0.8, R * 0.9], ndvi: [R * 0.6, R * 0.78], rain: [R * 0.5, R * 0.6] }
  const wedges = useMemo(() => {
    const out: { d: string; v: number }[] = []
    for (let i = 0; i < 365; i++) {
      const d = shiftDays(start, i)
      const before = [...ndvi].reverse().find((p) => p.date <= d)
      const after = ndvi.find((p) => p.date >= d)
      if (!before || !after) continue
      const gap = daysBetween(before.date, after.date)
      if (gap > 45) continue
      const t = gap === 0 ? 0 : daysBetween(before.date, d) / gap
      out.push({ d, v: before.value + (after.value - before.value) * t })
    }
    return out
  }, [ndvi, start])
  const lo = Math.min(...ndvi.map((p) => p.value))
  const hi = Math.max(...ndvi.map((p) => p.value))
  const rainBy = new Map(rain.map((r) => [r.date, r.value]))
  const ticks = monthTicks({ from: start, to: today })
  const segs = stages
    .map((s) => ({ ...s, a0: ang(s.baslangic < start ? start : s.baslangic), a1: ang(s.bitis > today ? today : s.bitis) }))
    .filter((s) => s.bitis >= start && s.baslangic <= today)
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Son 12 ayın radyal grafiği: evreler, canlılık, yağış">
      <defs>{segs.map((s, i) => { const rm = (rs.stage[0] + rs.stage[1]) / 2; const [x0, y0] = pol(cx, cy, rm, s.a0); const [x1, y1] = pol(cx, cy, rm, s.a1); return <path key={i} id={`wl${i}`} d={`M${x0} ${y0}A${rm} ${rm} 0 ${s.a1 - s.a0 > Math.PI ? 1 : 0} 1 ${x1} ${y1}`} /> })}</defs>
      {segs.map((s, i) => (
        <g key={s.kod + s.baslangic}>
          <path d={arc(cx, cy, rs.stage[0], rs.stage[1], s.a0, s.a1)} fill={i % 2 ? 'var(--paper-3)' : 'var(--paper-2)'} stroke="var(--ink)" strokeWidth={0.7} />
          {(s.a1 - s.a0) * ((rs.stage[0] + rs.stage[1]) / 2) > stageShortName(s.kod, s.ad).length * 5.4 + 6 && (
            <text fontSize={8} fontWeight={600} fill="var(--ink-2)" letterSpacing=".06em" style={{ textTransform: 'uppercase' }}><textPath href={`#wl${i}`} startOffset="50%" textAnchor="middle" dominantBaseline="central">{stageShortName(s.kod, s.ad)}</textPath></text>
          )}
        </g>
      ))}
      {wedges.map(({ d, v }) => <path key={d} d={arc(cx, cy, rs.ndvi[0], rs.ndvi[1], ang(d), ang(d) + TAU / 365 + 0.004)} fill={rampCss((v - lo) / (hi - lo || 1))} />)}
      <circle cx={cx} cy={cy} r={rs.ndvi[0]} fill="none" stroke="var(--ink)" strokeWidth={0.5} />
      <circle cx={cx} cy={cy} r={rs.ndvi[1]} fill="none" stroke="var(--ink)" strokeWidth={0.5} />
      {Array.from({ length: 365 }, (_, i) => {
        const d = shiftDays(start, i)
        const mm = rainBy.get(d) ?? 0
        if (mm <= 0.2) return null
        const h = (rs.rain[1] - rs.rain[0]) * Math.min(1, mm / 25)
        const a = ang(d)
        const [x0, y0] = pol(cx, cy, rs.rain[0], a)
        const [x1, y1] = pol(cx, cy, rs.rain[0] + h, a)
        return <line key={d} x1={x0} y1={y0} x2={x1} y2={y1} stroke="#2a78d6" strokeWidth={1.3} />
      })}
      {ticks.map((t) => {
        const a = ang(t.date)
        const [x0, y0] = pol(cx, cy, R * 0.9, a)
        const [x1, y1] = pol(cx, cy, R * 0.95, a)
        const [lx, ly] = pol(cx, cy, R * 0.985, a + 0.11)
        return (
          <g key={t.date}>
            <line x1={x0} y1={y0} x2={x1} y2={y1} stroke="var(--ink)" strokeWidth={0.7} />
            <text x={lx} y={ly} fontSize={7.5} fontFamily="var(--font-mono)" fill="var(--ink-3)" textAnchor="middle" dominantBaseline="central">{t.label[0]}</text>
          </g>
        )
      })}
      <line x1={cx} y1={cy - R * 0.5} x2={cx} y2={R * 0.03} stroke="var(--ink)" strokeWidth={1.4} />
      <path d={`M${cx - 3.5} ${R * 0.03 + 5}L${cx} ${R * 0.03}L${cx + 3.5} ${R * 0.03 + 5}`} fill="none" stroke="var(--ink)" strokeWidth={1.4} />
      <text x={cx} y={cy - 6} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={size * 0.19} fontWeight={500} letterSpacing="-0.04em" fill="var(--ink)">{center.value}</text>
      <text x={cx} y={cy + 9} textAnchor="middle" fontSize={9.5} fill="var(--ink-3)">{center.unit}</text>
      {center.note && <text x={cx} y={cy + 21} textAnchor="middle" fontSize={8.5} fill="var(--ink-3)">{center.note}</text>}
    </svg>
  )
}

// ----------------------------------------------------------------------------- Takvim ısı haritası
export interface DayVal { date: string; value: number | null }
/** 53 hafta × 7 gün; tek değişken, tek renk skalası; isteğe bağlı net uydu günü işareti. Ölçek ve etiketler doğrudan çizimde. */
export function CalendarStrip({ title, unit, days, from, to, color, domain, marks = [], width = 700 }: { title: string; unit: string; days: DayVal[]; from: string; to: string; color: (t: number) => string; domain: [number, number]; marks?: string[]; width?: number }) {
  const cell = (width - 44) / 54
  const by = new Map(days.map((d) => [d.date, d.value]))
  const wd0 = (weekdayIndex(from) + 6) % 7 // Pazartesi = 0
  const total = daysBetween(from, to) + 1
  const weeks = Math.ceil((total + wd0) / 7)
  const mset = new Set(marks)
  const ticks = monthTicks({ from, to })
  return (
    <figure style={{ margin: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontWeight: 600, fontSize: 12.5 }}>{title}</span>
        <span className="mono" style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>{f2(domain[0], 0)}–{f2(domain[1], 0)} {unit}</span>
      </div>
      <svg width={width} height={cell * 7 + 18} role="img" aria-label={title}>
        {ticks.map((t) => {
          const i = daysBetween(from, t.date) + wd0
          return <text key={t.date} x={44 + Math.floor(i / 7) * cell} y={9} fontSize={9.5} fontFamily="var(--font-mono)" fill="var(--ink-3)">{t.label}</text>
        })}
        {['Pzt', 'Çar', 'Cum'].map((n, k) => <text key={n} x={0} y={18 + cell * (k * 2) + cell * 0.75} fontSize={9} fill="var(--ink-3)">{n}</text>)}
        {Array.from({ length: total }, (_, i) => {
          const date = shiftDays(from, i)
          const v = by.get(date) ?? null
          const col = Math.floor((i + wd0) / 7)
          const row = (i + wd0) % 7
          const x = 44 + col * cell
          const y = 14 + row * cell
          return (
            <g key={date}>
              <rect x={x} y={y} width={cell - 1.5} height={cell - 1.5} fill={v == null ? 'var(--paper-3)' : color((v - domain[0]) / (domain[1] - domain[0] || 1))} stroke="var(--rule)" strokeWidth={0.4}>
                <title>{formatDayMonth(date)}: {v == null ? 'veri yok' : `${f2(v, 1)} ${unit}`}</title>
              </rect>
              {mset.has(date) && <circle cx={x + (cell - 1.5) / 2} cy={y + (cell - 1.5) / 2} r={cell * 0.11} fill="var(--ink)" />}
            </g>
          )
        })}
        {void weeks}
      </svg>
    </figure>
  )
}

// ----------------------------------------------------------------------------- Ridgeline
export interface YearDist { yil: number; values: number[]; flagged?: boolean; note?: string }
function density(values: number[], lo: number, hi: number, bins = 64): number[] {
  const h = new Array<number>(bins).fill(0)
  values.forEach((v) => { const i = Math.min(bins - 1, Math.max(0, Math.floor(((v - lo) / (hi - lo)) * bins))); h[i]++ })
  const k = [1, 4, 7, 4, 1].map((x) => x / 17)
  const out = h.map((_, i) => k.reduce((a, w, j) => a + w * (h[i + j - 2] ?? 0), 0))
  const n = values.length || 1
  return out.map((x) => x / n)
}
/** Yıl yıl bahçe canlılık dağılımı; ortak x ekseni, ortak yükseklik ölçeği; uyumsuz yıllar kesikli + etiketli. */
export function Ridgeline({ years, domain, width = 700, rowH = 30, overlap = 1.9 }: { years: YearDist[]; domain: [number, number]; width?: number; rowH?: number; overlap?: number }) {
  const m = { l: 44, r: 70, t: 8, b: 22 }
  const dens = years.map((y) => density(y.values, domain[0], domain[1]))
  const peak = Math.max(...dens.flat(), 1e-6)
  const h = m.t + m.b + rowH * (years.length - 1) + rowH * overlap
  const x = (v: number) => m.l + ((v - domain[0]) / (domain[1] - domain[0])) * (width - m.l - m.r)
  const ticks = [0, 1, 2, 3, 4].map((i) => domain[0] + ((domain[1] - domain[0]) * i) / 4)
  return (
    <svg width={width} height={h} role="img" aria-label="Yıl yıl canlılık dağılımı (ridgeline)">
      {ticks.map((t) => <g key={t}><line x1={x(t)} x2={x(t)} y1={m.t} y2={h - m.b} stroke="var(--rule)" strokeWidth={0.6} /><text x={x(t)} y={h - 8} textAnchor="middle" fontSize={9.5} fontFamily="var(--font-mono)" fill="var(--ink-3)">{f2(t, 2)}</text></g>)}
      {years.map((y, i) => {
        const base = m.t + rowH * overlap + i * rowH
        const d = dens[i]
        const bw = (width - m.l - m.r) / d.length
        const pts = d.map((v, k) => `${m.l + k * bw + bw / 2},${base - (v / peak) * rowH * overlap}`)
        const med = [...y.values].sort((a, b) => a - b)[Math.floor(y.values.length / 2)]
        return (
          <g key={y.yil}>
            <path d={`M${m.l},${base}L${pts.join('L')}L${width - m.r},${base}Z`} fill="var(--paper)" fillOpacity={0.94} />
            <path d={`M${pts.join('L')}`} fill="none" stroke="var(--ink)" strokeWidth={y.flagged ? 1 : 1.3} strokeDasharray={y.flagged ? '3 2' : undefined} />
            <line x1={m.l} x2={width - m.r} y1={base} y2={base} stroke="var(--rule-2)" strokeWidth={0.5} />
            <line x1={x(med)} x2={x(med)} y1={base} y2={base - rowH * 0.5} stroke="var(--ink)" strokeWidth={1} />
            <text x={m.l - 8} y={base} textAnchor="end" fontSize={11} fontFamily="var(--font-mono)" fontWeight={600} fill="var(--ink)">{y.yil}</text>
            <text x={width - m.r + 8} y={base} fontSize={10.5} fontFamily="var(--font-mono)" fill={y.flagged ? 'var(--st-izle)' : 'var(--ink-3)'}>{f2(med)}{y.flagged ? ' ▲ uyumsuz' : ''}</text>
          </g>
        )
      })}
    </svg>
  )
}

// ----------------------------------------------------------------------------- Eğim (bu sezon vs geçen sezon)
export interface SlopeRow { label: string; prev: number | null; now: number | null; unit: string; digits?: number; goodUp?: boolean }
/** Her gösterge kendi ölçeğinde: geçen sezon (içi boş) → bu sezon (dolu); uç etiketleri doğrudan, değişim sağda. */
export function SlopeRows({ rows, width = 520 }: { rows: SlopeRow[]; width?: number }) {
  const L = 130
  const R = 86
  return (
    <div role="img" aria-label="Bu sezon ve geçen sezon karşılaştırması">
      <div style={{ display: 'grid', gridTemplateColumns: `${L}px 1fr ${R}px`, fontSize: 10.5 }} className="eyebrow">
        <span /><div style={{ display: 'flex', justifyContent: 'space-between' }}><span>○ Geçen sezon</span><span>● Bu sezon</span></div><span style={{ textAlign: 'right' }}>Fark</span>
      </div>
      {rows.map((r) => {
        const has = r.prev != null && r.now != null
        const hi = has ? Math.max(r.prev!, r.now!) : 1
        const lo = has ? Math.min(r.prev!, r.now!) : 0
        const pad = (hi - lo || Math.abs(hi) * 0.1 || 1) * 0.9
        const sx = (v: number) => ((v - (lo - pad)) / (hi + pad - (lo - pad))) * (width - L - R)
        const pct = has && r.prev !== 0 ? ((r.now! - r.prev!) / Math.abs(r.prev!)) * 100 : null
        return (
          <div key={r.label} style={{ display: 'grid', gridTemplateColumns: `${L}px 1fr ${R}px`, alignItems: 'center', height: 40, borderBottom: '1px solid var(--rule)' }}>
            <span style={{ fontSize: 12.5, fontWeight: 600 }}>{r.label}</span>
            <svg width={width - L - R} height={40}>
              {has ? (
                <g>
                  <line x1={sx(r.prev!)} x2={sx(r.now!)} y1={20} y2={20} stroke="var(--ink)" strokeWidth={1.6} />
                  <circle cx={sx(r.prev!)} cy={20} r={5} fill="var(--paper)" stroke="var(--ink)" strokeWidth={1.4} />
                  <circle cx={sx(r.now!)} cy={20} r={5} fill="var(--ink)" />
                  <text x={sx(r.prev!)} y={9} textAnchor="middle" fontSize={10.5} fontFamily="var(--font-mono)" fill="var(--ink-3)">{f2(r.prev, r.digits ?? 2)}</text>
                  <text x={sx(r.now!)} y={36} textAnchor="middle" fontSize={11} fontWeight={600} fontFamily="var(--font-mono)" fill="var(--ink)">{f2(r.now, r.digits ?? 2)}</text>
                </g>
              ) : (
                <text x={0} y={24} fontSize={11} fill="var(--ink-3)">geçen yıl verisi yok</text>
              )}
            </svg>
            <span className="mono" style={{ textAlign: 'right', fontSize: 12, fontWeight: 600, color: pct == null || Math.abs(pct) < 1 ? 'var(--ink-3)' : (pct > 0) === (r.goodUp ?? true) ? 'var(--ink)' : 'var(--st-izle)' }}>{pct == null ? '—' : `${pct > 0 ? '+' : '−'}%${Math.abs(pct).toFixed(0)}`}</span>
          </div>
        )
      })}
    </div>
  )
}

// ----------------------------------------------------------------------------- Zaman dok'u grafiği
export interface DockProps {
  height: number
  range: DateRange
  line: Pt[]
  stages: Stage[]
  rain: Pt[]
  netDates: string[]
  selected: string | null
  onSelect: (date: string) => void
  marks?: { date: string; label: string }[]
  label: string
  prev?: Pt[]
}
/** İnce çizgi + fenoloji şeridi + yağış çubukları; net görüntü günleri kare nokta; seçili tarih limon işaretçi; uç etiketi doğrudan. */
export function DockChart({ height, range, line, stages, rain, netDates, selected, onSelect, marks = [], label, prev = [] }: DockProps) {
  const [boxRef, width] = useElementWidth<HTMLDivElement>(640)
  const [hover, setHover] = useState<string | null>(null)
  const m = { l: 36, r: 96, t: 22, b: 18 }
  const rainH = height > 150 ? 22 : 0
  const plotH = height - m.t - m.b - rainH - (rainH ? 6 : 0)
  const total = Math.max(1, daysBetween(range.from, range.to))
  const x = (d: string) => m.l + (daysBetween(range.from, d) / total) * (width - m.l - m.r)
  const vals = line.map((p) => p.value)
  const lo = Math.min(...vals)
  const hi = Math.max(...vals)
  const pad = Math.max(0.03, (hi - lo) * 0.2)
  const dom: [number, number] = [Math.floor((lo - pad) * 50) / 50, Math.ceil((hi + pad) * 50) / 50]
  const y = (v: number) => m.t + (1 - (v - dom[0]) / (dom[1] - dom[0])) * plotH
  const path = (pts: Pt[]) => pts.filter((p) => p.date >= range.from && p.date <= range.to).map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)} ${y(p.value).toFixed(1)}`).join('')
  const dates = netDates.filter((d) => d >= range.from && d <= range.to)
  const near = (cx: number, el: SVGSVGElement): string | null => {
    const frac = (cx - el.getBoundingClientRect().left - m.l) / (width - m.l - m.r)
    const target = total * Math.min(1, Math.max(0, frac))
    return dates.reduce<string | null>((best, d) => (best === null || Math.abs(daysBetween(range.from, d) - target) < Math.abs(daysBetween(range.from, best) - target) ? d : best), null)
  }
  const onMove = (e: PointerEvent<SVGSVGElement>) => { const d = near(e.clientX, e.currentTarget); setHover(d); if (e.buttons === 1 && d) onSelect(d) }
  const shown = hover ?? selected
  const sv = shown ? line.find((p) => p.date === shown)?.value : undefined
  const yt = [0, 1, 2].map((i) => dom[0] + ((dom[1] - dom[0]) * i) / 2)
  const rainMax = Math.max(10, ...rain.map((r) => r.value))
  const last = line[line.length - 1]
  const step = width < 520 ? 3 : width < 760 ? 2 : 1
  return (
    <div ref={boxRef} style={{ width: '100%', height }}>
      <svg width={width} height={height} onPointerMove={onMove} onPointerLeave={() => setHover(null)} onPointerDown={(e) => { const d = near(e.clientX, e.currentTarget); if (d) onSelect(d) }} style={{ display: 'block', touchAction: 'none', cursor: 'crosshair' }} role="img" aria-label={`${label} zaman grafiği`}>
        {stages.map((s, i) => {
          const x1 = Math.max(m.l, x(s.baslangic))
          const x2 = Math.min(width - m.r, x(s.bitis))
          if (x2 <= x1) return null
          const txt = stageShortName(s.kod, s.ad)
          return (
            <g key={s.kod + s.baslangic}>
              <rect x={x1} y={4} width={x2 - x1} height={11} fill={i % 2 ? 'var(--paper-3)' : 'var(--paper-2)'} stroke="var(--rule-2)" strokeWidth={0.5}><title>{s.ad}</title></rect>
              {x2 - x1 > txt.length * 6.2 + 8 && <text x={x1 + 4} y={12.5} fontSize={8.5} fontWeight={600} fill="var(--ink-2)" letterSpacing=".06em" style={{ textTransform: 'uppercase' }}>{txt}</text>}
              {i > 0 && <line x1={x1} x2={x1} y1={m.t} y2={m.t + plotH} stroke="var(--rule)" strokeWidth={0.6} strokeDasharray="1 3" />}
            </g>
          )
        })}
        {yt.map((t) => <g key={t}><line x1={m.l} x2={width - m.r} y1={y(t)} y2={y(t)} stroke="var(--rule)" strokeWidth={0.6} /><text x={m.l - 6} y={y(t) + 3.5} textAnchor="end" fontSize={9.5} fontFamily="var(--font-mono)" fill="var(--ink-3)">{f2(t, 2)}</text></g>)}
        {prev.length > 1 && <path d={path(prev)} fill="none" stroke="var(--ink-3)" strokeWidth={1} strokeDasharray="2 3" />}
        <path d={path(line)} fill="none" stroke="var(--ink)" strokeWidth={1.4} strokeLinejoin="round" />
        {dates.map((d) => { const v = line.find((p) => p.date === d)?.value; return v == null ? null : <rect key={d} x={x(d) - 2} y={y(v) - 2} width={4} height={4} fill="var(--paper)" stroke="var(--ink)" strokeWidth={1} /> })}
        {marks.map((mk) => <g key={mk.date}><line x1={x(mk.date)} x2={x(mk.date)} y1={m.t} y2={m.t + plotH} stroke="var(--ink)" strokeWidth={0.8} strokeDasharray="2 2" /><text x={x(mk.date) + 3} y={m.t + 9} fontSize={9.5} fontFamily="var(--font-mono)" fill="var(--ink)">{mk.label}</text></g>)}
        {last && <text x={x(last.date) + 8} y={y(last.value) + 3.5} fontSize={11} fontWeight={600} fill="var(--ink)">{label} <tspan fontFamily="var(--font-mono)">{f2(last.value)}</tspan></text>}
        {rainH > 0 && (
          <g>
            <text x={m.l - 6} y={m.t + plotH + 6 + rainH - 2} textAnchor="end" fontSize={9} fill="var(--ink-3)">mm</text>
            {rain.filter((r) => r.date >= range.from && r.date <= range.to && r.value > 0.2).map((r) => <rect key={r.date} x={x(r.date) - 0.8} width={1.6} y={m.t + plotH + 6 + rainH - (r.value / rainMax) * rainH} height={(r.value / rainMax) * rainH} fill="#2a78d6" />)}
          </g>
        )}
        {monthTicks(range).filter((_, i) => i % step === 0).map((t) => <text key={t.date} x={x(t.date) + 2} y={height - 4} fontSize={9.5} fontFamily="var(--font-mono)" fill="var(--ink-3)">{t.label}{t.year ? ` ’${String(t.year).slice(2)}` : ''}</text>)}
        {shown && (
          <g>
            <line x1={x(shown)} x2={x(shown)} y1={m.t - 4} y2={height - m.b} stroke={hover && hover !== selected ? 'var(--ink-3)' : 'var(--lemon)'} strokeWidth={hover && hover !== selected ? 1 : 2.5} />
            {sv != null && <circle cx={x(shown)} cy={y(sv)} r={4.5} fill="var(--lemon)" stroke="var(--ink)" strokeWidth={1.2} />}
            {sv != null && (
              <g transform={`translate(${Math.min(width - m.r - 110, Math.max(m.l + 4, x(shown) + 10))} ${Math.max(m.t, y(sv) - 38)})`}>
                <rect width={104} height={32} fill="var(--paper)" stroke="var(--ink)" />
                <text x={8} y={13} fontSize={10} fill="var(--ink-3)" fontFamily="var(--font-mono)">{formatDayMonth(shown)}</text>
                <text x={8} y={27} fontSize={13} fontWeight={600} fontFamily="var(--font-mono)" fill="var(--ink)">{f2(sv)}</text>
              </g>
            )}
          </g>
        )}
      </svg>
    </div>
  )
}
