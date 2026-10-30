import { ICONS, type IconName } from './ikonYollari'
import type { CSSProperties, ReactNode } from 'react'


export function Icon({ name, size = 20, color = 'currentColor', weight = 1.5, style }: { name: IconName; size?: number; color?: string; weight?: number; style?: CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={weight} strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flex: 'none', ...style }}>
      <path d={ICONS[name]} />
    </svg>
  )
}

// ----------------------------------------------------------------------------- botanik gravürler
const INK = 'var(--ink)'

/** Eğri yaprak: uzunluk L, genişlik W; orta damar + yan damarlar (gravür hatları). */
function Leaf({ x, y, a, L = 70, W = 22, veins = 7 }: { x: number; y: number; a: number; L?: number; W?: number; veins?: number }) {
  const outline = `M0 0C${L * 0.25} ${-W} ${L * 0.75} ${-W * 0.9} ${L} 0C${L * 0.75} ${W * 0.9} ${L * 0.25} ${W} 0 0Z`
  return (
    <g transform={`translate(${x} ${y}) rotate(${a})`} fill="none" stroke={INK} strokeWidth={1} strokeLinejoin="round">
      <path d={outline} fill="var(--paper)" />
      <path d={`M0 0Q${L * 0.5} ${-2} ${L} 0`} strokeWidth={1.2} />
      {Array.from({ length: veins }, (_, i) => {
        const t = (i + 1) / (veins + 1)
        const px = L * t
        const w = W * 0.78 * Math.sin(Math.PI * t) * 0.95
        return (
          <g key={i} strokeWidth={0.6}>
            <path d={`M${px} -1Q${px + L * 0.07} ${-w * 0.55} ${px + L * 0.14} ${-w}`} />
            <path d={`M${px} 1Q${px + L * 0.07} ${w * 0.55} ${px + L * 0.14} ${w}`} />
          </g>
        )
      })}
      {/* yarım yaprak gölge taraması */}
      {Array.from({ length: 9 }, (_, i) => {
        const t = 0.12 + i * 0.09
        return <path key={`h${i}`} d={`M${L * t} ${W * 0.12}l${L * 0.05} ${W * 0.55 * Math.sin(Math.PI * t)}`} strokeWidth={0.35} />
      })}
    </g>
  )
}

function Lemon({ cx, cy, r = 30, tilt = -15 }: { cx: number; cy: number; r?: number; tilt?: number }) {
  const w = r * 1.25
  const body = `M${-w} 0C${-w} ${-r * 1.05} ${w} ${-r * 1.05} ${w} 0C${w} ${r * 1.05} ${-w} ${r * 1.05} ${-w} 0Z`
  return (
    <g transform={`translate(${cx} ${cy}) rotate(${tilt})`} fill="none" stroke={INK} strokeWidth={1}>
      <path d={body} fill="var(--paper)" />
      <path d={`M${w} 0c6 -1 9 -1 12 0M${-w} 0c-5 1 -7 1 -9 0`} />
      {/* kabuk gözenekleri ve gölge taraması */}
      {Array.from({ length: 22 }, (_, i) => {
        const a = (i / 22) * Math.PI * 2
        return <path key={i} d={`M${Math.cos(a) * w * 0.55} ${Math.sin(a) * r * 0.6 + 8}l1.6 1.6`} strokeWidth={0.5} />
      })}
      {Array.from({ length: 14 }, (_, i) => (
        <path key={`s${i}`} d={`M${-w * 0.85 + i * 4.5} ${r * 0.75 - Math.abs(i - 7) * 1.2}l${5} ${-4}`} strokeWidth={0.4} />
      ))}
    </g>
  )
}

export function IllLimonDali({ size = 220 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.78} viewBox="0 0 300 234" fill="none" role="img" aria-label="Limon dalı gravürü">
      <path d="M10 210C70 190 120 150 175 110S250 45 290 28" stroke={INK} strokeWidth={1.6} />
      <path d="M10 214C70 194 120 154 175 114" stroke={INK} strokeWidth={0.6} />
      <Leaf x={92} y={168} a={-52} L={78} W={24} />
      <Leaf x={120} y={150} a={34} L={72} W={22} />
      <Leaf x={186} y={104} a={-60} L={74} W={23} />
      <Leaf x={206} y={90} a={22} L={64} W={20} />
      <path d="M150 128C150 140 152 150 156 158" stroke={INK} strokeWidth={1} />
      <Lemon cx={160} cy={185} r={26} tilt={-24} />
      <path d="M232 62C236 78 238 88 236 98" stroke={INK} strokeWidth={1} />
      <Lemon cx={236} cy={124} r={20} tilt={-70} />
    </svg>
  )
}

