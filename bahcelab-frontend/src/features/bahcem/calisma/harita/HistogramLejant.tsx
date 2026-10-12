import { useMemo, useState } from 'react'
import { sayi } from '../../lib/format'
import { histogram } from '../../lib/izgara'
import { rampCss } from '../../lib/paletler'
import { useCalismaStore } from '../calismaStore'
import type { HaritaGorunumu } from '../useHaritaGorunumu'

const BINS = 24
const W = 258
const H = 56

/** Sol alt: histogram lejantı — sütun rengi haritadakiyle aynı; üzerine gelince o aralıktaki pikseller vurgulanır. Skala seçimi burada. */
export function HistogramLejant({ view }: { view: HaritaGorunumu }) {
  const skala = useCalismaStore((s) => s.skala)
  const setSkala = useCalismaStore((s) => s.setSkala)
  const setVurgu = useCalismaStore((s) => s.setVurgu)
  const [hover, setHover] = useState<number | null>(null)
  const bins = useMemo(() => (view.izgara ? histogram(view.izgara, view.alan, BINS) : []), [view.izgara, view.alan])
  if (!view.izgara || !view.ramp) return null
  const max = Math.max(...bins.map((b) => b.share), 1e-6)
  const ramp = view.ramp
  const bw = W / BINS
  const degisim = view.tanim.id === 'degisim'
  const hb = hover !== null ? bins[hover] : null
  return (
    <div className="glass w-[286px] max-w-full px-3.5 pb-2.5 pt-3" data-testid="histogram-lejant">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12.5px] font-bold">{view.tanim.ad}{degisim ? ' farkı' : ''}</span>
        <div className="flex overflow-hidden rounded-md border border-app-border text-[11.5px] font-medium" role="group" aria-label="Renk skalası">
          {(['kendi', 'genel'] as const).map((k) => (
            <button key={k} type="button" aria-pressed={skala === k} onClick={() => setSkala(k)} className={`px-2 py-1 max-[560px]:min-h-11 ${skala === k ? 'bg-app-text text-app-panel' : 'text-app-text-muted hover:bg-app-card-hover'}`}>
              {k === 'kendi' ? 'Bahçenin kendi farkları' : 'Genel skala'}
            </button>
          ))}
        </div>
      </div>
      <svg width={W} height={H} className="mt-2 block" role="img" aria-label="Piksel dağılımı" onMouseLeave={() => (setHover(null), setVurgu(null))}>
        {bins.map((b, i) => {
          const h = Math.max(1, (b.share / max) * (H - 4))
          return (
            <rect
              key={i}
              x={i * bw + 0.5}
              y={H - h}
              width={bw - 1}
              height={h}
              rx={1}
              fill={rampCss(ramp, (i + 0.5) / BINS)}
              stroke={hover === i ? 'var(--color-app-text)' : 'rgba(0,0,0,.12)'}
              strokeWidth={hover === i ? 1.5 : 0.5}
              onMouseEnter={() => (setHover(i), setVurgu([b.from, b.to]))}
            />
          )
        })}
        <line x1={0} x2={W} y1={H - 0.5} y2={H - 0.5} stroke="var(--color-app-border)" />
      </svg>
      <div className="num mt-1 flex justify-between text-[11px] text-app-text-muted">
        <span>{sayi(view.alan[0])}</span>
        <span>{hb ? `${sayi(hb.from)}–${sayi(hb.to)} · alanın %${Math.round(hb.share * 100)}’i` : degisim ? 'düşüş ← → artış' : 'zayıf → güçlü'}</span>
        <span>{sayi(view.alan[1])}</span>
      </div>
    </div>
  )
}
