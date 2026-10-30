import { localPoint } from '@visx/event'
import { scaleLinear } from '@visx/scale'
import { ChartTooltip, DirectLabel, Forecast, Threshold } from './parcalar'
import { ayKisa, fmt, YAZI } from './ekseller'
import { useTimeDomain } from './timeDomainBaglam'
import { useIlkCizim } from './useIlkCizim'

export interface VanaSerisi {
  ad: string
  gunler: { tarih: string; doluluk_pct: number | null; tahmin: boolean; planli: boolean; uygulandi: boolean }[]
}
const trGun = (iso: string): string => `${Number(iso.slice(8, 10))} ${ayKisa(Number(iso.slice(5, 7)) - 1)}`
const RENK = ['var(--color-app-text)', 'var(--color-app-water)', 'var(--color-app-accent-strong)', 'var(--color-app-warn)', 'var(--color-app-text-muted)', 'var(--color-app-success)']

/**
 * Toprak suyu · vanalara göre (CropX deseni): TEK eksen (kullanılabilir su %). Arka plan bantları: stres, ideal aralık, tarla kapasitesi çizgisi; Threshold = sulama eşiği.
 * Son 14 gün düz, sonraki 7 gün kesikli + Forecast; sulama günleri vana çizgisi altında işaretli; vana adı çizgi ucunda (lejant yok).
 */
