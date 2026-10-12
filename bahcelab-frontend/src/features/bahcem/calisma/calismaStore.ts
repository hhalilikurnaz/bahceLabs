import { create } from 'zustand'

import type { KatmanId } from './katmanlar'

export type Skala = 'kendi' | 'genel'
export interface Inceleme {
  lng: number
  lat: number
}

const SPLIT_KEY = 'bahcelab.calisma.oran'
const PREFS_KEY = 'bahcelab.calisma.tercih'
export const SPLIT_LIMITS = { min: 0.42, max: 0.78, varsayilan: 0.64 } as const

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}
function write(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* saklama yoksa yalnız oturum boyunca */
  }
}

interface Prefs {
  skala: Skala
  kontur: boolean
  opaklik: number
}

interface CalismaState extends Prefs {
  katman: KatmanId
  /** Seçili sahne tarihi; null = en güncel net görüntü */
  tarih: string | null
  /** Histogram üzerinde vurgulanan değer aralığı */
  vurgu: [number, number] | null
  inceleme: Inceleme | null
  /** Harita payı (0–1); sürüklenebilir bölücü */
  oran: number
  setKatman: (k: KatmanId) => void
  setTarih: (t: string | null) => void
  setSkala: (s: Skala) => void
  setKontur: (k: boolean) => void
  setOpaklik: (o: number) => void
  setVurgu: (v: [number, number] | null) => void
  setInceleme: (i: Inceleme | null) => void
  setOran: (o: number) => void
  /** Bahçe değişince geçici görünüm sıfırlanır (tercihler korunur) */
  bahceDegisti: () => void
}

const prefs = read<Prefs>(PREFS_KEY, { skala: 'kendi', kontur: false, opaklik: 0.92 })
const clampOran = (o: number) => Math.min(SPLIT_LIMITS.max, Math.max(SPLIT_LIMITS.min, o))

export const useCalismaStore = create<CalismaState>((set, get) => {
  const savePrefs = (patch: Partial<Prefs>) => {
    const { skala, kontur, opaklik } = { ...get(), ...patch }
    write(PREFS_KEY, { skala, kontur, opaklik })
  }
  return {
    ...prefs,
    katman: 'canlilik',
    tarih: null,
    vurgu: null,
    inceleme: null,
    oran: clampOran(read<number>(SPLIT_KEY, SPLIT_LIMITS.varsayilan)),
    setKatman: (katman) => set({ katman, vurgu: null }),
    setTarih: (tarih) => set({ tarih, vurgu: null }),
    setSkala: (skala) => (savePrefs({ skala }), set({ skala })),
    setKontur: (kontur) => (savePrefs({ kontur }), set({ kontur })),
    setOpaklik: (opaklik) => (savePrefs({ opaklik }), set({ opaklik })),
    setVurgu: (vurgu) => set({ vurgu }),
    setInceleme: (inceleme) => set({ inceleme }),
    setOran: (o) => {
      const oran = clampOran(o)
      write(SPLIT_KEY, oran)
      set({ oran })
    },
    bahceDegisti: () => set({ tarih: null, vurgu: null, inceleme: null }),
  }
})
