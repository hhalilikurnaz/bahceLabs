import { localPoint } from '@visx/event'
import { scaleLinear } from '@visx/scale'
import { useMemo, useRef, useState } from 'react'
import { Annotation, ChartTooltip, DirectLabel, Forecast } from './parcalar'
import { useIlkCizim } from './useIlkCizim'
import { ayAdimi, ayKisa, fmt, niceTicks, YAZI } from './ekseller'
import { useTimeDomain } from './timeDomainBaglam'

export interface BandAy { p10: number; p25: number; p50: number; p75: number; p90: number }
export interface EgriNoktasi { tarih: string; deger: number; alt: number; ust: number; tahmini: boolean }
export interface Gozlem { tarih: string; deger: number; kaynak: 's2' | 'hls' }

const gun = (iso: string): number => (Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${iso.slice(0, 4)}-01-01T00:00:00Z`)) / 86_400_000 + 0.5
const isoOf = (yil: number, doy: number): string => new Date(Date.UTC(yil, 0, 1) + Math.round(doy - 0.5) * 86_400_000).toISOString().slice(0, 10)
const trGun = (iso: string): string => `${Number(iso.slice(8, 10))} ${ayKisa(Number(iso.slice(5, 7)) - 1)}`

function catmull(pts: [number, number][]): string {
  if (pts.length < 3) return pts.length ? `M${pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L')}` : ''
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const [p0, p1, p2, p3] = [pts[Math.max(0, i - 1)], pts[i], pts[i + 1], pts[Math.min(pts.length - 1, i + 2)]]
    d += ` C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)},${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)},${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`
  }
  return d
}

/**
 * BandLine (sezon eğrisi v2): bahçenin kendi normal bandı (p25–p75 koyu, p10–p90 açık, ortanca kesikli) + bu yıl çizgisi + doğrudan etiket.
 * Gözlem dolu, tahmin taralı/kesikli (ilke 7); lejant paragrafı yok (ilke 9). Üzerinde gezinince dikey imleç + değer kutusu; imleç tarihi
 * TimeDomain'e yazılır (harita tarih kutusu vurgulanır); Sentinel-2 noktasına tıklayınca harita o görüntüye geçer. İlk görünüşte çizgi soldan sağa çizilir.
 */