export function IllCicek({ size = 160 }: { size?: number }) {
  const petals = 5
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" fill="none" stroke={INK} strokeWidth={1} role="img" aria-label="Limon çiçeği gravürü">
      {Array.from({ length: petals }, (_, i) => (
        <g key={i} transform={`translate(100 100) rotate(${(i * 360) / petals - 90})`}>
          <path d="M0 0C18 -14 50 -14 66 0C50 14 18 14 0 0Z" fill="var(--paper)" />
          <path d="M8 0H60" strokeWidth={0.6} />
          {[-6, -3, 3, 6].map((o) => <path key={o} d={`M14 0Q36 ${o * 1.5} 58 ${o * 0.3}`} strokeWidth={0.35} />)}
        </g>
      ))}
      {Array.from({ length: 16 }, (_, i) => {
        const a = (i / 16) * Math.PI * 2
        return (
          <g key={i}>
            <path d={`M100 100L${100 + Math.cos(a) * 26} ${100 + Math.sin(a) * 26}`} strokeWidth={0.6} />
            <ellipse cx={100 + Math.cos(a) * 28} cy={100 + Math.sin(a) * 28} rx={3} ry={1.8} transform={`rotate(${(a * 180) / Math.PI} ${100 + Math.cos(a) * 28} ${100 + Math.sin(a) * 28})`} fill="var(--ink)" />
          </g>
        )
      })}
      <circle cx={100} cy={100} r={5} fill="var(--paper)" />
    </svg>
  )
}

export function IllKesit({ size = 160 }: { size?: number }) {
  const seg = 10
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" fill="none" stroke={INK} strokeWidth={1} role="img" aria-label="Limon kesiti gravürü">
      <circle cx={100} cy={100} r={84} fill="var(--paper)" />
      <circle cx={100} cy={100} r={76} strokeWidth={0.6} />
      {Array.from({ length: seg }, (_, i) => {
        const a1 = ((i + 0.08) / seg) * Math.PI * 2
        const a2 = ((i + 0.92) / seg) * Math.PI * 2
        const R = 68
        const r = 12
        return (
          <g key={i}>
            <path d={`M${100 + Math.cos(a1) * r} ${100 + Math.sin(a1) * r}L${100 + Math.cos(a1) * R} ${100 + Math.sin(a1) * R}A${R} ${R} 0 0 1 ${100 + Math.cos(a2) * R} ${100 + Math.sin(a2) * R}L${100 + Math.cos(a2) * r} ${100 + Math.sin(a2) * r}Z`} />
            {Array.from({ length: 6 }, (_, k) => {
              const am = (i + 0.5) / seg * Math.PI * 2 + (k - 2.5) * 0.045
              return <path key={k} d={`M${100 + Math.cos(am) * 22} ${100 + Math.sin(am) * 22}L${100 + Math.cos(am) * (50 + (k % 2) * 8)} ${100 + Math.sin(am) * (50 + (k % 2) * 8)}`} strokeWidth={0.4} />
            })}
          </g>
        )
      })}
      {[0.4, 2.1, 3.4, 5.2].map((a, i) => <ellipse key={i} cx={100 + Math.cos(a) * 30} cy={100 + Math.sin(a) * 30} rx={4} ry={2.4} transform={`rotate(${(a * 180) / Math.PI} ${100 + Math.cos(a) * 30} ${100 + Math.sin(a) * 30})`} fill="var(--paper-3)" />)}
    </svg>
  )
}

export function IllAgac({ size = 160 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" fill="none" stroke={INK} strokeWidth={1} role="img" aria-label="Narenciye ağacı silüeti gravürü">
      <path d="M96 186C97 160 98 140 94 120M104 186C103 160 102 140 106 120" strokeWidth={1.3} />
      <path d="M94 120C80 108 60 100 52 84M106 120C122 106 142 100 150 84" />
      <path d="M100 168c-14 2-26 8-36 16h72c-10-8-22-14-36-16z" fill="var(--paper-2)" strokeWidth={0.6} />
      <path d="M100 26C62 26 38 52 42 84c3 26 30 40 58 40s55-14 58-40c4-32-20-58-58-58z" fill="var(--paper)" />
      {Array.from({ length: 34 }, (_, i) => {
        const a = (i / 34) * Math.PI * 2
        const rx = 40 + (i % 3) * 6
        return <path key={i} d={`M${100 + Math.cos(a) * rx} ${76 + Math.sin(a) * rx * 0.85}q${5 * Math.sign(Math.cos(a) || 1)} 7 ${2} 12`} strokeWidth={0.45} />
      })}
      {Array.from({ length: 26 }, (_, i) => <path key={`d${i}`} d={`M${52 + (i * 37) % 96} ${96 + ((i * 53) % 24)}l5 5`} strokeWidth={0.4} />)}
      {[[70, 70], [118, 58], [128, 92], [82, 96], [104, 84]].map(([x, y], i) => <ellipse key={i} cx={x} cy={y} rx={5.5} ry={4.2} fill="var(--paper)" transform={`rotate(-20 ${x} ${y})`} />)}
    </svg>
  )
}

export function IllYaprak({ size = 160 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" fill="none" role="img" aria-label="Narenciye yaprağı gravürü">
      <Leaf x={36} y={152} a={-38} L={150} W={42} veins={11} />
      <path d="M36 152C28 160 20 166 12 170" stroke={INK} strokeWidth={1.2} />
    </svg>
  )
}


