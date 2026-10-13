import { useMemo, useState } from 'react'
import { useDarEkran } from '../../hooks/useDarEkran'
import { sayi } from '../../lib/format'
import { histogram } from '../../lib/izgara'
import { rampCss } from '../../lib/paletler'
import { useCalismaStore } from '../calismaStore'
import type { HaritaGorunumu } from '../useHaritaGorunumu'

const BINS = 24
const W = 258
const H = 56
const TIPIK_ETIKETI = 'tipik bant (ön değer)'

/**
 * Sol alt: histogram lejantı. Başlık tek satır; skala seçimi başlığın altında küçük bir seçim.
 * Sütun rengi haritadakiyle aynı; üzerine gelince o aralıktaki pikseller vurgulanır. Ortanca çizgisi ve (varsa) ürünün tipik bandı
 * (ön değer) aynı eksende gösterilir.
 */
export function HistogramLejant({ view }: { view: HaritaGorunumu }) {
  const skala = useCalismaStore((s) => s.skala)
  const setSkala = useCalismaStore((s) => s.setSkala)
  const setVurgu = useCalismaStore((s) => s.setVurgu)
  const [hover, setHover] = useState<number | null>(null)
  // Telefonda varsayılan küçük bir çip; dokununca histogramlı tam lejant açılır (masaüstünde hep açık)
  const dar = useDarEkran()
  const [elle, setElle] = useState<boolean | null>(null)
  const acik = elle ?? !dar
  const bins = useMemo(() => (view.izgara ? histogram(view.izgara, view.alan, BINS) : []), [view.izgara, view.alan])
  if (!view.izgara || !view.ramp) return null
  const max = Math.max(...bins.map((b) => b.share), 1e-6)
  const ramp = view.ramp
  const bw = W / BINS
  const degisim = view.tanim.fark === true
  const baslik = view.tanim.birim ? `${view.tanim.ad} · ${view.tanim.birim}` : `${view.tanim.ad}${degisim ? ' farkı' : ''}`
  const hb = hover !== null ? bins[hover] : null
  const [lo, hi] = view.alan
  const x = (v: number) => Math.min(W, Math.max(0, ((v - lo) / (hi - lo || 1)) * W))
  const band = view.tipikBant
  const bandVisible = band !== null && band.ust > lo && band.alt < hi
  const [dusuk, yuksek] = view.tanim.uclar
  if (!acik) {
    return (
      <button type="button" onClick={() => setElle(true)} aria-expanded={false} data-testid="lejant-cip" className="glass flex min-h-11 items-center gap-2 px-3.5 text-[12.5px] font-semibold">
        {baslik}
        {view.ortanca !== null && <span className="num font-normal text-app-text-muted">· ortanca {sayi(view.ortanca)}</span>}
        <span aria-hidden>▴</span>
      </button>
    )
  }
  return (
    <div className="glass w-[286px] max-w-full px-3.5 pb-2.5 pt-3" data-testid="histogram-lejant">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12.5px] font-bold leading-tight">{baslik}</span>
        {dar && <button type="button" onClick={() => setElle(false)} aria-expanded aria-label="Lejantı küçült" className="grid h-11 w-11 place-items-center text-app-text-muted">▾</button>}
      </div>
      <div className="mt-1 flex gap-3 text-[11px]" role="group" aria-label="Renk skalası">
        {(['kendi', 'genel'] as const).map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={skala === k}
            onClick={() => setSkala(k)}
            className={`border-b py-0.5 max-[560px]:min-h-11 max-[560px]:py-3 ${skala === k ? 'border-app-text font-semibold text-app-text' : 'border-transparent text-app-text-muted hover:text-app-text'}`}
          >
            {k === 'kendi' ? 'Bahçenin kendi farkları' : 'Genel skala'}
          </button>
        ))}
      </div>
      <svg width={W} height={H + (bandVisible ? 8 : 0)} className="mt-2 block" role="img" aria-label="Piksel dağılımı" onMouseLeave={() => (setHover(null), setVurgu(null))}>
        {bins.map((b, i) => {
          const h = Math.max(1, (b.share / max) * (H - 4))
          return (
            <rect
              key={i}
              x={i * bw + 0.5}
              y={H - h}
              width={bw - 1}
              height={h}
              rx={1}
              fill={rampCss(ramp, (i + 0.5) / BINS)}
              stroke={hover === i ? 'var(--color-app-text)' : 'rgba(0,0,0,.12)'}
              strokeWidth={hover === i ? 1.5 : 0.5}
              onMouseEnter={() => (setHover(i), setVurgu([b.from, b.to]))}
            />
          )
        })}
        <line x1={0} x2={W} y1={H - 0.5} y2={H - 0.5} stroke="var(--color-app-border)" />
        {view.ortanca !== null && view.ortanca >= lo && view.ortanca <= hi && (
          <rect data-testid="lejant-ortanca" x={x(view.ortanca) - 0.75} y={0} width={1.5} height={H} fill="var(--color-app-text)" opacity={0.85}><title>{`ortanca ${sayi(view.ortanca)}`}</title></rect>
        )}
        {bandVisible && band && <rect data-testid="lejant-tipik-bant" x={x(band.alt)} y={H + 2} width={Math.max(2, x(band.ust) - x(band.alt))} height={4} rx={1} fill="var(--color-app-text)" opacity={0.55}><title>{`${TIPIK_ETIKETI}: ${sayi(band.alt)}–${sayi(band.ust)}`}</title></rect>}
      </svg>
      <div className="num mt-1 flex justify-between text-[11px] text-app-text-muted max-[560px]:mt-2">
        <span>{sayi(lo)}</span>
        <span>{hb ? `${sayi(hb.from)}–${sayi(hb.to)} · alanın %${Math.round(hb.share * 100)}’i` : `${dusuk} → ${yuksek}`}</span>
        <span>{sayi(hi)}</span>
      </div>
      <div className="num mt-0.5 text-[11px] text-app-text-muted" data-testid="lejant-ozet">
        {view.ortanca !== null && <span>ortanca <b className="font-semibold text-app-text">{degisim && view.ortanca > 0 ? '+' : ''}{sayi(view.ortanca)}</b></span>}
        {bandVisible && band && <span> · {TIPIK_ETIKETI} {sayi(band.alt)}–{sayi(band.ust)}{band.onDeger ? ' · mühendis onayı bekliyor' : ''}</span>}
      </div>
      {view.tanim.not && <p className="mt-1 text-[11px] leading-snug text-app-text-muted" data-testid="lejant-not">{view.tanim.not}</p>}
      {view.tanim.gorunum === 'daireler' && <p className="mt-1 text-[11px] leading-snug text-app-text-muted" data-testid="lejant-not">Daire = 10 m piksel, ağaç konumu değil.</p>}
    </div>
  )
}
