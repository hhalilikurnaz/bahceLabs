import { PatternLines } from '@visx/pattern'
import type { ReactNode } from 'react'
import { YAZI } from './ekseller'

/** DirectLabel: seri/nokta etiketi. Halo (zemin renginde kontur) ile çizgi üstünde okunur; lejant paragrafı yerine geçer. */
export function DirectLabel({ x, y, children, anchor = 'start', tone = 'metin', bold = false, testId }: { x: number; y: number; children: ReactNode; anchor?: 'start' | 'middle' | 'end'; tone?: 'metin' | 'soluk' | 'su' | 'sicak'; bold?: boolean; testId?: string }) {
  const fill = { metin: 'var(--color-app-text)', soluk: 'var(--color-app-text-dim)', su: 'var(--color-app-water)', sicak: 'var(--color-app-warn)' }[tone]
  return (
    <text x={x} y={y} textAnchor={anchor} fontSize={bold ? YAZI.vurgu : YAZI.etiket} fontWeight={bold ? 700 : 500} fill={fill} data-testid={testId} style={{ paintOrder: 'stroke', stroke: 'var(--color-app-card)', strokeWidth: 4, strokeLinejoin: 'round', fontVariantNumeric: 'tabular-nums' }}>
      {children}
    </text>
  )
}

/** Annotation: grafikte kısa not = nokta + ince çizgi + etiket. */
export function Annotation({ x, y, dx, dy, children }: { x: number; y: number; dx: number; dy: number; children: ReactNode }) {
  return (
    <g data-testid="grafik-not">
      <line x1={x} y1={y} x2={x + dx} y2={y + dy} stroke="var(--color-app-border-strong)" strokeWidth={1} />
      <circle cx={x} cy={y} r={3} fill="var(--color-app-card)" stroke="var(--color-app-text)" strokeWidth={1.5} />
      <DirectLabel x={x + dx + (dx >= 0 ? 4 : -4)} y={y + dy + 4} anchor={dx >= 0 ? 'start' : 'end'}>{children}</DirectLabel>
    </g>
  )
}

/** Threshold: eşik çizgisi + doğrudan etiket (don 0 °C, sulama eşiği…). */
export function Threshold({ y, x1, x2, etiket, tone = 'uyari' }: { y: number; x1: number; x2: number; etiket: string; tone?: 'uyari' | 'sorun' | 'notr' }) {
  const c = { uyari: 'var(--color-app-warn)', sorun: 'var(--color-app-danger)', notr: 'var(--color-app-border-strong)' }[tone]
  return (
    <g data-testid="esik-cizgisi">
      <line x1={x1} x2={x2} y1={y} y2={y} stroke={c} strokeWidth={1.25} strokeDasharray="6 4" />
      <text x={x2} y={y - 5} textAnchor="end" fontSize={YAZI.etiket} fill={c} fontWeight={600}>{etiket}</text>
    </g>
  )
}

/** Forecast: tahmin bölgesi (taralı zemin). Gözlem dolu, tahmin taralı/soluk (ilke 7). */
export function Forecast({ x, y, width, height, etiket, id }: { x: number; y: number; width: number; height: number; etiket?: string; id: string }) {
  return (
    <g data-testid="tahmin-bolgesi">
      <PatternLines id={id} height={7} width={7} orientation={['diagonal']} stroke="var(--color-app-text-dim)" strokeWidth={1} />
      <rect x={x} y={y} width={width} height={height} fill={`url(#${id})`} opacity={0.4} />
      {etiket && <text x={x + 5} y={y + height - 4} fontSize={YAZI.etiket} fill="var(--color-app-text-dim)">{etiket}</text>}
    </g>
  )
}

/** ChartTooltip: imleç değer kutusu (HTML, kapsayıcıya göre konumlanır). */
export function ChartTooltip({ x, y, kapsayiciW, baslik, satirlar }: { x: number; y: number; kapsayiciW: number; baslik: string; satirlar: { ad: string; deger: string }[] }) {
  const sag = x > kapsayiciW * 0.55
  return (
    <div role="status" data-testid="grafik-tooltip" className="pointer-events-none absolute z-10 rounded-md border border-app-border bg-app-card px-2.5 py-1.5 text-caption text-app-text shadow-e2" style={{ left: x, top: Math.max(0, y), transform: `translate(${sag ? 'calc(-100% - 10px)' : '10px'}, 0)` }}>
      <b className="block text-small">{baslik}</b>
      {satirlar.map((s) => (
        <span key={s.ad} className="flex justify-between gap-3 tabular-nums"><span className="text-app-text-muted">{s.ad}</span><b>{s.deger}</b></span>
      ))}
    </div>
  )
}
