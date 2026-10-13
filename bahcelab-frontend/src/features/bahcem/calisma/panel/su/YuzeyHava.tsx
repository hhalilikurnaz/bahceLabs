import { useElementWidth } from '../../../hooks/useElementWidth'
import { gunAy, sayi } from '../../../lib/format'
import { SU_RENK } from '../../../lib/paletler'
import type { SuYaniti } from '../../../api/suApi'

const KENAR = { sol: 34, sag: 10, ust: 14, alt: 40 }
const YUKSEKLIK = 190

/** Yüzey–hava sıcaklığı: son 6 Landsat geçişi; yüzey (bahçe) ve hava noktaları arasında fark; stres eşiği (hava + eşik) kesikli; karışık piksel işareti. */
export function YuzeyHava({ sicaklik }: { sicaklik: SuYaniti['sicaklik'] }) {
  const [ref, genislik] = useElementWidth<HTMLDivElement>()
  const w = Math.max(280, genislik)
  const p = sicaklik.noktalar
  if (!p.length) return <p className="text-[12.5px] text-app-text-muted" data-testid="yuzey-hava-bos">Henüz Landsat yüzey sıcaklığı sahnesi yok.</p>
  const tum = p.flatMap((n) => [n.yuzey_bahce_c, n.hava_c, n.hava_c == null ? null : n.hava_c + sicaklik.stres_esigi_c]).filter((v): v is number => v != null)
  const lo = Math.floor(Math.min(...tum) - 2)
  const hi = Math.ceil(Math.max(...tum) + 2)
  const iw = w - KENAR.sol - KENAR.sag
  const ih = YUKSEKLIK - KENAR.ust - KENAR.alt
  const X = (i: number) => KENAR.sol + (i + 0.5) * (iw / p.length)
  const Y = (v: number) => KENAR.ust + (1 - (v - lo) / (hi - lo || 1)) * ih
  return (
    <div ref={ref} data-testid="yuzey-hava">
      <svg width={w} height={YUKSEKLIK} viewBox={`0 0 ${w} ${YUKSEKLIK}`} role="img" aria-label="Yüzey ve hava sıcaklığı: son altı Landsat geçişi, stres eşiği ve karışık piksel işareti" className="block overflow-visible">
        {[lo, (lo + hi) / 2, hi].map((t) => (
          <g key={t}>
            <line x1={KENAR.sol} x2={w - KENAR.sag} y1={Y(t)} y2={Y(t)} stroke="var(--color-app-border)" strokeWidth={0.6} />
            <text x={KENAR.sol - 5} y={Y(t) + 3.5} textAnchor="end" fontSize={10} fill="var(--color-app-text-muted)" className="num">{sayi(t, 0)}</text>
          </g>
        ))}
        {p.map((n, i) => (
          <g key={n.tarih} data-testid="sicaklik-noktasi" data-stres={String(n.stres)} data-karisik={String(n.karisik_piksel)}>
            {n.hava_c != null && (
              <>
                <line x1={X(i)} x2={X(i)} y1={Y(n.hava_c)} y2={Y(n.yuzey_bahce_c)} stroke={n.stres ? SU_RENK.yuzey : 'var(--color-app-border-strong)'} strokeWidth={3} strokeLinecap="round" opacity={0.55} />
                <line x1={X(i) - 11} x2={X(i) + 11} y1={Y(n.hava_c + sicaklik.stres_esigi_c)} y2={Y(n.hava_c + sicaklik.stres_esigi_c)} stroke="var(--color-app-text-muted)" strokeWidth={1.2} strokeDasharray="3 2" data-testid="stres-esigi"><title>{`Stres eşiği: hava + ${sicaklik.stres_esigi_c} °C (ön değer)`}</title></line>
                <circle cx={X(i)} cy={Y(n.hava_c)} r={4} fill="var(--color-app-card)" stroke={SU_RENK.hava} strokeWidth={2}><title>{`${gunAy(n.tarih)} · hava ${sayi(n.hava_c, 1)} °C (ERA5-Land, 11:00)`}</title></circle>
              </>
            )}
            <circle cx={X(i)} cy={Y(n.yuzey_bahce_c)} r={4.6} fill={SU_RENK.yuzey}><title>{`${gunAy(n.tarih)} · yüzey (bahçe) ${sayi(n.yuzey_bahce_c, 1)} °C${n.yuzey_tampon_c != null ? ` · tampon ${sayi(n.yuzey_tampon_c, 1)} °C` : ''}`}</title></circle>
            {n.fark_c != null && <text x={X(i)} y={YUKSEKLIK - 24} textAnchor="middle" fontSize={11} fontWeight={700} fill={n.stres ? SU_RENK.yuzey : 'var(--color-app-text)'} className="num">{n.fark_c > 0 ? '+' : ''}{sayi(n.fark_c, 1)}</text>}
            {n.karisik_piksel && <text x={X(i)} y={YUKSEKLIK - 11} textAnchor="middle" fontSize={10} fill="var(--color-app-text-muted)" data-testid="karisik-piksel">▲ karışık</text>}
            <text x={X(i)} y={YUKSEKLIK - 1} textAnchor="middle" fontSize={10} fill="var(--color-app-text-muted)">{gunAy(n.tarih)}</text>
          </g>
        ))}
      </svg>
      <p className="mt-0.5 text-[11.5px] leading-snug text-app-text-muted">
        <span style={{ color: SU_RENK.yuzey }}>●</span> yüzey (bahçe) · <span style={{ color: SU_RENK.hava }}>○</span> hava (11:00) · alttaki sayı: yüzey − hava (°C) · kesikli işaret: stres eşiği (hava + {sayi(sicaklik.stres_esigi_c, 0)} °C, ön değer) · ▲ karışık: bahçe ile 300 m tampon arasındaki fark ≥ {sayi(sicaklik.karisik_piksel_esigi_c, 1)} °C (100 m piksel bahçe dışını da içerir).
      </p>
    </div>
  )
}
