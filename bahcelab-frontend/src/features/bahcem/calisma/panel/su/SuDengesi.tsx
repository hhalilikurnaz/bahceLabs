import { useMemo } from 'react'
import { useElementWidth } from '../../../hooks/useElementWidth'
import { gunAy, sayi } from '../../../lib/format'
import { SU_RENK } from '../../../lib/paletler'
import type { SuYaniti } from '../../../api/suApi'

const KENAR = { sol: 46, sag: 38, ust: 10, alt: 24 }
const YUKSEKLIK = 190

/** Su dengesi: yağış ↑ / ETc ↓ çubukları (mm/gün), birikimli (yağış − ETc) çizgisi, önümüzdeki 7 gün gri bant. */
export function SuDengesi({ denge }: { denge: SuYaniti['denge'] }) {
  const [ref, genislik] = useElementWidth<HTMLDivElement>()
  const w = Math.max(280, genislik)
  const gunler = denge.gunler
  const dolu = useMemo(() => gunler.filter((g) => !g.veri_eksik), [gunler])
  const iw = w - KENAR.sol - KENAR.sag
  const ih = YUKSEKLIK - KENAR.ust - KENAR.alt
  const n = Math.max(1, gunler.length)
  const bar = Math.max(2, iw / n - 1.5)
  const X = (i: number) => KENAR.sol + (i + 0.5) * (iw / n)
  const maks = Math.max(1, ...dolu.map((g) => Math.max(g.yagis_mm ?? 0, g.etc_mm ?? 0)))
  const yMid = KENAR.ust + ih * 0.55 // sıfır çizgisi: yağış yukarı, ETc aşağı
  const yUst = (v: number) => yMid - (v / maks) * (yMid - KENAR.ust)
  const yAlt = (v: number) => yMid + (v / maks) * (KENAR.ust + ih - yMid)
  const kum = dolu.map((g) => g.birikimli_mm ?? 0)
  const kMin = Math.min(0, ...kum)
  const kMaks = Math.max(1, ...kum)
  const yK = (v: number) => KENAR.ust + ih - ((v - kMin) / (kMaks - kMin || 1)) * ih
  const yol = gunler.flatMap((g, i) => (g.veri_eksik || g.birikimli_mm == null ? [] : [`${X(i).toFixed(1)},${yK(g.birikimli_mm).toFixed(1)}`]))
  const ilkTahmin = gunler.findIndex((g) => g.tahmin)
  if (!gunler.length) return <p className="text-[12.5px] text-app-text-muted" data-testid="denge-bos">Su dengesi hesaplanamadı: toprak parametreleri (SoilGrids) alınamadı.</p>
  return (
    <div ref={ref} data-testid="su-dengesi">
      <svg width={w} height={YUKSEKLIK} viewBox={`0 0 ${w} ${YUKSEKLIK}`} role="img" aria-label="Su dengesi: günlük yağış ve ETc çubukları, birikimli denge çizgisi, 7 günlük tahmin" className="block overflow-visible">
        {ilkTahmin >= 0 && <rect x={X(ilkTahmin) - iw / n / 2} y={KENAR.ust} width={iw - (X(ilkTahmin) - iw / n / 2 - KENAR.sol)} height={ih} fill={SU_RENK.band} data-testid="tahmin-bandi" />}
        <line x1={KENAR.sol} x2={w - KENAR.sag} y1={yMid} y2={yMid} stroke="var(--color-app-border-strong)" strokeWidth={0.8} />
        <text x={KENAR.sol - 4} y={yUst(maks) + 4} textAnchor="end" fontSize={10} fill="var(--color-app-text-muted)" className="num">{sayi(maks, 0)} mm</text>
        <text x={KENAR.sol - 4} y={yMid + 3} textAnchor="end" fontSize={10} fill="var(--color-app-text-muted)" className="num">0</text>
        <text x={KENAR.sol - 4} y={yAlt(maks) + 3} textAnchor="end" fontSize={10} fill="var(--color-app-text-muted)" className="num">−{sayi(maks, 0)}</text>
        {gunler.map((g, i) =>
          g.veri_eksik ? null : (
            <g key={g.tarih}>
              {(g.yagis_mm ?? 0) > 0 && <rect x={X(i) - bar / 2} y={yUst(g.yagis_mm ?? 0)} width={bar} height={yMid - yUst(g.yagis_mm ?? 0)} fill={SU_RENK.su} opacity={(g.etkili_yagis_mm ?? 0) === 0 ? 0.3 : g.tahmin ? 0.55 : 1} data-testid="yagis-cubugu" data-sayilan={String((g.etkili_yagis_mm ?? 0) > 0)}><title>{`${gunAy(g.tarih)} · yağış ${sayi(g.yagis_mm ?? 0, 1)} mm (${g.yagis_kaynagi})${(g.etkili_yagis_mm ?? 0) === 0 ? ' · eşiğin altında: dengede sayılmaz' : ''}`}</title></rect>}
              <rect x={X(i) - bar / 2} y={yMid} width={bar} height={Math.max(0, yAlt(g.etc_mm ?? 0) - yMid)} fill={SU_RENK.etc} opacity={g.tahmin ? 0.55 : 1}><title>{`${gunAy(g.tarih)} · ETc ${sayi(g.etc_mm ?? 0, 1)} mm`}</title></rect>
            </g>
          ),
        )}
        {yol.length > 1 && <polyline points={yol.join(' ')} fill="none" stroke="var(--color-app-text)" strokeWidth={1.8} strokeLinejoin="round" data-testid="birikimli-cizgi" />}
        {dolu.length > 0 && <text x={w - KENAR.sag + 4} y={yK(kum[kum.length - 1]) + 3} fontSize={10.5} fontWeight={700} fill="var(--color-app-text)" className="num" data-testid="birikimli-son">{sayi(kum[kum.length - 1], 0)} mm</text>}
        {[0, Math.floor(n / 2), n - 1].map((i) => <text key={i} x={X(i)} y={YUKSEKLIK - 6} textAnchor="middle" fontSize={10} fill="var(--color-app-text-muted)">{gunAy(gunler[i].tarih)}</text>)}
      </svg>
      <p className="mt-0.5 text-[11.5px] leading-snug text-app-text-muted">
        <span style={{ color: SU_RENK.su }}>■</span> yağış (↑) · <span style={{ color: SU_RENK.etc }}>■</span> ETc (↓) · siyah çizgi: birikimli (yağış − ETc; kendi ölçeğinde, son değer sağda), 30 gün geçmiş + 7 gün tahmin (gri bant, soluk çubuk); çok soluk yağış çubuğu = günlük 2 mm altı, dengede sayılmaz.
        {denge.taw_mm != null && <> Kullanılabilir su kapasitesi ≈ {sayi(denge.taw_mm, 0)} mm, stres eşiği {sayi(denge.tukenme_esigi_mm ?? 0, 0)} mm tükenme. Sulama kaydı yoktur.</>}
      </p>
      <p className="text-[11.5px] leading-snug text-app-text-muted" data-testid="kc-notu">{denge.kc_notu}.</p>
    </div>
  )
}
