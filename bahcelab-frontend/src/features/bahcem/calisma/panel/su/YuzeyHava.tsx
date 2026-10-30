import { useElementWidth } from '../../../hooks/useElementWidth'
import { gunAy, sayi } from '../../../lib/format'
import { SU_RENK } from '../../../lib/paletler'
import { isaretli, sicaklikCumlesi } from '../../../lib/sicaklikYorumu'
import type { SuYaniti } from '../../../api/suApi'
import { useCalismaStore } from '../../calismaStore'

const KENAR = { sol: 34, sag: 10, ust: 14, alt: 66 }
const YUKSEKLIK = 226

/**
 * Yüzey–hava sıcaklığı: son 6 Landsat geçişi. Yüzey (bahçe) ve hava noktası arasındaki fark, bahçenin AYNI AY Landsat geçmişindeki
 * p25–p75 bandıyla (gölgeli aralık: hava + bant) karşılaştırılır. Bir geçişe dokunmak Yüzey sıcaklığı katmanını o tarihte haritada açar.
 */
export function YuzeyHava({ sicaklik }: { sicaklik: SuYaniti['sicaklik'] }) {
  const [ref, genislik] = useElementWidth<HTMLDivElement>()
  const setKatman = useCalismaStore((s) => s.setKatman)
  const setTarih = useCalismaStore((s) => s.setTarih)
  const secili = useCalismaStore((s) => (s.katman === 'yuzeySicakligi' ? s.tarih : null))
  const w = Math.max(280, genislik)
  const p = sicaklik.noktalar
  if (!p.length) return <p className="text-small text-app-text-muted" data-testid="yuzey-hava-bos">Henüz Landsat yüzey sıcaklığı sahnesi yok.</p>
  const son = p[p.length - 1]
  const tum = p.flatMap((n) => [n.yuzey_bahce_c, n.hava_c, n.hava_c != null && n.normal ? n.hava_c + n.normal.alt_c : null, n.hava_c != null && n.normal ? n.hava_c + n.normal.ust_c : null]).filter((v): v is number => v != null)
  const lo = Math.floor(Math.min(...tum) - 2)
  const hi = Math.ceil(Math.max(...tum) + 2)
  const iw = w - KENAR.sol - KENAR.sag
  const ih = YUKSEKLIK - KENAR.ust - KENAR.alt
  const adim = iw / p.length
  const X = (i: number) => KENAR.sol + (i + 0.5) * adim
  const Y = (v: number) => KENAR.ust + (1 - (v - lo) / (hi - lo || 1)) * ih
  const haritadaAc = (tarih: string) => {
    setKatman('yuzeySicakligi')
    setTarih(tarih)
    document.querySelector('[data-testid="harita-paneli"]')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }) // dar ekranda harita üstte: görünür kıl
  }
  return (
    <div ref={ref} data-testid="yuzey-hava">
      <p className="mb-1 text-[13px] font-semibold leading-snug" data-testid="sicaklik-cumlesi">{sicaklikCumlesi(son)}</p>
      <svg width={w} height={YUKSEKLIK} viewBox={`0 0 ${w} ${YUKSEKLIK}`} role="group" aria-label="Yüzey ve hava sıcaklığı: son altı Landsat geçişi; geçişe dokununca harita o tarihi açar" className="block overflow-visible">
        {[lo, (lo + hi) / 2, hi].map((t) => (
          <g key={t}>
            <line x1={KENAR.sol} x2={w - KENAR.sag} y1={Y(t)} y2={Y(t)} stroke="var(--color-app-border)" strokeWidth={0.6} />
            <text x={KENAR.sol - 5} y={Y(t) + 3.5} textAnchor="end" fontSize={12} fill="var(--color-app-text-muted)" className="num">{sayi(t, 0)}</text>
          </g>
        ))}
        {p.map((n, i) => {
          const acik = secili === n.tarih
          return (
            <g
              key={n.tarih}
              role="button"
              tabIndex={0}
              aria-label={`${gunAy(n.tarih)} Landsat geçişini haritada aç: ${sicaklikCumlesi(n)}`}
              onClick={() => haritadaAc(n.tarih)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), haritadaAc(n.tarih))}
              className="cursor-pointer outline-none focus-visible:[&>rect]:stroke-[var(--color-app-text)]"
              data-testid="sicaklik-noktasi"
              data-tarih={n.tarih}
              data-durum={n.durum}
              data-stres={String(n.stres)}
              data-karisik={String(n.karisik_piksel)}
            >
              <rect x={X(i) - adim / 2 + 1} y={KENAR.ust - 6} width={adim - 2} height={YUKSEKLIK - KENAR.ust + 4} rx={5} fill={acik ? 'var(--color-app-card-hover)' : 'transparent'} stroke={acik ? 'var(--color-app-border-strong)' : 'transparent'} strokeWidth={1} />
              {n.hava_c != null && (
                <>
                  {n.normal && (
                    <rect x={X(i) - 9} y={Y(n.hava_c + n.normal.ust_c)} width={18} height={Math.max(3, Y(n.hava_c + n.normal.alt_c) - Y(n.hava_c + n.normal.ust_c))} rx={2} fill={SU_RENK.band} stroke="var(--color-app-border-strong)" strokeWidth={0.8} data-testid="ay-normali">
                      <title>{`${n.ay} normali: yüzey − hava farkı ${isaretli(n.normal.alt_c)} … ${isaretli(n.normal.ust_c)} °C (p${sicaklik.normal_alt_yuzde}–p${sicaklik.normal_ust_yuzde}, bahçenin ${n.normal.sahne} geçmiş geçişi)`}</title>
                    </rect>
                  )}
                  <line x1={X(i)} x2={X(i)} y1={Y(n.hava_c)} y2={Y(n.yuzey_bahce_c)} stroke={n.stres ? SU_RENK.yuzey : 'var(--color-app-border-strong)'} strokeWidth={3} strokeLinecap="round" opacity={0.55} />
                  <circle cx={X(i)} cy={Y(n.hava_c)} r={4} fill="var(--color-app-card)" stroke={SU_RENK.hava} strokeWidth={2}><title>{`${gunAy(n.tarih)} · hava ${sayi(n.hava_c, 1)} °C (ERA5-Land, 11:00)`}</title></circle>
                </>
              )}
              <circle cx={X(i)} cy={Y(n.yuzey_bahce_c)} r={4.6} fill={SU_RENK.yuzey}><title>{`${gunAy(n.tarih)} · yüzey (bahçe) ${sayi(n.yuzey_bahce_c, 1)} °C${n.yuzey_tampon_c != null ? ` · tampon ${sayi(n.yuzey_tampon_c, 1)} °C` : ''}`}</title></circle>
              {n.fark_c != null && <text x={X(i)} y={YUKSEKLIK - 52} textAnchor="middle" fontSize={12} fill="var(--color-app-text-muted)" className="num">{isaretli(n.fark_c)}</text>}
              <text x={X(i)} y={YUKSEKLIK - 38} textAnchor="middle" fontSize={12} fontWeight={700} fill={n.durum === 'ustunde' ? SU_RENK.yuzey : 'var(--color-app-text)'} className="num" data-testid="normale-gore">
                {n.sapma_c != null ? isaretli(n.sapma_c) : '—'}
              </text>
              <text x={X(i)} y={YUKSEKLIK - 25} textAnchor="middle" fontSize={12} fill="var(--color-app-text-muted)" data-testid={n.karisik_piksel ? 'karisik-piksel' : undefined}>{n.karisik_piksel ? '▲ karışık' : n.stres ? '● stres' : ''}</text>
              <text x={X(i)} y={YUKSEKLIK - 6} textAnchor="middle" fontSize={12} fill="var(--color-app-text-muted)">{gunAy(n.tarih)}</text>
            </g>
          )
        })}
      </svg>
      <p className="mt-0.5 text-caption leading-snug text-app-text-muted">
        <span style={{ color: SU_RENK.yuzey }}>●</span> yüzey (bahçe) · <span style={{ color: SU_RENK.hava }}>○</span> hava (11:00) · gri kutu: bahçenin aynı ay geçmişinde yüzey − hava farkının p{sicaklik.normal_alt_yuzde}–p{sicaklik.normal_ust_yuzde} aralığı · soluk sayı: yüzey − hava (°C) · kalın sayı: aynı ay ortancasından sapma (°C) · ▲ karışık: bahçe ile 300 m tampon farkı ≥ {sayi(sicaklik.karisik_piksel_esigi_c, 1)} °C (100 m piksel bahçe dışını da içerir) · ● stres: yalnız bandın üstünde ve karışık piksel değilken. Aynı ayda en az {sicaklik.min_sahne} geçmiş geçiş yoksa yargı verilmez. Bir geçişe dokununca harita o tarihi açar.
      </p>
    </div>
  )
}
