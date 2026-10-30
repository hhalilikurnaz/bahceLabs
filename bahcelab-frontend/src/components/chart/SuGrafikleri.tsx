import { localPoint } from '@visx/event'
import { scaleLinear } from '@visx/scale'
import { ChartTooltip, DirectLabel, Forecast } from './parcalar'
import { useIlkCizim } from './useIlkCizim'
import { ayKisa, fmt, niceTicks, YAZI } from './ekseller'
import { useTimeDomain } from './timeDomainBaglam'

export interface DengeGunu { tarih: string; yagis_mm: number | null; etc_mm: number | null; etkili_yagis_mm: number | null; birikimli_mm: number | null; tahmin: boolean; veri_eksik: boolean }
const trGun = (iso: string): string => `${Number(iso.slice(8, 10))} ${ayKisa(Number(iso.slice(5, 7)) - 1)}`

/**
 * Su dengesi v2 (ilke 11): İKİ PANEL, ORTAK ZAMAN EKSENİ, çift eksen yok.
 *  ① DivergingBars: günlük yağış ↑ / bitki tüketimi (ETc) ↓, mm/gün.  ② CumulativeLine: birikimli denge (yağış − ETc), mm; kendi ekseni ve sıfır çizgisi.
 * Önümüzdeki 7 gün iki panelde de aynı taralı bölgedir (tahmin). Gezinince iki panelde aynı dikey imleç + değer kutusu (TimeDomain).
 */
