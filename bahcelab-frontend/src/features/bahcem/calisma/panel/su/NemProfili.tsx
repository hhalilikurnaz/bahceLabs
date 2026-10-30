import { useElementWidth } from '../../../hooks/useElementWidth'
import { sayi } from '../../../lib/format'
import { SU_RENK } from '../../../lib/paletler'
import type { NemProfili as Profil } from '../../../api/suApi'

const SATIR_Y = 38
const KENAR = { sol: 74, sag: 12, ust: 8, alt: 26 }

/** Toprak nem profili: 4 derinlik; mavi = bugün (model tahmini ise içi boş işaret), kesikli = 30 gün önce, gri bant = «bu bahçenin normal aralığı» (p10–p90). */
export function NemProfili({ profil }: { profil: Profil }) {
  const [ref, genislik] = useElementWidth<HTMLDivElement>()
  const w = Math.max(280, genislik)
  const k = profil.katmanlar
  const tum = k.flatMap((l) => [l.normal_alt, l.normal_ust, l.bugun, l.otuz_gun_once]).filter((v): v is number => v != null)
  const lo = Math.max(0, Math.min(...tum) - 0.03)
  const hi = Math.max(...tum) + 0.03
  const X = (v: number) => KENAR.sol + ((v - lo) / (hi - lo || 1)) * (w - KENAR.sol - KENAR.sag)
  const Y = (i: number) => KENAR.ust + SATIR_Y * i + SATIR_Y / 2
  const yukseklik = KENAR.ust + SATIR_Y * k.length + KENAR.alt
  const cizgi = (anahtar: 'bugun' | 'otuz_gun_once') => {
    const pts = k.flatMap((l, i) => (l[anahtar] == null ? [] : [[X(l[anahtar] as number), Y(i)] as const]))
    return pts.length > 1 ? `M${pts.map((p) => p.join(',')).join(' L')}` : ''
  }
  const ticks = [lo, (lo + hi) / 2, hi]
  return (
    <div ref={ref} data-testid="nem-profili">
      <svg width={w} height={yukseklik} viewBox={`0 0 ${w} ${yukseklik}`} role="img" aria-label="Toprak nem profili: dört derinlikte bugünkü nem, 30 gün öncesi ve bu bahçenin normal aralığı" className="block overflow-visible">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={X(t)} x2={X(t)} y1={KENAR.ust} y2={yukseklik - KENAR.alt} stroke="var(--color-app-border)" strokeWidth={0.6} />
            <text x={X(t)} y={yukseklik - 8} textAnchor="middle" fontSize={12} fill="var(--color-app-text-muted)" className="num">{sayi(t, 2)}</text>
          </g>
        ))}
        {k.map((l, i) => (
          <g key={l.derinlik}>
            <text x={0} y={Y(i) + 4} fontSize={12} fontWeight={600} fill="var(--color-app-text)">{l.derinlik}</text>
            <rect x={X(l.normal_alt)} y={Y(i) - 11} width={Math.max(2, X(l.normal_ust) - X(l.normal_alt))} height={22} rx={3} fill={SU_RENK.band} stroke="var(--color-app-border-strong)" strokeWidth={0.8} data-testid="normal-aralik">
              <title>{`Bu bahçenin normal aralığı (p10–p90): ${sayi(l.normal_alt, 2)}–${sayi(l.normal_ust, 2)} m³/m³`}</title>
            </rect>
          </g>
        ))}
        <path d={cizgi('otuz_gun_once')} fill="none" stroke={SU_RENK.suSoluk} strokeWidth={1.6} strokeDasharray="4 3" data-testid="profil-30gun" />
        {k.map((l, i) => l.otuz_gun_once != null && <circle key={`o${i}`} cx={X(l.otuz_gun_once)} cy={Y(i)} r={3} fill="var(--color-app-card)" stroke={SU_RENK.suSoluk} strokeWidth={1.4} />)}
        <path d={cizgi('bugun')} fill="none" stroke={SU_RENK.su} strokeWidth={2} data-testid="profil-bugun" />
        {k.map((l, i) =>
          l.bugun == null ? null : (
            <circle key={`b${i}`} cx={X(l.bugun)} cy={Y(i)} r={4.2} fill={l.bugun_kaynak === 'model' ? 'var(--color-app-card)' : SU_RENK.su} stroke={SU_RENK.su} strokeWidth={2} data-testid="profil-nokta" data-kaynak={l.bugun_kaynak}>
              <title>{`${l.derinlik}: ${sayi(l.bugun, 3)} m³/m³ · normale göre doluluk %${Math.round(l.doluluk ?? 0)} · ${l.bugun_kaynak === 'model' ? 'model tahmini' : 'ERA5-Land'}`}</title>
            </circle>
          ),
        )}
      </svg>
      <p className="mt-0.5 text-caption leading-snug text-app-text-muted">
        <span style={{ color: SU_RENK.su }}>●</span> bugün{profil.katmanlar.some((l) => l.bugun_kaynak === 'model') ? ' (içi boş: model tahmini)' : ''} · <svg width={22} height={8} className="inline-block align-middle" aria-hidden><line x1={1} x2={21} y1={4} y2={4} stroke={SU_RENK.suSoluk} strokeWidth={1.8} strokeDasharray="4 3" /></svg> 30 gün önce · gri bant: {profil.donem ?? 'dönem'} normal aralığı (yılın aynı ±{profil.donem_pencere_gun} günü, p10–p90, 2015–2025). m³/m³; 100–255 cm modelde yoktur.
      </p>
    </div>
  )
}
