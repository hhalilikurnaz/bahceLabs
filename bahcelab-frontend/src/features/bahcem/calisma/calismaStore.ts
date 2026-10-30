import { create } from 'zustand'

import type { KatmanId } from './katmanlar'

export type Skala = 'kendi' | 'genel'
/** Haritada odaklanılan olay (Geçmiş zaman çizelgesi, bildirim ve özet bağlantıları): ad + tarih aralığı; harita o tarihe açılır. */
export interface OlayOdagi {
  id: string
  ad: string
  baslangic: string
  bitis: string
}
export interface Inceleme {
  lng: number
  lat: number
}

const SPLIT_KEY = 'bahcelab.calisma.panelpx'
const PREFS_KEY = 'bahcelab.calisma.tercih.v2' // v2: varsayılan skala MUTLAK (eski kayıtlı «kendi» tercihi taşınmaz)
/** Sağ panel genişliği (px): sürüklenebilir ayraç 420–640; varsayılan 1440'ta ~500, 1024'te 420. */
export const PANEL_LIMITS = { min: 420, max: 640 } as const
export const panelVarsayilan = (): number => (typeof window !== 'undefined' && window.innerWidth >= 1280 ? 500 : 420)

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
  /** Saha Defteri kayıtları haritada ayrı üst katman olarak görünsün mü */
  saha: boolean
}

interface CalismaState extends Prefs {
  katman: KatmanId
  /** Seçili sahne tarihi; null = en güncel net görüntü */
  tarih: string | null
  /** Yıl görünümü: o yılın yaz (Haz–Eyl) ortanca canlılığı haritada; null = tek sahne görünümü */
  yil: number | null
  olay: OlayOdagi | null
  /** Histogram üzerinde vurgulanan değer aralığı */
  vurgu: [number, number] | null
  inceleme: Inceleme | null
  /** Sağ panel genişliği (px); sürüklenebilir ayraç, tercih hatırlanır */
  panelPx: number
  /** Hava sekmesi: harita sade (raster katmanı kapalı) */
  sade: boolean
  /** Mobil alt sayfanın harita üstündeki görünür yüksekliği (px); 0 = alt sayfa yok (masaüstü) */
  altSayfaPx: number
  setAltSayfaPx: (px: number) => void
  setSade: (s: boolean) => void
  /** Etkin sekme (kartografik notların içeriğini belirler) */
  sekme: string
  setSekme: (s: string) => void
  imlecTarih: string | null
  odak: { id: number; lng: number; lat: number; zoom?: number; sinif?: number } | null
  vurguBolge: number | null
  setKatman: (k: KatmanId) => void
  setTarih: (t: string | null) => void
  setYil: (y: number | null) => void
  setOlay: (o: OlayOdagi | null) => void
  setSkala: (s: Skala) => void
  setKontur: (k: boolean) => void
  setOpaklik: (o: number) => void
  setSaha: (s: boolean) => void
  setVurgu: (v: [number, number] | null) => void
  setInceleme: (i: Inceleme | null) => void
  setPanelPx: (px: number) => void
  /** Grafikteki imleç tarihi (harita tarih kutusu vurgulanır) */
  setImlecTarih: (t: string | null) => void
  /** Kartografik not tıklanınca haritayı o bölgeye uçur (flyTo 600 ms) ve bölge sınırını vurgula */
  ucus: (o: { lng: number; lat: number; zoom?: number; sinif?: number }) => void
  setVurguBolge: (s: number | null) => void
  /** Bahçe değişince geçici görünüm sıfırlanır (tercihler korunur) */
  bahceDegisti: () => void
}

const prefs: Prefs = { skala: 'genel', kontur: false, opaklik: 0.92, saha: false, ...read<Partial<Prefs>>(PREFS_KEY, {}) }
const clampPanel = (px: number) => Math.round(Math.min(PANEL_LIMITS.max, Math.max(PANEL_LIMITS.min, px)))

export const useCalismaStore = create<CalismaState>((set, get) => {
  const savePrefs = (patch: Partial<Prefs>) => {
    const { skala, kontur, opaklik, saha } = { ...get(), ...patch }
    write(PREFS_KEY, { skala, kontur, opaklik, saha })
  }
  return {
    ...prefs,
    katman: 'canlilik',
    tarih: null,
    yil: null,
    olay: null,
    vurgu: null,
    inceleme: null,
    panelPx: clampPanel(read<number>(SPLIT_KEY, panelVarsayilan())),
    sade: false,
    altSayfaPx: 0,
    setAltSayfaPx: (altSayfaPx) => set({ altSayfaPx }),
    sekme: 'durum',
    setSekme: (sekme) => set({ sekme }),
    imlecTarih: null,
    odak: null,
    vurguBolge: null,
    setKatman: (katman) => set({ katman, vurgu: null, sade: false }),
    setSade: (sade) => set({ sade }),
    setTarih: (tarih) => set({ tarih, yil: null, vurgu: null }),
    setYil: (yil) => set(yil === null ? { yil } : { yil, katman: 'canlilik', vurgu: null }),
    setOlay: (olay) => set({ olay }),
    setSkala: (skala) => (savePrefs({ skala }), set({ skala })),
    setKontur: (kontur) => (savePrefs({ kontur }), set({ kontur })),
    setOpaklik: (opaklik) => (savePrefs({ opaklik }), set({ opaklik })),
    setSaha: (saha) => (savePrefs({ saha }), set({ saha })),
    setVurgu: (vurgu) => set({ vurgu }),
    setInceleme: (inceleme) => set({ inceleme }),
    setPanelPx: (px) => {
      const panelPx = clampPanel(px)
      write(SPLIT_KEY, panelPx)
      set({ panelPx })
    },
    setImlecTarih: (imlecTarih) => set({ imlecTarih }),
    ucus: (odak) => set({ odak: { ...odak, id: Date.now() }, vurguBolge: odak.sinif ?? null }),
    setVurguBolge: (vurguBolge) => set({ vurguBolge }),
    bahceDegisti: () => set({ tarih: null, yil: null, olay: null, vurgu: null, inceleme: null, imlecTarih: null, odak: null, vurguBolge: null }),
  }
})
