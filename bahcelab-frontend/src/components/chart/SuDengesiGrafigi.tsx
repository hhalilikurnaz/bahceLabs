import { scaleLinear } from '@visx/scale'
import { DirectLabel } from './parcalar'
import { ayKisa, fmt, niceTicks, YAZI } from './ekseller'
import { useIlkCizim } from './useIlkCizim'

export interface DengeGunuGrafik { tarih: string; etc: number; eta: number; sulama: number; yagis: number; karsilanmayan: number }
const trGun = (iso: string): string => `${Number(iso.slice(8, 10))} ${ayKisa(Number(iso.slice(5, 7)) - 1)}`

/**
 * Su dengesi · son 14 gün (vana ortalaması, mm/gün), TEK eksen: ihtiyaç = çerçeve (ETc), sulama = dolu koyu, yağmur = mavi (eşik üstü okla), karşılanmayan = kırmızı (ETc − ETa).
 */
export function SuDengesiGrafigi({ gunler, genislik, yukseklik = 170, yagisVurguMm }: { gunler: DengeGunuGrafik[]; genislik: number; yukseklik?: number; yagisVurguMm: number }) {
  const ilk = useIlkCizim(gunler.length > 0)
  const n = Math.max(1, gunler.length)
  const [sol, sag, ust, alt] = [40, 12, 22, 26]
  const iw = Math.max(40, genislik - sol - sag)
  const ih = yukseklik - ust - alt
  const maksHam = Math.max(1, ...gunler.map((g) => Math.max(g.etc, g.sulama, Math.min(g.yagis, yagisVurguMm))))
  const tk = niceTicks({ min: 0, max: maksHam }, 3)
  const Y = scaleLinear({ domain: [0, Math.max(maksHam, tk[tk.length - 1])], range: [ust + ih, ust] })
  const w = iw / n
  const bw = Math.max(5, w - 4)
  return (
    <svg width={genislik} height={yukseklik} viewBox={`0 0 ${genislik} ${yukseklik}`} role="img" aria-label="Son 14 gün su dengesi, mm/gün: ihtiyaç çerçeve, sulama koyu, yağmur mavi, karşılanmayan kırmızı" className="block overflow-visible" data-testid="su-dengesi-grafigi">
      {tk.map((t) => (
        <g key={t}><line x1={sol} x2={sol + iw} y1={Y(t)} y2={Y(t)} stroke="var(--color-app-border)" /><text x={sol - 8} y={Y(t) + 4} textAnchor="end" fontSize={YAZI.eksen} fill="var(--color-app-text-dim)">{fmt(t, 0)}</text></g>
      ))}
      <text x={sol - 8} y={ust - 8} textAnchor="end" fontSize={YAZI.eksen} fill="var(--color-app-text-dim)">mm</text>
      <g className={ilk ? 'm-draw-band' : undefined}>
        {gunler.map((g, i) => {
          const x = sol + i * w + (w - bw) / 2
          const ok = g.yagis > yagisVurguMm
          return (
            <g key={g.tarih} data-testid="denge-gunu">
              <rect x={x} y={Y(g.etc)} width={bw} height={Y(0) - Y(g.etc)} fill="none" stroke="var(--color-app-text-muted)" strokeWidth={1.25} data-testid="denge-ihtiyac" />
              {g.karsilanmayan > 0.05 && <rect x={x} y={Y(g.etc)} width={bw} height={Math.max(1, Y(g.etc - g.karsilanmayan) - Y(g.etc))} fill="var(--color-app-danger)" opacity={0.85} data-testid="denge-karsilanmayan" />}
              {g.sulama > 0 && <rect x={x + bw * 0.25} y={Y(g.sulama)} width={bw * 0.5} height={Y(0) - Y(g.sulama)} fill="var(--color-app-text)" data-testid="denge-sulama" />}
              {g.yagis > 0 && <rect x={x} y={Y(Math.min(g.yagis, yagisVurguMm))} width={bw * 0.4} height={Y(0) - Y(Math.min(g.yagis, yagisVurguMm))} fill="var(--color-app-water)" data-testid="denge-yagmur" />}
              {ok && <g data-testid="denge-yagmur-oku"><path d={`M${x + bw * 0.2},${ust - 2} v-9 m-3,3 l3,-4 l3,4`} stroke="var(--color-app-water)" fill="none" strokeWidth={1.5} /><DirectLabel x={x + bw * 0.2} y={ust - 14} anchor="middle" tone="su">{fmt(g.yagis, 0)}</DirectLabel></g>}
            </g>
          )
        })}
      </g>
      {[0, Math.floor(n / 2), n - 1].map((i) => gunler[i] && <text key={i} x={sol + i * w + w / 2} y={yukseklik - 8} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} fontSize={YAZI.eksen} fill="var(--color-app-text-dim)">{trGun(gunler[i].tarih)}</text>)}
    </svg>
  )
}