export function ToprakSuyuGrafigi({ vanalar, bugun, genislik, yukseklik = 220, stresPct, yakinPct, yeterliPct, tetikPct }: { vanalar: VanaSerisi[]; bugun: string; genislik: number; yukseklik?: number; stresPct: number; yakinPct: number; yeterliPct: number; tetikPct: number | null }) {
  const { imlec, setImlec } = useTimeDomain()
  const ilk = useIlkCizim(vanalar.length > 0)
  const tarihler = vanalar[0]?.gunler.map((g) => g.tarih) ?? []
  const n = Math.max(1, tarihler.length)
  const [sol, sag, ust, alt] = [40, 56, 16, 28]
  const iw = Math.max(40, genislik - sol - sag)
  const ih = yukseklik - ust - alt
  const X = (i: number) => sol + (i * iw) / Math.max(1, n - 1)
  const Y = scaleLinear({ domain: [0, 100], range: [ust + ih, ust] })
  const ilkTahmin = vanalar[0]?.gunler.findIndex((g) => g.tahmin) ?? -1
  const bx = ilkTahmin >= 0 ? X(Math.max(0, ilkTahmin - 0.5)) : 0
  const bugunI = tarihler.indexOf(bugun)
  const idx = imlec ? tarihler.indexOf(imlec) : -1
  const oyna = (e: React.PointerEvent<SVGRectElement>) => {
    const p = localPoint(e)
    if (!p || !tarihler.length) return
    setImlec(tarihler[Math.min(n - 1, Math.max(0, Math.round(((p.x - sol) / iw) * (n - 1))))])
  }
  const uclar = vanalar
    .map((v, vi) => {
      const son = [...v.gunler.entries()].reverse().find(([, g]) => g.doluluk_pct !== null)
      return son ? { ad: v.ad, vi, x: X(son[0]), y: Y(son[1].doluluk_pct as number) } : null
    })
    .filter((u): u is { ad: string; vi: number; x: number; y: number } => u !== null)
    .sort((a, b) => a.y - b.y)
  for (let i = 1; i < uclar.length; i++) if (uclar[i].y - uclar[i - 1].y < 14) uclar[i] = { ...uclar[i], y: uclar[i - 1].y + 14 } // üst üste binen vana adları aşağı itilir
  const yol = (pts: readonly (readonly [number, number])[]) => (pts.length ? `M${pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L')}` : '')
  return (
    <div className="relative" style={{ width: genislik }} data-testid="toprak-suyu-grafigi">
      <svg width={genislik} height={yukseklik} viewBox={`0 0 ${genislik} ${yukseklik}`} role="img" aria-label="Toprak suyu, kullanılabilir su yüzdesi, vanalara göre; son 14 gün düz çizgi, sonraki 7 gün kesikli" className="block overflow-visible">
        <rect x={sol} y={Y(stresPct)} width={iw} height={Y(0) - Y(stresPct)} fill="var(--color-app-warn)" opacity={0.14} data-testid="bant-stres" />
        <rect x={sol} y={Y(yeterliPct)} width={iw} height={Y(yakinPct) - Y(yeterliPct)} fill="var(--color-app-success)" opacity={0.14} data-testid="bant-ideal" />
        {ilkTahmin >= 0 && <Forecast id="toprak-tahmin" x={bx} y={ust - 4} width={sol + iw - bx} height={ih + 8} />}
        {[0, 50, 100].map((t) => (
          <g key={t}><line x1={sol} x2={sol + iw} y1={Y(t)} y2={Y(t)} stroke="var(--color-app-border)" /><text x={sol - 8} y={Y(t) + 4} textAnchor="end" fontSize={YAZI.eksen} fill="var(--color-app-text-dim)">{t}</text></g>
        ))}
        <text x={sol - 8} y={ust - 5} textAnchor="end" fontSize={YAZI.eksen} fill="var(--color-app-text-dim)">%</text>
        <DirectLabel x={sol + 6} y={Y(stresPct / 2) + 4} tone="sicak" bold>stres</DirectLabel>
        <DirectLabel x={sol + 6} y={Y((yakinPct + yeterliPct) / 2) + 4} tone="soluk">ideal aralık</DirectLabel>
        <line x1={sol} x2={sol + iw} y1={Y(100)} y2={Y(100)} stroke="var(--color-app-border-strong)" />
        <DirectLabel x={sol + 6} y={Y(100) - 5} tone="soluk">tarla kapasitesi</DirectLabel>
        {tetikPct !== null && <Threshold y={Y(tetikPct)} x1={sol} x2={sol + iw} etiket="sulama eşiği" etiketSol />}
        <g className={ilk ? 'm-draw-band' : undefined}>
          {vanalar.map((v, vi) => {
            const renk = RENK[vi % RENK.length]
            const pts = v.gunler.flatMap((g, i) => (g.doluluk_pct === null ? [] : [[X(i), Y(g.doluluk_pct), g.tahmin] as const]))
            const gec = pts.filter((p) => !p[2])
            const gel = pts.filter((p, k) => p[2] || k === gec.length - 1)
            return (
              <g key={v.ad} data-testid="vana-cizgisi" data-vana={v.ad}>
                {gec.length > 1 && <path d={yol(gec.map((p) => [p[0], p[1]] as const))} fill="none" stroke={renk} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />}
                {gel.length > 1 && <path d={yol(gel.map((p) => [p[0], p[1]] as const))} fill="none" stroke={renk} strokeWidth={2} strokeDasharray="5 4" strokeLinecap="round" />}
                {v.gunler.map((g, i) => (g.planli || g.uygulandi) && g.doluluk_pct !== null ? <path key={g.tarih} d={`M${X(i)},${Y(g.doluluk_pct) + 5} l-4,7 h8 z`} fill={g.uygulandi ? renk : 'var(--color-app-card)'} stroke={renk} strokeWidth={1.25} data-testid="sulama-isareti" /> : null)}
              </g>
            )
          })}
        </g>
        {vanalar.length <= 6 && uclar.map((u) => <DirectLabel key={u.ad} x={Math.min(u.x + 6, genislik - 2)} y={u.y + 4} bold tone="metin" testId="vana-etiketi">{u.ad}</DirectLabel>)}
        {bugunI >= 0 && <g data-testid="toprak-bugun"><line x1={X(bugunI)} x2={X(bugunI)} y1={ust - 4} y2={ust + ih} stroke="var(--color-app-text-muted)" strokeDasharray="2 3" /><DirectLabel x={X(bugunI)} y={ust - 6} anchor="middle" tone="soluk">bugün</DirectLabel></g>}
        {[0, Math.floor(n / 2), n - 1].map((i) => tarihler[i] && <text key={i} x={X(i)} y={yukseklik - 8} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} fontSize={YAZI.eksen} fill="var(--color-app-text-dim)">{trGun(tarihler[i])}</text>)}
        {idx >= 0 && <line x1={X(idx)} x2={X(idx)} y1={ust - 4} y2={ust + ih + 2} stroke="var(--color-app-text)" pointerEvents="none" data-testid="grafik-imlec" />}
        <rect x={sol} y={0} width={iw} height={yukseklik} fill="transparent" onPointerMove={oyna} onPointerLeave={() => setImlec(null)} />
      </svg>
      {idx >= 0 && (
        <ChartTooltip x={X(idx)} y={4} kapsayiciW={genislik} baslik={trGun(tarihler[idx]) + (vanalar[0].gunler[idx].tahmin ? ' · tahmin' : '')} satirlar={vanalar.map((v) => ({ ad: v.ad, deger: v.gunler[idx].doluluk_pct === null ? '—' : `%${fmt(v.gunler[idx].doluluk_pct as number, 0)}` }))} />
      )}
    </div>
  )
}
