import type { CSSProperties, ReactNode } from 'react'

export type Yon = 'gece' | 'toprak'

/** Tarım ikon ailesi: tek çizgi kalınlığı (1.6), 24 ızgara. Genel ikon kütüphanesi yalnızca kontrollerde kullanılır. */
const GLYPHS: Record<string, string> = {
  yaprak: 'M5 19c0-8.5 5-13.5 14-14.5 0 9.5-5 14.5-13.2 14.5M5 19c3.2-4.3 6.3-7.2 10.5-9',
  limon: 'M3.8 12c0-4 3.6-6.6 8.2-6.6s8.2 2.6 8.2 6.6-3.6 6.6-8.2 6.6S3.8 16 3.8 12zM20.2 12h2.2M1.6 12h2.2',
  tuzak: 'M6.5 4.5h11l-1.2 4H7.7zM7.7 8.5c0 5 1.6 8 4.3 11.5 2.7-3.5 4.3-6.5 4.3-11.5M10.2 12.5h3.6',
  damla: 'M12 3.2c3.9 4.8 6 8 6 11a6 6 0 0 1-12 0c0-3 2.1-6.2 6-11zM9 15.2a3 3 0 0 0 3 3',
  don: 'M12 3v18M4.6 7.5l14.8 9M19.4 7.5l-14.8 9M9.6 4.6 12 7l2.4-2.4M9.6 19.4 12 17l2.4 2.4',
  ilac: 'M8 9.5h7.5V20H8zM10 9.5V6.2h4.2L16.4 4M18.3 5.2h3M18.3 8h3M18.3 10.8h3',
  budama: 'M4.5 19.5l9.2-9.2M9 4.8l10.2 14.7M5 5.6a1.9 1.9 0 1 0 .01 0M14.5 4.3l-1.2 3.2',
  hasat: 'M4 11h16l-1.6 9H5.6zM8 11l3-6.2M16 11l-3-6.2',
  zaman: 'M4 16.5l4-5 3.5 3L16 7l4 5M4 20h16',
  harita: 'M3.5 6.5l5.5-2 6 2 5.5-2v13l-5.5 2-6-2-5.5 2zM9 4.5v13M15 6.5v13',
  uyari: 'M12 4l9 15.5H3zM12 10v4.2M12 16.6v.1',
  bolge: 'M4 8.5L11 4l8 4.2v7.3L12.5 20 4.5 15.5zM11 4v8l8 3.5M4 8.5L11 12',
  ok: 'M9 6l6 6-6 6',
  gunes: 'M12 7.5a4.5 4.5 0 1 0 .01 0M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4',
}

export function Glyph({ name, size = 20, color = 'currentColor', style }: { name: keyof typeof GLYPHS | string; size?: number; color?: string; style?: CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden style={style}>
      <path d={GLYPHS[name] ?? GLYPHS.yaprak} />
    </svg>
  )
}

export const STATUS_COLOR: Record<string, string> = { iyi: 'var(--kc-ok)', izle: 'var(--kc-warn)', dikkat: 'var(--kc-bad)', veri_yok: 'var(--kc-ink3)' }

/** Skor halkası: Gece = yumuşak yay; Toprak = ince çentikli ölçek (cihaz göstergesi). */
export function ScoreRing({ score, status, size = 96, yon, range }: { score: number | null; status: string; size?: number; yon: Yon; range?: string | null }) {
  const color = STATUS_COLOR[status] ?? 'var(--kc-ink3)'
  const r = size / 2 - 7
  const c = 2 * Math.PI * r
  const frac = Math.max(0, Math.min(1, (score ?? 0) / 100))
  const ticks = 48
  return (
    <div style={{ position: 'relative', width: size, height: size, flex: 'none' }} role="img" aria-label={score == null ? 'Skor yok' : `Skor ${range ?? score} / 100`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {yon === 'gece' ? (
          <>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--kc-line)" strokeWidth={7} />
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={7} strokeLinecap="round" strokeDasharray={`${c * frac} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
          </>
        ) : (
          Array.from({ length: ticks }, (_, i) => {
            const a = (i / ticks) * 2 * Math.PI - Math.PI / 2
            const on = i / ticks < frac
            const r1 = size / 2 - 3
            const r2 = size / 2 - (on ? 11 : 8)
            return <line key={i} x1={size / 2 + Math.cos(a) * r1} y1={size / 2 + Math.sin(a) * r1} x2={size / 2 + Math.cos(a) * r2} y2={size / 2 + Math.sin(a) * r2} stroke={on ? color : 'var(--kc-line2)'} strokeWidth={on ? 2.2 : 1.4} />
          })
        )}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
        <div>
          <div className={yon === 'gece' ? 'title num' : 'num'} style={{ fontSize: range ? size * 0.24 : size >= 80 ? size * 0.34 : size * 0.36, fontWeight: 700, lineHeight: 1 }}>
            {range ?? score ?? '—'}
          </div>
          {!range && size >= 80 && <div className="label" style={{ marginTop: 2, fontSize: 9.5 }}>/ 100</div>}
        </div>
      </div>
    </div>
  )
}

export function Spark({ values, width = 92, height = 26, color = 'var(--kc-series)', fill = true }: { values: number[]; width?: number; height?: number; color?: string; fill?: boolean }) {
  if (values.length < 2) return <svg width={width} height={height} aria-hidden />
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const pts = values.map((v, i) => [(i / (values.length - 1)) * width, height - 2 - ((v - min) / span) * (height - 4)] as const)
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('')
  return (
    <svg width={width} height={height} aria-hidden style={{ display: 'block' }}>
      {fill && <path d={`${d}L${width} ${height}L0 ${height}Z`} fill={color} opacity={0.12} />}
      <path d={d} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={2.4} fill={color} />
    </svg>
  )
}

export function Delta({ value, unit = '%', goodWhenUp = true }: { value: number | null; unit?: string; goodWhenUp?: boolean }) {
  if (value == null) return <span className="label">—</span>
  const up = value >= 0
  const good = up === goodWhenUp
  return (
    <span className="num" style={{ fontSize: 12, fontWeight: 700, color: Math.abs(value) < 0.5 ? 'var(--kc-ink3)' : good ? 'var(--kc-ok)' : 'var(--kc-warn)' }}>
      {up ? '▲' : '▼'} {Math.abs(value).toFixed(1).replace('.', ',')}
      {unit}
    </span>
  )
}

export function Section({ label, right, children }: { label: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section style={{ display: 'grid', gap: 8 }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="label">{label}</span>
        {right}
      </header>
      {children}
    </section>
  )
}

export const fmt = (v: number | null | undefined, digits = 2): string => (v == null ? '—' : v.toFixed(digits).replace('.', ','))
