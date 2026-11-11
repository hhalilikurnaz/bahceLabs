import { create } from 'zustand'
import type { SulamaSistemi } from '../../../api/sulamaApi'
import type { Gosterge } from '../../../lib/sulamaHarita'

/**
 * Sulama modu: panel (Bugün | Simülasyon) ile harita ve alt çubuk AYNI durumu paylaşır. Oynatma durumu (gün, gün içi ilerleme) burada tutulur;
 * harita katmanları bu mağazayı DOĞRUDAN dinler (React'ten geçmeden paint güncellemesi), yalnız çubuk/kartlar gün değişince yeniden çizilir.
 */
export interface SimGirdi {
  yil: number | undefined
  mod: 'plan' | 'aliskanlik'
  sistem: SulamaSistemi | undefined
  kisinti: boolean
  fiyat: string
  elleGun: number[]
  elleSaat: string
}
export const SIM_VARSAYILAN: SimGirdi = { yil: undefined, mod: 'plan', sistem: undefined, kisinti: false, fiyat: '', elleGun: [], elleSaat: '' }

export interface Katmanlar {
  tac: boolean
  hat: boolean
  serit: boolean
}
export type Hiz = 1 | 3 | 8
interface State {
  sim: SimGirdi
  /** Panel sekmesi: «bugun» → harita bu yılı (bugünü) gösterir; «simulasyon» → seçili/tipik yıl */
  sekme: 'bugun' | 'simulasyon'
  setSekme: (s: 'bugun' | 'simulasyon') => void
  setSim: (p: Partial<SimGirdi>) => void
  /** Seçili gün (sim.gunler indeksi); null = bugün (bugun_idx) ya da yılın ilk günü */
  gun: number | null
  /** Gün içi ilerleme 0–1 (yalnız sulama gününde oynarken anlamlı) */
  dilim: number
  oynuyor: boolean
  hiz: Hiz
  gosterge: Gosterge
  katman: Katmanlar
  secili: string | null
  /** Vana çizim aracı açık mı */
  cizim: boolean
  setGun: (g: number | null) => void
  setDilim: (d: number) => void
  setOynuyor: (o: boolean) => void
  setHiz: (h: Hiz) => void
  setGosterge: (g: Gosterge) => void
  toggleKatman: (k: keyof Katmanlar) => void
  setSecili: (s: string | null) => void
  setCizim: (c: boolean) => void
  /** Bahçe değişince sıfırla */
  sifirla: () => void
}
export const useSulamaHaritaStore = create<State>((set) => ({
  sim: SIM_VARSAYILAN,
  sekme: 'bugun',
  setSekme: (sekme) => set({ sekme, gun: null, dilim: 0, oynuyor: false }),
  setSim: (p) => set((s) => ({ sim: { ...s.sim, ...p }, gun: 'yil' in p ? null : s.gun, oynuyor: false })),
  gun: null,
  dilim: 0,
  oynuyor: false,
  hiz: 1,
  gosterge: 'toprak',
  katman: { tac: true, hat: true, serit: true },
  secili: null,
  cizim: false,
  setGun: (gun) => set({ gun, dilim: 0 }),
  setDilim: (dilim) => set({ dilim }),
  setOynuyor: (oynuyor) => set({ oynuyor }),
  setHiz: (hiz) => set({ hiz }),
  setGosterge: (gosterge) => set({ gosterge }),
  toggleKatman: (k) => set((s) => ({ katman: { ...s.katman, [k]: !s.katman[k] } })),
  setSecili: (secili) => set({ secili }),
  setCizim: (cizim) => set({ cizim, oynuyor: false }),
  sifirla: () => set({ sim: SIM_VARSAYILAN, sekme: 'bugun', gun: null, dilim: 0, oynuyor: false, secili: null, cizim: false }),
}))

/** Sim girdisi → sorgu girdisi (panel ve harita aynı sorguyu paylaşır; react-query anahtarı aynı). */
export function simSorgu(sim: SimGirdi, mevcutSistem: SulamaSistemi | undefined) {
  const f = Number(sim.fiyat.replace(',', '.'))
  const s = Number(sim.elleSaat.replace(',', '.'))
  return {
    yil: sim.yil,
    mod: sim.mod,
    sistem: sim.sistem ?? mevcutSistem,
    kisinti: sim.kisinti,
    kwh_fiyat: sim.fiyat.trim() !== '' && Number.isFinite(f) && f >= 0 ? f : undefined,
    gunler: sim.elleGun.length && s > 0 ? sim.elleGun : undefined,
    saat: sim.elleGun.length && s > 0 ? s : undefined,
  }
}
