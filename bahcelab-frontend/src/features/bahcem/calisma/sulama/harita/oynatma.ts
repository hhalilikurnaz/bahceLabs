import { useEffect, useMemo } from 'react'
import type { SimulasyonYaniti } from '../../../api/sulamaPanelApi'
import { sulamaGunleri } from '../../../lib/sulamaHarita'
import { useSulamaHaritaStore } from './sulamaHaritaStore'

export const AY = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']
const GUN = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt']
export const tarihMetni = (iso: string): string => `${Number(iso.slice(8, 10))} ${AY[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)} · ${GUN[new Date(`${iso}T12:00:00`).getDay()]}`
/** Mobil (≤ 899 px) alt çubuk yüksekliği (px): alt sayfa bunun üstünde biter; harita görünür alanı hesabı da bunu düşer. */
export const MOBIL_BAR_PX = 108
const SUL_MS = 2600 // sulama gününde gün içi ilerleme süresi (1×)
const GUN_MS = 380 // sulamasız gün (1×)

/** Oynatma döngüsü: sulamasız günler hızlı, sulama günü gün içi ilerlemeyle (dilim 0→1) yavaş. Hareketi azalt açıkken oynatma yok (← → ile gün gün). */
export function useOynatma(sim: SimulasyonYaniti | undefined): void {
  const oynuyor = useSulamaHaritaStore((s) => s.oynuyor)
  const sul = useMemo(() => new Set(sim ? sulamaGunleri(sim) : []), [sim])
  useEffect(() => {
    if (!oynuyor || !sim) return
    let raf = 0
    let son = performance.now()
    let birikim = 0
    let sonYazim = 0
    const dongu = (t: number) => {
      const dt = Math.min(100, t - son)
      son = t
      const st = useSulamaHaritaStore.getState()
      const i = st.gun ?? sim.bugun_idx ?? 0
      const ileri = () => (i + 1 >= sim.gunler.length ? st.setOynuyor(false) : st.setGun(i + 1))
      if (sul.has(i)) {
        const yeni = st.dilim + (dt * st.hiz) / SUL_MS
        if (yeni >= 1) ileri()
        else if (t - sonYazim > 60) { st.setDilim(yeni); sonYazim = t }
      } else {
        birikim += dt * st.hiz
        if (birikim >= GUN_MS) { birikim = 0; ileri() }
      }
      raf = requestAnimationFrame(dongu)
    }
    raf = requestAnimationFrame(dongu)
    return () => cancelAnimationFrame(raf)
  }, [oynuyor, sim, sul])
}

/** Klavye: ← → gün, Shift+← → hafta, Boşluk oynat/duraklat. Yazı alanlarında ve düğmelerde (Boşluk) devreye girmez. */
export function useAltCubukKlavye(sim: SimulasyonYaniti | undefined, gun: number, azalt: boolean): void {
  useEffect(() => {
    if (!sim) return
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.closest('input, textarea, select, [contenteditable="true"], [role="slider"]') || (e.key === ' ' && t.closest('button, a')))) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const st = useSulamaHaritaStore.getState()
      const n = sim.gunler.length
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault()
        st.setOynuyor(false)
        st.setGun(Math.max(0, Math.min(n - 1, gun + (e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 7 : 1))))
      } else if (e.key === ' ' && !azalt) {
        e.preventDefault()
        st.setOynuyor(!st.oynuyor)
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [sim, gun, azalt])
}

