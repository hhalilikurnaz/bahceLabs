import { localPoint } from '@visx/event'
import { scaleLinear } from '@visx/scale'
import { ChartTooltip, DirectLabel, Forecast, Threshold } from './parcalar'
import { ayKisa, fmt, niceTicks, YAZI } from './ekseller'
import { useTimeDomain } from './timeDomainBaglam'
import { useIlkCizim } from './useIlkCizim'

export interface KovaGunu { tarih: string; tukenme_mm: number; yagis_mm: number | null; etkili_yagis_mm: number | null; uygulanan_net_mm: number; planli_net_mm: number; tahmin: boolean; veri_eksik: boolean }
const trGun = (iso: string): string => `${Number(iso.slice(8, 10))} ${ayKisa(Number(iso.slice(5, 7)) - 1)}`

/**
 * Toprak kovası (kanıt grafiği, ilke 11): TEK eksen (mm). Çizgi = köklerin ulaşabildiği su (TAW − eksik), Threshold = sulama eşiği (TAW − RAW; altına inince bitki zorlanır),
 * çubuklar = etkili yağış (mavi), uygulanan sulama (dolu), planlanan sulama (taralı çerçeve). Önümüzdeki günler Forecast; «bugün» çizgisi.
 */
export function KovaGrafigi({ gunler, tawMm, rawMm, bugun, genislik, yukseklik = 230, adimGunu = null }: { gunler: KovaGunu[]; tawMm: number; rawMm: number; bugun: string; genislik: number; yukseklik?: number; adimGunu?: string | null }) {
  const { imlec, setImlec } = useTimeDomain()
  const ilk = useIlkCizim(gunler.length > 0)
  const n = Math.max(1, gunler.length)
  const [sol, sag, ust, alt] = [40, 64, 18, 28]
  const iw = Math.max(40, genislik - sol - sag)
  const ih = yukseklik - ust - alt
  const X = (i: number) => sol + ((i + 0.5) * iw) / n
  const bar = Math.max(3, iw / n - 2)
  const tk = niceTicks({ min: 0, max: tawMm }, 4)
  const Y = scaleLinear({ domain: [0, Math.max(tawMm, tk[tk.length - 1])], range: [ust + ih, ust] })
  const esik = tawMm - rawMm
  const ilkTahmin = gunler.findIndex((g) => g.tahmin)
  const bx = ilkTahmin >= 0 ? X(ilkTahmin) - iw / n / 2 : 0
  const bw = ilkTahmin >= 0 ? sol + iw - bx : 0
  const bugunI = gunler.findIndex((g) => g.tarih === bugun)
  const pts = gunler.flatMap((g, i) => (g.veri_eksik ? [] : [[X(i), Y(tawMm - g.tukenme_mm), g.tahmin] as const]))
  const yol = (p: readonly (readonly [number, number, boolean])[]) => (p.length ? `M${p.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L')}` : '')
  const gecmis = pts.filter((p) => !p[2])
  const gelecek = pts.filter((p) => p[2] || pts.indexOf(p) === gecmis.length - 1)
  const aktifTarih = adimGunu ?? imlec
  const idx = aktifTarih ? gunler.findIndex((g) => g.tarih === aktifTarih) : -1
  const oyna = (e: React.PointerEvent<SVGRectElement>) => {
    const p = localPoint(e)
    if (!p) return
    setImlec(gunler[Math.min(n - 1, Math.max(0, Math.floor(((p.x - sol) / iw) * n)))].tarih)
  }
  const son = pts[pts.length - 1]
  return (
    <div className="relative" style={{ width: genislik }} data-testid="kova-grafigi">
      <svg width={genislik} height={yukseklik} viewBox={`0 0 ${genislik} ${yukseklik}`} role="img" aria-label="Toprakta kullanılabilir su, mm; sulama eşiği, yağış ve sulama çubukları; önümüzdeki günler taralı" className="block overflow-visible">
        {ilkTahmin >= 0 && <Forecast id="kova-tahmin" x={bx} y={ust - 6} width={bw} height={ih + 12} etiket="tahmin" />}
        {tk.map((t) => (
          <g key={t}>
            <line x1={sol} x2={sol + iw} y1={Y(t)} y2={Y(t)} stroke="var(--color-app-border)" />
            <text x={sol - 8} y={Y(t) + 4} textAnchor="end" fontSize={YAZI.eksen} fill="var(--color-app-text-dim)">{fmt(t, 0)}</text>
          </g>
        ))}
        <text x={sol - 8} y={ust - 6} textAnchor="end" fontSize={YAZI.eksen} fill="var(--color-app-text-dim)">mm</text>
        <Threshold y={Y(esik)} x1={sol} x2={sol + iw} etiket="sulama eşiği" />
        <g className={ilk ? 'm-draw-band' : undefined}>
          {gunler.map((g, i) => {
            if (g.veri_eksik) return null
            const yag = g.etkili_yagis_mm ?? 0
            return (
              <g key={g.tarih}>
                {yag > 0 && <rect x={X(i) - bar / 2} y={Y(yag)} width={bar / 2} height={Y(0) - Y(yag)} fill="var(--color-app-water)" opacity={g.tahmin ? 0.55 : 0.9} data-testid="kova-yagis" />}
                {g.uygulanan_net_mm > 0 && <rect x={X(i)} y={Y(g.uygulanan_net_mm)} width={bar / 2} height={Y(0) - Y(g.uygulanan_net_mm)} fill="var(--color-app-text)" data-testid="kova-uygulanan" />}
                {g.planli_net_mm > 0 && <rect x={X(i)} y={Y(g.planli_net_mm)} width={Math.max(4, bar / 2)} height={Y(0) - Y(g.planli_net_mm)} fill="var(--color-app-card)" stroke="var(--color-app-text)" strokeWidth={1.5} strokeDasharray="3 2" data-testid="kova-planli" />}
              </g>
            )
          })}
        </g>
        {gecmis.length > 1 && <path d={yol(gecmis)} fill="none" stroke="var(--color-app-text)" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" className={ilk ? 'm-draw-line' : undefined} style={{ ['--draw-len' as string]: 1600 }} />}
        {gelecek.length > 1 && <path d={yol(gelecek)} fill="none" stroke="var(--color-app-text)" strokeWidth={2} strokeDasharray="5 4" strokeLinecap="round" data-testid="kova-tahmin-cizgisi" />}
        {bugunI >= 0 && (
          <g data-testid="kova-bugun"><line x1={X(bugunI)} x2={X(bugunI)} y1={ust - 4} y2={ust + ih} stroke="var(--color-app-text-muted)" strokeDasharray="2 3" /><DirectLabel x={X(bugunI)} y={ust - 7} anchor="middle" tone="soluk">bugün</DirectLabel></g>
        )}
        {son && Math.abs(son[1] - Y(esik)) > 16 && <DirectLabel x={Math.min(son[0] + 8, genislik - 2)} y={son[1] + 4} bold tone="metin">{fmt(tawMm - (gunler.filter((g) => !g.veri_eksik).slice(-1)[0]?.tukenme_mm ?? 0), 0)}</DirectLabel>}
        {[0, Math.floor(n / 2), n - 1].map((i) => <text key={i} x={X(i)} y={yukseklik - 8} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} fontSize={YAZI.eksen} fill="var(--color-app-text-dim)">{trGun(gunler[i].tarih)}</text>)}
        {idx >= 0 && <line x1={X(idx)} x2={X(idx)} y1={ust - 4} y2={ust + ih + 2} stroke="var(--color-app-text)" pointerEvents="none" data-testid="grafik-imlec" />}
        <rect x={sol} y={0} width={iw} height={yukseklik} fill="transparent" onPointerMove={oyna} onPointerLeave={() => setImlec(null)} />
      </svg>
      <p className="mt-1 flex flex-wrap gap-x-4 text-caption text-app-text-muted" data-testid="kova-aciklama">
        <span><b className="text-app-text">çizgi</b> köklerin ulaşabildiği su</span>
        <span><i className="mr-1 inline-block h-2.5 w-2.5 align-middle" style={{ background: 'var(--color-app-water)' }} />yağış</span>
        <span><i className="mr-1 inline-block h-2.5 w-2.5 bg-app-text align-middle" />uyguladığınız sulama</span>
        <span><i className="mr-1 inline-block h-2.5 w-2.5 border border-dashed border-app-text align-middle" />planlanan sulama</span>
      </p>
      {idx >= 0 && !gunler[idx].veri_eksik && (
        <ChartTooltip x={X(idx)} y={4} kapsayiciW={genislik} baslik={trGun(gunler[idx].tarih) + (gunler[idx].tahmin ? ' · tahmin' : '')}
          satirlar={[{ ad: 'kullanılabilir su', deger: `${fmt(tawMm - gunler[idx].tukenme_mm, 0)} mm` }, { ad: 'yağış (sayılan)', deger: `${fmt(gunler[idx].etkili_yagis_mm ?? 0, 1)} mm` }, ...(gunler[idx].uygulanan_net_mm > 0 ? [{ ad: 'uygulanan', deger: `${fmt(gunler[idx].uygulanan_net_mm, 1)} mm` }] : []), ...(gunler[idx].planli_net_mm > 0 ? [{ ad: 'planlanan', deger: `${fmt(gunler[idx].planli_net_mm, 1)} mm` }] : [])]} />
      )}
    </div>
  )
}
