import { localPoint } from '@visx/event'
import { scaleLinear } from '@visx/scale'
import { ChartTooltip, DirectLabel, Threshold } from './parcalar'
import { useIlkCizim } from './useIlkCizim'
import { ayKisa, fmt, niceTicks, YAZI } from './ekseller'
import { useTimeDomain } from './timeDomainBaglam'

export interface HavaGunu { tarih: string; min: number | null; max: number | null; yagisMm: number | null }
const gunNo = (iso: string): number => Date.parse(`${iso}T00:00:00Z`) / 86_400_000
const etiket = (iso: string): string => `${Number(iso.slice(8, 10))} ${ayKisa(Number(iso.slice(5, 7)) - 1)}`

/**
 * Hava geçmişi: İKİ PANEL, ORTAK ZAMAN EKSENİ, çift eksen yok (ilke 11).
 *  ① günlük yağış çubukları (mm)  ② günlük en düşük–en yüksek sıcaklık bandı ve ortalama çizgisi (°C) + 0 °C DON EŞİĞİ çizgisi.
 * Gezinince iki panelde aynı dikey imleç + değer kutusu (TimeDomain).
 */
export function HavaGrafikleri({ gunler, from, to, genislik }: { gunler: HavaGunu[]; from: string; to: string; genislik: number }) {
  const { imlec, setImlec } = useTimeDomain()
  const ilk = useIlkCizim(gunler.length > 0)
  const sol = 40
  const sag = 16
  const iw = Math.max(80, genislik - sol - sag)
  const t0 = gunNo(from)
  const t1 = gunNo(to)
  const X = scaleLinear({ domain: [t0, t1], range: [sol, sol + iw] })
  const veri = gunler.filter((d) => d.tarih >= from && d.tarih <= to)
  const ay = (() => { const a: { iso: string; x: number }[] = []; for (let t = t0; t <= t1; t++) { const iso = new Date(t * 86_400_000).toISOString().slice(0, 10); if (iso.endsWith('-01')) a.push({ iso, x: X(t) }) } return a })()
  const adim = iw / Math.max(1, ay.length) >= 34 ? 1 : 2
  // ① yağış
  const [H1, u1, a1] = [104, 10, 6]
  const ih1 = H1 - u1 - a1
  const yagMaks = Math.max(10, ...veri.map((d) => d.yagisMm ?? 0))
  const yagTk = niceTicks({ min: 0, max: yagMaks }, 3)
  const yagTop = yagTk[yagTk.length - 1] ?? yagMaks
  const Y1 = scaleLinear({ domain: [0, yagTop], range: [u1 + ih1, u1] })
  // ② sıcaklık (0 °C her zaman alanda)
  const [H2, u2, a2] = [140, 12, 26]
  const ih2 = H2 - u2 - a2
  const sic = veri.flatMap((d) => (d.min != null && d.max != null ? [d.min, d.max] : []))
  const lo0 = Math.min(0, ...sic)
  const hi0 = Math.max(10, ...sic)
  const sTk = niceTicks({ min: lo0, max: hi0 }, 4)
  const lo = Math.min(lo0, sTk[0])
  const hi = Math.max(hi0, sTk[sTk.length - 1])
  const Y2 = scaleLinear({ domain: [lo, hi], range: [u2 + ih2, u2] })
  const barW = Math.max(1.5, Math.min(4, iw / Math.max(1, t1 - t0)))
  const bant = veri.filter((d) => d.min != null && d.max != null)
  const alan = bant.length > 1 ? `M${bant.map((d) => `${X(gunNo(d.tarih)).toFixed(1)},${Y2(d.max!).toFixed(1)}`).join(' L')} L${[...bant].reverse().map((d) => `${X(gunNo(d.tarih)).toFixed(1)},${Y2(d.min!).toFixed(1)}`).join(' L')}Z` : null
  const ort = bant.length > 1 ? `M${bant.map((d) => `${X(gunNo(d.tarih)).toFixed(1)},${Y2((d.min! + d.max!) / 2).toFixed(1)}`).join(' L')}` : null
  const secili = imlec ? veri.reduce<HavaGunu | null>((b, d) => (!b || Math.abs(gunNo(d.tarih) - gunNo(imlec)) < Math.abs(gunNo(b.tarih) - gunNo(imlec)) ? d : b), null) : null
  const oyna = (e: React.PointerEvent<SVGRectElement>) => {
    const p = localPoint(e)
    if (!p || !veri.length) return
    const t = X.invert(p.x)
    setImlec(veri.reduce((b, d) => (Math.abs(gunNo(d.tarih) - t) < Math.abs(gunNo(b.tarih) - t) ? d : b)).tarih)
  }
  const imlecX = secili ? X(gunNo(secili.tarih)) : null
  const eksenEtiketleri = (y: number) => ay.filter((_, i) => i % adim === 0).map((a) => <text key={a.iso} x={a.x} y={y} fontSize={YAZI.eksen} fill="var(--color-app-text-dim)" textAnchor="middle">{ayKisa(Number(a.iso.slice(5, 7)) - 1)}</text>)
  return (
    <div className="relative" style={{ width: genislik }} data-testid="hava-grafikleri">
      <p className="text-small font-semibold text-app-text">Yağış <span className="font-normal text-app-text-dim">mm/gün</span></p>
      <svg width={genislik} height={H1} viewBox={`0 0 ${genislik} ${H1}`} role="img" aria-label="Son 90 günün günlük yağışı, mm" className="block overflow-visible" data-testid="hava-panel-yagis">
        {yagTk.filter((t) => t > 0).map((t) => <g key={t}><line x1={sol} x2={sol + iw} y1={Y1(t)} y2={Y1(t)} stroke="var(--color-app-border)" /><text x={sol - 8} y={Y1(t) + 4} textAnchor="end" fontSize={YAZI.eksen} fill="var(--color-app-text-dim)">{fmt(t, 0)}</text></g>)}
        <line x1={sol} x2={sol + iw} y1={Y1(0)} y2={Y1(0)} stroke="var(--color-app-border-strong)" />
        <text x={sol - 8} y={Y1(0) + 4} textAnchor="end" fontSize={YAZI.eksen} fill="var(--color-app-text-dim)">0</text>
        <g className={ilk ? 'm-draw-band' : undefined}>{veri.map((d) => (d.yagisMm ?? 0) > 0 && <rect key={d.tarih} x={X(gunNo(d.tarih)) - barW / 2} y={Y1(d.yagisMm!)} width={barW} height={Y1(0) - Y1(d.yagisMm!)} fill="var(--color-app-water)" opacity={0.9} data-testid="yagis-cubugu" />)}</g>
        {imlecX !== null && <line x1={imlecX} x2={imlecX} y1={u1} y2={u1 + ih1} stroke="var(--color-app-text)" pointerEvents="none" data-testid="grafik-imlec" />}
        <rect x={sol} y={0} width={iw} height={H1} fill="transparent" onPointerMove={oyna} onPointerLeave={() => setImlec(null)} />
      </svg>
      <p className="mt-2 text-small font-semibold text-app-text">Sıcaklık <span className="font-normal text-app-text-dim">°C · günlük en düşük ile en yüksek arası, çizgi ortalama</span></p>
      <svg width={genislik} height={H2} viewBox={`0 0 ${genislik} ${H2}`} role="img" aria-label="Son 90 günün günlük sıcaklık aralığı, °C; sıfır derece don eşiği çizili" className="block overflow-visible" data-testid="hava-panel-sicaklik">
        {sTk.filter((t) => t !== 0).map((t) => <g key={t}><line x1={sol} x2={sol + iw} y1={Y2(t)} y2={Y2(t)} stroke="var(--color-app-border)" /><text x={sol - 8} y={Y2(t) + 4} textAnchor="end" fontSize={YAZI.eksen} fill="var(--color-app-text-dim)">{t < 0 ? '−' : ''}{fmt(Math.abs(t), 0)}</text></g>)}
        <text x={sol - 8} y={Y2(0) + 4} textAnchor="end" fontSize={YAZI.eksen} fill="var(--color-app-text-dim)">0</text>
        {alan && <path d={alan} fill="var(--color-app-warn)" opacity={0.2} />}
        {ort && <path d={ort} fill="none" stroke="var(--color-app-text)" strokeWidth={1.75} strokeLinejoin="round" className={ilk ? 'm-draw-line' : undefined} style={{ ['--draw-len' as string]: 4000 }} data-testid="sicaklik-cizgisi" />}
        <Threshold y={Y2(0)} x1={sol} x2={sol + iw} etiket="don eşiği 0 °C" tone="sorun" />
        {eksenEtiketleri(H2 - 8)}
        {imlecX !== null && <line x1={imlecX} x2={imlecX} y1={u2} y2={u2 + ih2} stroke="var(--color-app-text)" pointerEvents="none" />}
        <rect x={sol} y={0} width={iw} height={H2} fill="transparent" onPointerMove={oyna} onPointerLeave={() => setImlec(null)} />
      </svg>
      {secili && (
        <ChartTooltip x={imlecX!} y={4} kapsayiciW={genislik} baslik={etiket(secili.tarih)}
          satirlar={[{ ad: 'yağış', deger: secili.yagisMm != null ? `${fmt(secili.yagisMm, 1)} mm` : '—' }, { ad: 'sıcaklık', deger: secili.min != null && secili.max != null ? `${fmt(secili.min, 0)} / ${fmt(secili.max, 0)} °C` : '—' }]} />
      )}
      {veri.length === 0 && <DirectLabel x={genislik / 2} y={H1 / 2} anchor="middle" tone="soluk">Bu dönem için hava verisi yok</DirectLabel>}
    </div>
  )
}
