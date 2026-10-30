import { scaleLinear } from '@visx/scale'
import { useIlkCizim } from './useIlkCizim'

/** Mini çizgi (liste satırı): son gözlemler + aynı normal bant (p25–p75). Etiket yok: yanındaki cümle anlatır; erişilebilir özet `aria-label`. */
export function Sparkline({ noktalar, bant, genislik = 132, yukseklik = 38, ad }: { noktalar: { t: number; v: number }[]; bant?: { t: number; alt: number; ust: number }[]; genislik?: number; yukseklik?: number; ad: string }) {
  const ilk = useIlkCizim(noktalar.length > 1)
  if (noktalar.length < 2) return null
  const t0 = Math.min(...noktalar.map((n) => n.t))
  const t1 = Math.max(...noktalar.map((n) => n.t))
  const vals = [...noktalar.map((n) => n.v), ...(bant ?? []).flatMap((b) => [b.alt, b.ust])]
  const X = scaleLinear({ domain: [t0, t1], range: [2, genislik - 6] })
  const Y = scaleLinear({ domain: [Math.min(...vals) - 0.02, Math.max(...vals) + 0.02], range: [yukseklik - 3, 3] })
  const son = noktalar[noktalar.length - 1]
  const b = (bant ?? []).filter((p) => p.t >= t0 && p.t <= t1)
  const alan = b.length > 1 ? `M${b.map((p) => `${X(p.t).toFixed(1)},${Y(p.ust).toFixed(1)}`).join(' L')} L${[...b].reverse().map((p) => `${X(p.t).toFixed(1)},${Y(p.alt).toFixed(1)}`).join(' L')}Z` : null
  return (
    <svg className="shrink-0" width={genislik} height={yukseklik} viewBox={`0 0 ${genislik} ${yukseklik}`} role="img" aria-label={ad} data-testid="mini-cizgi">
      {alan && <path d={alan} fill="var(--color-band-koyu)" />}
      <path d={`M${noktalar.map((p) => `${X(p.t).toFixed(1)},${Y(p.v).toFixed(1)}`).join(' L')}`} fill="none" stroke="var(--color-app-text)" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={ilk ? 'm-draw-line' : undefined} style={{ ['--draw-len' as string]: 800 }} />
      <circle cx={X(son.t)} cy={Y(son.v)} r={2.8} fill="var(--color-app-text)" />
    </svg>
  )
}