export function BandLine({ yil, genislik, yukseklik, noktalar, gozlemler, bant, bandAdi = 'normal aralık', bandAlt, bugun, vurguTarih, ayrintili = false, kesintisiz = false, sagBosluk = 96, testId = 'band-cizgi', basamak = 2 }: {
  yil: number; genislik: number; yukseklik: number; noktalar: EgriNoktasi[]; gozlemler: Gozlem[]; bant: Record<number, BandAy>; bandAdi?: string; bandAlt?: string; bugun: string
  vurguTarih?: string | null; ayrintili?: boolean; kesintisiz?: boolean; sagBosluk?: number; testId?: string; basamak?: number
}) {
  const { imlec, setImlec, sec } = useTimeDomain()
  const kap = useRef<HTMLDivElement>(null)
  const [fare, setFare] = useState<{ x: number; y: number } | null>(null)
  const ilk = useIlkCizim(noktalar.length > 0)
  const m = { sol: 38, sag: sagBosluk, ust: 24, alt: 28 }
  const iw = genislik - m.sol - m.sag
  const ih = yukseklik - m.ust - m.alt
  const aylar = Object.keys(bant).map(Number).sort((a, b) => a - b)
  const { X, Y, ticks, lo, hi } = useMemo(() => {
    const vals = [...aylar.flatMap((a) => [bant[a].p10, bant[a].p90]), ...noktalar.map((n) => n.deger), ...gozlemler.map((g) => g.deger)]
    let lo = Math.min(...vals) - 0.03
    let hi = Math.max(...vals) + 0.03
    const ticks = niceTicks({ min: lo, max: hi }, 4)
    lo = Math.min(lo, ticks[0]); hi = Math.max(hi, ticks[ticks.length - 1])
    const X = scaleLinear({ domain: [0, 365], range: [m.sol, m.sol + iw] })
    const Y = scaleLinear({ domain: [lo, hi], range: [m.ust + ih, m.ust] })
    return { X, Y, ticks, lo, hi }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noktalar, gozlemler, bant, iw, ih])
  const orta = aylar.map((a) => [X(15 + 30.4 * (a - 1)), a] as const)
  const alan = (k1: keyof BandAy, k2: keyof BandAy) => `${catmull(orta.map(([x, a]) => [x, Y(bant[a][k2])] as [number, number]))} L${catmull(orta.map(([x, a]) => [x, Y(bant[a][k1])] as [number, number]).reverse()).slice(1).replace('M', 'L')}Z`
  const segler = useMemo(() => {
    const s: { tahmini: boolean; pts: EgriNoktasi[] }[] = []
    for (const p of noktalar) {
      if (s.length && s[s.length - 1].tahmini === p.tahmini) s[s.length - 1].pts.push(p)
      else s.push({ tahmini: p.tahmini, pts: [p] })
    }
    return s
  }, [noktalar])
  const sonGoz = gozlemler.reduce((a, g) => (g.tarih > a ? g.tarih : a), '')
  const s2 = gozlemler.filter((g) => g.kaynak === 's2')
  const s2Vurgu = (vurguTarih && s2.find((g) => g.tarih === vurguTarih)) || [...s2].sort((a, b) => (a.tarih < b.tarih ? 1 : -1))[0]
  const yakin = (t: string) => noktalar.reduce<EgriNoktasi | null>((b, p) => (!b || Math.abs(Date.parse(p.tarih) - Date.parse(t)) < Math.abs(Date.parse(b.tarih) - Date.parse(t)) ? p : b), null)
  const imlecNokta = imlec ? yakin(imlec) : null
  const bugunX = X(gun(bugun))
  const adim = ayAdimi(iw)
  const oyna = (e: React.PointerEvent<SVGRectElement>) => {
    const p = localPoint(e)
    if (!p) return
    const d = Math.min(365, Math.max(0, X.invert(p.x)))
    const iso = isoOf(yil, d)
    const n = yakin(iso)
    if (n) setImlec(n.tarih)
    setFare({ x: p.x, y: p.y })
  }
  const tikla = () => {
    if (!imlec || !sec) return
    const en = s2.reduce<Gozlem | null>((b, g) => (!b || Math.abs(Date.parse(g.tarih) - Date.parse(imlec)) < Math.abs(Date.parse(b.tarih) - Date.parse(imlec)) ? g : b), null)
    if (en && Math.abs(Date.parse(en.tarih) - Date.parse(imlec)) <= 6 * 86_400_000) sec(en.tarih)
  }
  const ayBand = imlecNokta ? bant[Number(imlecNokta.tarih.slice(5, 7))] : null
  const cizgiUzun = 4000
  return (
    <div ref={kap} className="relative" style={{ width: genislik }} data-testid={testId}>
      <svg width={genislik} height={yukseklik} viewBox={`0 0 ${genislik} ${yukseklik}`} role="img" aria-label={`${yil} canlılık çizgisi, bahçenin önceki yıllardaki ${bandAdi}ıyla`} className="block overflow-visible">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={m.sol} x2={m.sol + iw} y1={Y(t)} y2={Y(t)} stroke="var(--color-app-border)" />
            <text x={m.sol - 8} y={Y(t) + 4} textAnchor="end" fontSize={YAZI.eksen} fill="var(--color-app-text-dim)" style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(t, 1)}</text>
          </g>
        ))}
        {Array.from({ length: 12 }, (_, i) => i).filter((i) => i % adim === 0).map((i) => (
          <text key={i} x={X(15 + 30.4 * i)} y={yukseklik - 8} textAnchor="middle" fontSize={YAZI.eksen} fill="var(--color-app-text-dim)" data-testid="eksen-ay">{ayKisa(i)}</text>
        ))}
        <g className={ilk ? 'm-draw-band' : undefined} data-testid="normal-bant" data-kesintisiz={noktalar.some((n) => n.tahmini) || noktalar.length > 60 ? 'evet' : undefined}>
          <path d={alan('p10', 'p90')} fill="var(--color-band-acik)" data-testid="band-p10-p90" />
          <path d={alan('p25', 'p75')} fill="var(--color-band-koyu)" data-testid="band-p25-p75" />
          <path d={catmull(orta.map(([x, a]) => [x, Y(bant[a].p50)] as [number, number]))} fill="none" stroke="var(--color-band-ortanca)" strokeWidth={1} strokeDasharray="3 3" />
        </g>
        <g data-testid={kesintisiz ? 'kesintisiz-egri' : 'sezon-yili-egrisi'}>
        {segler.map((s, i) => {
          const pts = s.pts.map((p) => [X(gun(p.tarih)), Y(p.deger)] as [number, number])
          if (s.tahmini && pts.length > 1) {
            const ust = s.pts.map((p) => `${X(gun(p.tarih)).toFixed(1)},${Y(p.ust).toFixed(1)}`)
            const alt = [...s.pts].reverse().map((p) => `${X(gun(p.tarih)).toFixed(1)},${Y(p.alt).toFixed(1)}`)
            return (
              <g key={i}>
                <path d={`M${[...ust, ...alt].join(' L')}Z`} fill="var(--color-app-text-dim)" opacity={0.18} />
                <path d={catmull(pts)} fill="none" stroke="var(--color-app-text)" strokeWidth={1.75} strokeDasharray="5 4" strokeLinecap="round" data-testid="egri-tahmini" />
              </g>
            )
          }
          return pts.length > 1 ? <path key={i} d={catmull(pts)} fill="none" stroke="var(--color-app-text)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={ilk ? 'm-draw-line' : undefined} style={{ ['--draw-len' as string]: cizgiUzun }} data-testid="egri-gozlem-parca" /> : null
        })}
        </g>
        {ayrintili && gozlemler.map((g) => (
          <circle key={`${g.tarih}${g.kaynak}`} cx={X(gun(g.tarih))} cy={Y(g.deger)} r={g.kaynak === 's2' ? 3.2 : 2.4} fill={g.kaynak === 's2' ? 'var(--color-app-text)' : 'var(--color-app-card)'} stroke="var(--color-app-text)" strokeWidth={1.2} data-testid="egri-gozlem" data-kaynak={g.kaynak} />
        ))}
        <line x1={bugunX} x2={bugunX} y1={m.ust - 6} y2={m.ust + ih} stroke="var(--color-app-border-strong)" />
        <text x={bugunX} y={m.ust - 10} textAnchor="middle" fontSize={YAZI.etiket} fill="var(--color-app-text-dim)">bugün</text>
        {sonGoz && Date.parse(bugun) - Date.parse(sonGoz) > 10 * 86_400_000 && (
          <Forecast id={`bos-${testId}`} x={X(gun(sonGoz))} y={m.ust} width={Math.max(0, bugunX - X(gun(sonGoz)))} height={ih} />
        )}
        {s2Vurgu && (
          <g data-testid="harita-gorunumu-noktasi">
            <circle cx={X(gun(s2Vurgu.tarih))} cy={Y(s2Vurgu.deger)} r={5.5} fill="var(--color-app-card)" stroke="var(--color-app-text)" strokeWidth={2} />
            <DirectLabel x={X(gun(s2Vurgu.tarih)) - 9} y={Y(s2Vurgu.deger) + 24} anchor="end" bold>{trGun(s2Vurgu.tarih)} · {fmt(s2Vurgu.deger, basamak)}</DirectLabel>
          </g>
        )}
        <DirectLabel x={m.sol + iw + 8} y={Y(bant[10]?.p50 ?? (lo + hi) / 2) + 4} tone="soluk">{bandAdi}</DirectLabel>
        {bandAlt && <DirectLabel x={m.sol + iw + 8} y={Y(bant[10]?.p50 ?? (lo + hi) / 2) + 19} tone="soluk">{bandAlt}</DirectLabel>}
        {imlecNokta && (
          <g pointerEvents="none" data-testid="grafik-imlec">
            <line x1={X(gun(imlecNokta.tarih))} x2={X(gun(imlecNokta.tarih))} y1={m.ust} y2={m.ust + ih} stroke="var(--color-app-text)" strokeWidth={1} />
            <circle cx={X(gun(imlecNokta.tarih))} cy={Y(imlecNokta.deger)} r={4} fill="var(--color-app-text)" />
          </g>
        )}
        <rect x={m.sol} y={m.ust} width={iw} height={ih} fill="transparent" onPointerMove={oyna} onPointerLeave={() => (setImlec(null), setFare(null))} onClick={tikla} style={{ cursor: sec ? 'pointer' : 'default' }} data-testid="grafik-yuzey" />
      </svg>
      {imlecNokta && fare && (
        <ChartTooltip x={X(gun(imlecNokta.tarih))} y={m.ust + 4} kapsayiciW={genislik} baslik={trGun(imlecNokta.tarih) + (imlecNokta.tahmini ? ' · tahmin' : '')}
          satirlar={[{ ad: 'canlılık', deger: fmt(imlecNokta.deger, basamak) }, ...(ayBand ? [{ ad: bandAdi, deger: `${fmt(ayBand.p25, basamak)}–${fmt(ayBand.p75, basamak)}` }] : [])]} />
      )}
    </div>
  )
}
export { Annotation }
