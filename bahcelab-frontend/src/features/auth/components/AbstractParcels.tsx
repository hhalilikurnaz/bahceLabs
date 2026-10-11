import { useMemo } from 'react'

/** Basit, deterministik rastgele sayı üreteci (aynı tohum → aynı doku; belirli bir yeri göstermez). */
function lcg(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

const TONES = ['#16301f', '#1c3b27', '#234a2f', '#2b5a37', '#356b40', '#2a4d34', '#3d7a48', '#1a3524']
const COLS = 9
const ROWS = 11

/**
 * Soyut uydu/bahçe dokusu: düzensiz yeşil parseller ve ince ağaç sıraları. Gerçek bir konumu temsil etmez,
 * yalnızca marka atmosferi içindir (süs; ekran okuyuculardan gizli).
 */
export function AbstractParcels({ className }: { className?: string }) {
  const cells = useMemo(() => {
    const rand = lcg(20260)
    const out: { points: string; fill: string; rows: number; angle: number; x: number; y: number; w: number; h: number }[] = []
    const cw = 100 / COLS
    const ch = 100 / ROWS
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const jitter = () => (rand() - 0.5) * 3.2
        const x = c * cw
        const y = r * ch
        const pts = [
          [x + jitter(), y + jitter()],
          [x + cw + jitter(), y + jitter()],
          [x + cw + jitter(), y + ch + jitter()],
          [x + jitter(), y + ch + jitter()],
        ]
        out.push({
          points: pts.map((p) => p.map((n) => n.toFixed(2)).join(',')).join(' '),
          fill: TONES[Math.floor(rand() * TONES.length)],
          rows: 2 + Math.floor(rand() * 3),
          angle: Math.floor(rand() * 4) * 45,
          x,
          y,
          w: cw,
          h: ch,
        })
      }
    }
    return out
  }, [])

  return (
    <svg className={className} viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" aria-hidden focusable="false">
      <defs>
        {cells.map((cell, i) => (
          <clipPath key={i} id={`parcel-${i}`}>
            <polygon points={cell.points} />
          </clipPath>
        ))}
      </defs>
      {cells.map((cell, i) => (
        <g key={i} clipPath={`url(#parcel-${i})`}>
          <polygon points={cell.points} fill={cell.fill} />
          <g transform={`rotate(${cell.angle} ${cell.x + cell.w / 2} ${cell.y + cell.h / 2})`} stroke="rgba(255,255,255,0.07)" strokeWidth={0.18}>
            {Array.from({ length: cell.rows * 6 }, (_, k) => (
              <line key={k} x1={cell.x - 6} x2={cell.x + cell.w + 6} y1={cell.y + (k * cell.h) / (cell.rows * 5)} y2={cell.y + (k * cell.h) / (cell.rows * 5)} />
            ))}
          </g>
        </g>
      ))}
      <polygon points="0,0 100,0 100,100 0,100" fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth={0.4} />
    </svg>
  )
}
