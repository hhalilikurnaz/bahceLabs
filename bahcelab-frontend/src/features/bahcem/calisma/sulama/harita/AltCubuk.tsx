import { useMemo, useRef } from 'react'
import { useReducedMotion } from '@/lib/motion'
import type { SimulasyonYaniti } from '../../../api/sulamaPanelApi'
import { ortalama, oncekiSonraki, sulamaGunleri } from '../../../lib/sulamaHarita'
import { useDarEkran } from '../../../hooks/useDarEkran'
import { MOBIL_BAR_PX, tarihMetni, useAltCubukKlavye, useOynatma, AY } from './oynatma'
import { useSulamaHaritaStore, type Hiz } from './sulamaHaritaStore'

/** Alt çubuk (koyu): ▶/❚❚ · 1×/3×/8× · ← önceki / sonraki sulama → · Bugün · sezon şeridi (kova, yağış, sulama, stres, eşik, bugün, oynatma imleci; tıkla-git). */
export function AltCubuk({ sim, gun, tetik }: { sim: SimulasyonYaniti; gun: number; tetik: number | null }) {
  const st = useSulamaHaritaStore()
  const azalt = useReducedMotion()
  const kompakt = useDarEkran(899)
  const n = sim.gunler.length
  const kutu = useRef<HTMLDivElement>(null)
  const gunler = useMemo(() => sulamaGunleri(sim), [sim])
  const { onceki, sonraki } = oncekiSonraki(gunler, gun)
  useOynatma(sim)
  useAltCubukKlavye(sim, gun, azalt)
  const W = 1000
  const H = 64
  const X = (i: number) => (n <= 1 ? 0 : (i / (n - 1)) * W)
  const ort = useMemo(() => sim.gunler.map((_, i) => ortalama(sim.sektorler.map((v) => v.doluluk_pct[i] ?? null))), [sim])
  const yagisMaks = Math.max(1, ...sim.gunler.map((g) => g.yagis_mm))
  const Y = (p: number) => 6 + (1 - Math.max(0, Math.min(100, p)) / 100) * (H - 22)
  const yol = (() => {
    let d = ''
    ort.forEach((p, i) => { if (p !== null) d += `${d === '' || ort[i - 1] === null ? 'M' : 'L'}${X(i).toFixed(1)},${Y(p).toFixed(1)}` })
    return d
  })()
  const stresGunleri = sim.gunler.map((_, i) => sim.sektorler.some((v) => (v.ks[i] ?? 1) < 1))
  const aylar = useMemo(() => {
    const out: { i: number; ad: string }[] = []
    sim.gunler.forEach((g, i) => { if (g.tarih.endsWith('-01') || i === 0) out.push({ i, ad: AY[Number(g.tarih.slice(5, 7)) - 1]! }) })
    return out
  }, [sim])
  const git = (clientX: number) => {
    const r = kutu.current?.getBoundingClientRect()
    if (!r || n < 1) return
    st.setGun(Math.max(0, Math.min(n - 1, Math.round(((clientX - r.left) / r.width) * (n - 1)))))
  }
  const bugun = sim.bugun_idx
  const tarih = sim.gunler[gun]?.tarih
  const klavye = (e: React.KeyboardEvent) => {
    const adim = e.shiftKey ? 7 : 1
    if (e.key === 'ArrowRight') { e.preventDefault(); st.setOynuyor(false); st.setGun(Math.min(n - 1, gun + adim)) }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); st.setOynuyor(false); st.setGun(Math.max(0, gun - adim)) }
    else if (e.key === 'Home') { e.preventDefault(); st.setGun(0) }
    else if (e.key === 'End') { e.preventDefault(); st.setGun(n - 1) }
    else if (e.key === ' ' && !azalt) { e.preventDefault(); st.setOynuyor(!st.oynuyor) }
  }
  const dugme = 'min-h-11 min-w-11 rounded-md border border-white/25 px-2 text-small font-semibold text-app-canvas hover:bg-white/10 disabled:opacity-40'
  return (
    <div className="absolute inset-x-0 bottom-0 z-40 bg-app-text px-3 pb-2 pt-2 text-app-canvas max-[899px]:py-1" style={kompakt ? { height: MOBIL_BAR_PX } : undefined} data-testid="alt-cubuk" role="group" aria-label="Sulama zaman çubuğu">
      <div className="flex items-center gap-x-1.5 max-[899px]:flex-nowrap min-[900px]:flex-wrap min-[900px]:gap-y-1">
        <button type="button" className={dugme} onClick={() => st.setOynuyor(!st.oynuyor)} disabled={azalt} aria-label={st.oynuyor ? 'Duraklat' : 'Oynat'} title={azalt ? 'Hareketi azalt açık: ← → ile gün gün ilerleyin' : undefined} data-testid="alt-oynat">{st.oynuyor ? '❚❚' : '▶'}</button>
        {kompakt ? <button type="button" className={dugme} onClick={() => st.setHiz(st.hiz === 1 ? 3 : st.hiz === 3 ? 8 : 1)} aria-label={`Oynatma hızı ${st.hiz}×, değiştir`} data-testid="alt-hiz-dongu">{st.hiz}×</button> : <div role="radiogroup" aria-label="Oynatma hızı" className="inline-flex">
          {([1, 3, 8] as Hiz[]).map((h) => <button key={h} type="button" role="radio" aria-checked={st.hiz === h} onClick={() => st.setHiz(h)} data-testid={`alt-hiz-${h}`} className={`min-h-11 min-w-11 rounded-md px-2 text-small font-semibold ${st.hiz === h ? 'bg-app-canvas text-app-text' : 'text-app-canvas'}`}>{h}×</button>)}
        </div>}
        <button type="button" className={dugme} disabled={onceki === null} onClick={() => { st.setOynuyor(false); st.setGun(onceki) }} aria-label="Önceki sulama günü" data-testid="alt-onceki-sulama">←{kompakt ? '' : ' önceki sulama'}</button>
        <button type="button" className={dugme} disabled={sonraki === null} onClick={() => { st.setOynuyor(false); st.setGun(sonraki) }} aria-label="Sonraki sulama günü" data-testid="alt-sonraki-sulama">{kompakt ? '' : 'sonraki sulama '}→</button>
        <button type="button" className={dugme} disabled={bugun === null} onClick={() => { st.setOynuyor(false); st.setGun(null) }} data-testid="alt-bugun">Bugün</button>
        <span className="ml-auto text-small font-semibold tabular-nums max-[899px]:text-[12px]" data-testid="alt-tarih" aria-live="off">{tarih ? tarihMetni(tarih) : ''}</span>
      </div>
      <div className="relative mt-1.5 h-[64px] max-[899px]:mt-1 max-[899px]:h-[44px] cursor-pointer touch-none select-none" ref={kutu} onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); git(e.clientX) }} onPointerMove={(e) => { if (e.buttons === 1) git(e.clientX) }} role="slider" tabIndex={0} aria-label="Sezon zaman çizelgesi" aria-valuemin={0} aria-valuemax={Math.max(0, n - 1)} aria-valuenow={gun} aria-valuetext={tarih ? tarihMetni(tarih) : ''} onKeyDown={klavye} data-testid="sezon-seridi">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
          {sim.gunler.map((g, i) => g.yagis_mm > 0 && <rect key={`y${i}`} x={X(i) - 1.5} y={H - 14 - (g.yagis_mm / yagisMaks) * 18} width={3} height={(g.yagis_mm / yagisMaks) * 18} fill="var(--color-app-water)" opacity={0.85} />)}
          {tetik !== null && <line x1={0} x2={W} y1={Y(tetik)} y2={Y(tetik)} stroke="var(--color-app-canvas)" strokeOpacity={0.7} strokeWidth={1} strokeDasharray="6 5" vectorEffect="non-scaling-stroke" />}
          <path d={yol} fill="none" stroke="var(--color-app-canvas)" strokeWidth={1.8} vectorEffect="non-scaling-stroke" />
          {stresGunleri.map((s, i) => s && <rect key={`s${i}`} x={X(i) - 1.5} y={0} width={3} height={5} fill="var(--color-app-warn)" />)}
          {gunler.map((i) => <rect key={`u${i}`} x={X(i) - 2} y={H - 22} width={4} height={22} fill="var(--color-app-water)" />)}
          {bugun !== null && <line x1={X(bugun)} x2={X(bugun)} y1={0} y2={H} stroke="var(--color-app-danger)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />}
          <line x1={X(gun)} x2={X(gun)} y1={0} y2={H} stroke="var(--color-app-canvas)" strokeWidth={2.5} vectorEffect="non-scaling-stroke" data-testid="oynatma-imleci" />
        </svg>
        {aylar.map((a) => <span key={a.i} aria-hidden className="pointer-events-none absolute bottom-0 text-[12px] leading-none text-app-canvas/80" style={{ left: `${(a.i / Math.max(1, n - 1)) * 100}%` }}>{a.ad}</span>)}
        {bugun !== null && <span aria-hidden className={`pointer-events-none absolute top-0 rounded-sm bg-app-danger px-1 text-[12px] leading-4 text-app-canvas ${bugun / Math.max(1, n - 1) > 0.9 ? '-translate-x-full' : '-translate-x-1/2'}`} style={{ left: `${(bugun / Math.max(1, n - 1)) * 100}%` }}>bugün</span>}
      </div>
      <p className="mt-0.5 flex flex-wrap gap-x-3 max-[899px]:hidden text-[12px] leading-4 text-app-canvas/80" data-testid="alt-aciklama">
        <span>— kova (ortalama)</span><span>┄ sulama eşiği{tetik !== null ? ` %${Math.round(tetik)}` : ''}</span><span>▮ sulama</span><span>▮ yağış</span><span>■ stres</span><span>| bugün</span>
      </p>
    </div>
  )
}