// ----------------------------------------------------------------------------- kartografik öğeler
/** Tarama desenleri: zayıf bölgeler, sınırda saatler, gece. `id` önekiyle çakışma olmaz. */
export function HatchDefs({ id = 'sd' }: { id?: string }) {
  return (
    <svg width={0} height={0} style={{ position: 'absolute' }} aria-hidden>
      <defs>
        <pattern id={`${id}-hatch`} width={6} height={6} patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1={0} y1={0} x2={0} y2={6} stroke="var(--ink)" strokeWidth={1.2} /></pattern>
        <pattern id={`${id}-cross`} width={6} height={6} patternUnits="userSpaceOnUse"><path d="M0 0L6 6M6 0L0 6" stroke="var(--ink)" strokeWidth={0.8} /></pattern>
        <pattern id={`${id}-dots`} width={5} height={5} patternUnits="userSpaceOnUse"><circle cx={2.5} cy={2.5} r={1} fill="var(--ink)" /></pattern>
      </defs>
    </svg>
  )
}

export function NorthArrow({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none" stroke="var(--ink)" strokeWidth={1.1} role="img" aria-label="Kuzey">
      <circle cx={22} cy={24} r={15} />
      <path d="M22 6L28 30L22 26L16 30Z" fill="var(--ink)" />
      <path d="M22 26L22 42" strokeWidth={0.7} />
      <text x={22} y={5} textAnchor="middle" fontSize={12} fontWeight={700} fill="var(--ink)" stroke="none" fontFamily="var(--font-ui)">K</text>
    </svg>
  )
}

/** Ölçek çubuğu: alternatif siyah/beyaz bölmeler (İsviçre topo haritası gibi); `meters` toplam uzunluk, `pxPerMeter` haritadan. */
export function ScaleBar({ pxPerMeter }: { pxPerMeter: number }) {
  const nice = [10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000]
  const target = 130 / Math.max(pxPerMeter, 1e-6)
  const meters = nice.filter((n) => n <= target).pop() ?? nice[0]
  const width = meters * pxPerMeter
  const parts = 4
  return (
    <svg width={width + 44} height={30} role="img" aria-label={`Ölçek ${meters} metre`}>
      {Array.from({ length: parts }, (_, i) => (
        <rect key={i} x={1 + (width / parts) * i} y={14} width={width / parts} height={5} fill={i % 2 ? 'var(--paper)' : 'var(--ink)'} stroke="var(--ink)" strokeWidth={1} />
      ))}
      <text x={1} y={10} fontSize={12} fontFamily="var(--font-mono)" fill="var(--ink)">0</text>
      <text x={1 + width} y={10} fontSize={12} fontFamily="var(--font-mono)" fill="var(--ink)" textAnchor="middle">{meters >= 1000 ? `${meters / 1000} km` : `${meters} m`}</text>
    </svg>
  )
}

/** Çerçeve kenarında koordinat işaretleri (enlem/boylam, derece-ondalık). */
export function CoordTicks({ bounds, width, height }: { bounds: { w: number; s: number; e: number; n: number }; width: number; height: number }) {
  const lngs = [0.15, 0.5, 0.85].map((f) => ({ f, v: bounds.w + (bounds.e - bounds.w) * f }))
  const lats = [0.2, 0.5, 0.8].map((f) => ({ f, v: bounds.n - (bounds.n - bounds.s) * f }))
  const style: CSSProperties = { font: '500 9.5px var(--font-mono)', fill: 'var(--ink)' }
  return (
    <svg width={width} height={height} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} aria-hidden>
      <rect x={0.5} y={0.5} width={width - 1} height={height - 1} fill="none" stroke="var(--ink)" strokeWidth={1} />
      {lngs.map(({ f, v }) => (
        <g key={f}>
          <line x1={width * f} x2={width * f} y1={0} y2={7} stroke="var(--ink)" /><line x1={width * f} x2={width * f} y1={height} y2={height - 7} stroke="var(--ink)" />
          <text x={width * f + 4} y={16} style={style} stroke="var(--paper)" strokeWidth={3} paintOrder="stroke">{v.toFixed(4)}°D</text>
        </g>
      ))}
      {lats.map(({ f, v }) => (
        <g key={f}>
          <line y1={height * f} y2={height * f} x1={0} x2={7} stroke="var(--ink)" /><line y1={height * f} y2={height * f} x1={width} x2={width - 7} stroke="var(--ink)" />
          <text x={10} y={height * f - 3} style={style} stroke="var(--paper)" strokeWidth={3} paintOrder="stroke">{v.toFixed(4)}°K</text>
        </g>
      ))}
    </svg>
  )
}

export function Logo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-label="BahçeLab">
      <rect width={32} height={32} rx={3} fill="var(--brand)" />
      <path d="M8 24C8 14 14 8 24 8c0 10-6 16-16 16zM8 24l9-9" stroke="var(--paper)" strokeWidth={1.6} strokeLinecap="round" />
    </svg>
  )
}

export function Frame({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ border: '1px solid var(--ink)', ...style }}>{children}</div>
}