export function SuDengesiPaneller({ gunler, genislik, birikimliAd = 'Toplam su dengesi' }: { gunler: DengeGunu[]; genislik: number; birikimliAd?: string }) {
  const { imlec, setImlec } = useTimeDomain()
  const ilk = useIlkCizim(gunler.length > 0)
  const n = Math.max(1, gunler.length)
  const sol = 40
  const sag = 56
  const iw = genislik - sol - sag
  const X = (i: number) => sol + ((i + 0.5) * iw) / n
  const bar = Math.max(3, iw / n - 2)
  const ilkTahmin = gunler.findIndex((g) => g.tahmin)
  const bx = ilkTahmin >= 0 ? X(ilkTahmin) - iw / n / 2 : 0
  const bw = ilkTahmin >= 0 ? sol + iw - bx : 0
  const dolu = gunler.filter((g) => !g.veri_eksik)
  const maksHam = Math.max(1, ...dolu.map((g) => Math.max(g.yagis_mm ?? 0, g.etc_mm ?? 0)))
  const tk = niceTicks({ min: 0, max: maksHam }, 3)
  const maks = Math.max(maksHam, tk[tk.length - 1])
  const [H1, u1, a1] = [150, 14, 6]
  const ih1 = H1 - u1 - a1
  const ym = u1 + ih1 / 2
  const Yu = scaleLinear({ domain: [0, maks], range: [ym, u1] })
  const Ya = scaleLinear({ domain: [0, maks], range: [ym, u1 + ih1] })
  const kum = gunler.map((g) => g.birikimli_mm ?? 0)
  const lo0 = Math.min(0, ...kum)
  const hi0 = Math.max(0, ...kum)
  const tk2 = niceTicks({ min: lo0, max: Math.max(hi0, lo0 + 1) }, 4)
  const lo = Math.min(lo0, tk2[0])
  const hi = Math.max(hi0, tk2[tk2.length - 1], lo + 1)
  const [H2, u2, a2] = [132, 24, 28]
  const ih2 = H2 - u2 - a2
  const Yk = scaleLinear({ domain: [lo, hi], range: [u2 + ih2, u2] })
  const idx = imlec ? gunler.findIndex((g) => g.tarih === imlec) : -1
  const oyna = (e: React.PointerEvent<SVGRectElement>) => {
    const p = localPoint(e)
    if (!p) return
    const i = Math.min(n - 1, Math.max(0, Math.floor(((p.x - sol) / iw) * n)))
    setImlec(gunler[i].tarih)
  }
  const gz = gunler.flatMap((g, i) => (g.tahmin || g.birikimli_mm == null ? [] : [[X(i), Yk(g.birikimli_mm)] as const]))
  const tz = gunler.flatMap((g, i) => (i >= Math.max(0, ilkTahmin - 1) && g.birikimli_mm != null ? [[X(i), Yk(g.birikimli_mm)] as const] : []))
  const yol = (p: readonly (readonly [number, number])[]) => `M${p.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L')}`
  const son = tz[tz.length - 1]
  const bugunNokta = gz[gz.length - 1]
  const bugunDeger = ilkTahmin > 0 ? gunler[ilkTahmin - 1].birikimli_mm : null
  const imlecX = idx >= 0 ? X(idx) : null
  const sg = (v: number) => (v > 0 ? '+' : v < 0 ? '−' : '')
  return (
    <div className="relative" style={{ width: genislik }} data-testid="su-dengesi-paneller">
      <svg width={genislik} height={H1} viewBox={`0 0 ${genislik} ${H1}`} role="img" aria-label="Günlük yağış (yukarı) ve bitki tüketimi (aşağı), mm/gün; önümüzdeki 7 gün taralı" className="block overflow-visible" data-testid="su-panel-gunluk">
        {ilkTahmin >= 0 && <g data-testid="tahmin-bandi"><Forecast id="su-tahmin-1" x={bx} y={u1 - 6} width={bw} height={ih1 + 12} /></g>}
        {tk.filter((t) => t > 0).flatMap((t) => [
          <g key={`u${t}`}><line x1={sol} x2={sol + iw} y1={Yu(t)} y2={Yu(t)} stroke="var(--color-app-border)" /><text x={sol - 8} y={Yu(t) + 4} textAnchor="end" fontSize={YAZI.eksen} fill="var(--color-app-text-dim)">{fmt(t, 0)}</text></g>,
          <g key={`a${t}`}><line x1={sol} x2={sol + iw} y1={Ya(t)} y2={Ya(t)} stroke="var(--color-app-border)" /><text x={sol - 8} y={Ya(t) + 4} textAnchor="end" fontSize={YAZI.eksen} fill="var(--color-app-text-dim)">−{fmt(t, 0)}</text></g>,
        ])}
        <line x1={sol} x2={sol + iw} y1={ym} y2={ym} stroke="var(--color-app-border-strong)" />
        <text x={sol - 8} y={ym + 4} textAnchor="end" fontSize={YAZI.eksen} fill="var(--color-app-text-dim)">0</text>
        <g className={ilk ? 'm-draw-band' : undefined}>
          {gunler.map((g, i) => {
            if (g.veri_eksik) return null
            const ya = g.yagis_mm ?? 0
            const op = (g.etkili_yagis_mm ?? 0) === 0 ? 0.3 : g.tahmin ? 0.6 : 1
            return (
              <g key={g.tarih}>
                {ya > 0 && <rect x={X(i) - bar / 2} y={Yu(ya)} width={bar} height={ym - Yu(ya)} fill="var(--color-app-water)" opacity={op} data-testid="yagis-cubugu" data-sayilan={String((g.etkili_yagis_mm ?? 0) > 0)} />}
                <rect x={X(i) - bar / 2} y={ym} width={bar} height={Math.max(0, Ya(g.etc_mm ?? 0) - ym)} fill="var(--color-su-etc)" opacity={g.tahmin ? 0.6 : 0.92} />
              </g>
            )
          })}
        </g>
        <DirectLabel x={sol + 6} y={u1 + 12} tone="su" bold>yağış</DirectLabel>
        <DirectLabel x={sol + 6} y={u1 + ih1 - 3} tone="sicak" bold>bitki tüketimi</DirectLabel>
        {ilkTahmin >= 0 && <DirectLabel x={bx + 6} y={u1 + ih1 - 3} tone="soluk">7 gün tahmin</DirectLabel>}
        {imlecX !== null && <line x1={imlecX} x2={imlecX} y1={u1 - 4} y2={u1 + ih1 + 2} stroke="var(--color-app-text)" pointerEvents="none" data-testid="grafik-imlec" />}
        <rect x={sol} y={0} width={iw} height={H1} fill="transparent" onPointerMove={oyna} onPointerLeave={() => setImlec(null)} />
      </svg>
      <p className="mt-2 text-small font-semibold text-app-text">{birikimliAd} <span className="font-normal text-app-text-dim">mm · yağış eksi bitki tüketimi</span></p>
      <svg width={genislik} height={H2} viewBox={`0 0 ${genislik} ${H2}`} role="img" aria-label="Toplam su dengesi, mm; yağış eksi bitki tüketimi; son değer sağda" className="block overflow-visible" data-testid="su-panel-birikimli">
        {ilkTahmin >= 0 && <g data-testid="tahmin-bandi-2"><Forecast id="su-tahmin-2" x={bx} y={u2 - 4} width={bw} height={ih2 + 8} /></g>}
        {tk2.map((t) => (
          <g key={t}>
            <line x1={sol} x2={sol + iw} y1={Yk(t)} y2={Yk(t)} stroke={t === 0 ? 'var(--color-app-border-strong)' : 'var(--color-app-border)'} />
            <text x={sol - 8} y={Yk(t) + 4} textAnchor="end" fontSize={YAZI.eksen} fill="var(--color-app-text-dim)">{t < 0 ? '−' : ''}{fmt(Math.abs(t), 0)}</text>
          </g>
        ))}
        {gz.length > 1 && <path d={yol(gz)} fill="none" stroke="var(--color-app-text)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={ilk ? 'm-draw-line' : undefined} style={{ ['--draw-len' as string]: 3000 }} data-testid="birikimli-cizgi" />}
        {tz.length > 1 && <path d={yol(tz)} fill="none" stroke="var(--color-app-text)" strokeWidth={2} strokeDasharray="5 4" strokeLinecap="round" data-testid="birikimli-tahmin" />}
        {son && <><circle cx={son[0]} cy={son[1]} r={3.6} fill="var(--color-app-card)" stroke="var(--color-app-text)" strokeWidth={2} /><DirectLabel x={son[0] + 8} y={son[1] + 4} bold testId="birikimli-son">{sg(kum[kum.length - 1])}{fmt(Math.abs(kum[kum.length - 1]), 0)} mm</DirectLabel></>}
        {bugunNokta && bugunDeger !== null && <><circle cx={bugunNokta[0]} cy={bugunNokta[1]} r={3.6} fill="var(--color-app-text)" /><DirectLabel x={bugunNokta[0] - 8} y={bugunNokta[1] - 9} anchor="end" bold>bugün {sg(bugunDeger)}{fmt(Math.abs(bugunDeger), 0)} mm</DirectLabel></>}
        {[0, Math.floor(n / 2), n - 1].map((i) => <text key={i} x={X(i)} y={H2 - 8} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} fontSize={YAZI.eksen} fill="var(--color-app-text-dim)">{trGun(gunler[i].tarih)}</text>)}
        {imlecX !== null && <line x1={imlecX} x2={imlecX} y1={u2 - 4} y2={u2 + ih2 + 2} stroke="var(--color-app-text)" pointerEvents="none" />}
        <rect x={sol} y={0} width={iw} height={H2} fill="transparent" onPointerMove={oyna} onPointerLeave={() => setImlec(null)} />
      </svg>
      {idx >= 0 && !gunler[idx].veri_eksik && (
        <ChartTooltip x={X(idx)} y={4} kapsayiciW={genislik} baslik={trGun(gunler[idx].tarih) + (gunler[idx].tahmin ? ' · tahmin' : '')}
          satirlar={[{ ad: 'yağış', deger: `${fmt(gunler[idx].yagis_mm ?? 0, 1)} mm` }, { ad: 'bitki tüketimi', deger: `${fmt(gunler[idx].etc_mm ?? 0, 1)} mm` }, { ad: 'toplam', deger: `${sg(gunler[idx].birikimli_mm ?? 0)}${fmt(Math.abs(gunler[idx].birikimli_mm ?? 0), 0)} mm` }]} />
      )}
    </div>
  )
}
