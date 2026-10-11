import { create } from 'zustand'
import type { GardenGeometry } from '../api/types'
import type { LayerId } from '../lib/indices'
import { DEFAULT_VIEW, type RenderInfo, type Scale, type Smoothing } from '../lib/raster'

/** Bahçe ekleme/düzenleme akışının aşaması */
export type FlowMode =
  | 'idle'
  | 'drawing' // haritada çizim araç çubuğu açık
  | 'import-pick' // dosyadan birden fazla poligon bulundu, seçim bekleniyor
  | 'form' // sınır hazır, kaydetme formu açık
  | 'editing-boundary' // mevcut bahçenin sınırı düzenleniyor

export interface ImportedPolygon {
  id: string
  name: string
  geometry: GardenGeometry
  areaDekar: number
}

export interface Draft {
  geometry: GardenGeometry
  source: 'draw' | 'file'
  suggestedName?: string
}

interface BahcemState {
  leftPanelOpen: boolean
  /** "Tam harita": bahçe sayfası paneli daraltılır, seçili bahçe dışı karartılır */
  fullMap: boolean
  copilotOpen: boolean
  /** Kullanıcının sürükleyerek seçtiği sağ panel genişliği (px); null = varsayılan oran */
  detailWidthPx: number | null
  season: number

  selectedGardenId: string | null
  mode: FlowMode
  draft: Draft | null
  imported: ImportedPolygon[]
  editingGardenId: string | null
  /** Çizim/düzenleme sırasındaki canlı alan (dekar); null = henüz hesaplanamıyor */
  liveAreaDekar: number | null
  mapZoom: number

  /** Uydu grafiğinin altında günlük yağış ve sıcaklık gösterilsin mi */
  havaKatmani: boolean

  // --- indeks görselleştirme (ana harita her zaman en güncel geçerli görüntüyü gösterir; tarih seçimi Arşiv'dedir)
  katman: LayerId
  layerVisible: boolean
  skala: Scale
  cizim: Smoothing
  renkKorlugu: boolean
  verimlilik: boolean
  verimlilikIndeksi: 'ndvi' | 'msavi'
  renderInfo: RenderInfo | null

  toggleLeftPanel: () => void
  setFullMap: (fullMap: boolean) => void
  setLeftPanelOpen: (open: boolean) => void
  setCopilotOpen: (open: boolean) => void
  setDetailWidth: (px: number | null) => void
  setSeason: (season: number) => void
  selectGarden: (id: string | null) => void
  setMapZoom: (zoom: number) => void
  setLiveArea: (dekar: number | null) => void

  setHavaKatmani: (acik: boolean) => void

  setKatman: (katman: LayerId) => void
  setLayerVisible: (visible: boolean) => void
  setSkala: (skala: Scale) => void
  setCizim: (cizim: Smoothing) => void
  setRenkKorlugu: (acik: boolean) => void
  setVerimlilik: (acik: boolean) => void
  setVerimlilikIndeksi: (indeks: 'ndvi' | 'msavi') => void
  setRenderInfo: (info: RenderInfo | null) => void

  startDrawing: () => void
  startImportPick: (polygons: ImportedPolygon[]) => void
  openForm: (draft: Draft) => void
  startEditingBoundary: (gardenId: string) => void
  /** Akışı bitirir ve taslağı temizler */
  resetFlow: () => void
}

const DETAIL_WIDTH_KEY = 'bahcelab.detailWidthPx'

/** Sağ panel genişliği tarayıcıda saklanır (yalnızca kullanıcı kolaylığı; erişilemezse sessizce varsayılan). */
function readDetailWidth(): number | null {
  try {
    const raw = window.localStorage.getItem(DETAIL_WIDTH_KEY)
    const value = raw === null ? NaN : Number(raw)
    return Number.isFinite(value) && value > 0 ? value : null
  } catch {
    return null
  }
}

function writeDetailWidth(value: number | null): void {
  try {
    if (value === null) window.localStorage.removeItem(DETAIL_WIDTH_KEY)
    else window.localStorage.setItem(DETAIL_WIDTH_KEY, String(Math.round(value)))
  } catch {
    /* saklama yoksa genişlik yalnızca oturum boyunca geçerli olur */
  }
}

const isDesktop = () => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches

const flowReset = {
  mode: 'idle' as FlowMode,
  draft: null,
  imported: [] as ImportedPolygon[],
  editingGardenId: null,
  liveAreaDekar: null,
}

/** Bahçe değişince geçici görünüm durumları sıfırlanır (parametre ve görünüm tercihleri korunur) */
const viewReset = {
  fullMap: false,
  verimlilik: false,
  renderInfo: null,
}

const VIEW_PREFS_KEY = 'bahcelab.viewPrefs'

interface ViewPrefs {
  skala: Scale
  cizim: Smoothing
  renkKorlugu: boolean
}

/** Görünüm tercihleri (skala, çizim, renk körlüğü) tarayıcıda saklanır; erişilemezse varsayılan. */
function readViewPrefs(): ViewPrefs {
  try {
    const raw = JSON.parse(window.localStorage.getItem(VIEW_PREFS_KEY) ?? 'null') as Partial<ViewPrefs> | null
    return {
      skala: raw?.skala === 'genel' ? 'genel' : DEFAULT_VIEW.skala,
      cizim: raw?.cizim === 'yumusak' ? 'yumusak' : DEFAULT_VIEW.cizim,
      renkKorlugu: raw?.renkKorlugu === true,
    }
  } catch {
    return { ...DEFAULT_VIEW }
  }
}

function writeViewPrefs(prefs: ViewPrefs): void {
  try {
    window.localStorage.setItem(VIEW_PREFS_KEY, JSON.stringify(prefs))
  } catch {
    /* saklama yoksa tercih yalnızca oturum boyunca geçerli olur */
  }
}

export const useBahcemStore = create<BahcemState>((set) => ({
  // Dar ekranda panel kapalı başlar; harita görünür kalır
  leftPanelOpen: isDesktop(),
  copilotOpen: false,
  detailWidthPx: readDetailWidth(),
  season: new Date().getFullYear(),

  selectedGardenId: null,
  ...flowReset,
  mapZoom: 0,
  havaKatmani: false,

  katman: 'ndvi',
  layerVisible: true,
  ...readViewPrefs(),
  verimlilikIndeksi: 'ndvi',
  ...viewReset,

  toggleLeftPanel: () => set((s) => ({ leftPanelOpen: !s.leftPanelOpen })),
  setFullMap: (fullMap) => set({ fullMap }),
  setLeftPanelOpen: (open) => set({ leftPanelOpen: open }),
  setCopilotOpen: (open) => set({ copilotOpen: open }),
  setDetailWidth: (detailWidthPx) => {
    writeDetailWidth(detailWidthPx)
    set({ detailWidthPx })
  },
  setSeason: (season) => set({ season }),
  selectGarden: (id) => set((s) => (s.selectedGardenId === id ? s : { selectedGardenId: id, ...viewReset })),
  setMapZoom: (mapZoom) => set({ mapZoom }),
  setLiveArea: (liveAreaDekar) => set({ liveAreaDekar }),

  setHavaKatmani: (havaKatmani) => set({ havaKatmani }),

  setKatman: (katman) => set({ katman }),
  setLayerVisible: (layerVisible) => set({ layerVisible }),
  setSkala: (skala) => set((s) => (writeViewPrefs({ ...s, skala }), { skala })),
  setCizim: (cizim) => set((s) => (writeViewPrefs({ ...s, cizim }), { cizim })),
  setRenkKorlugu: (renkKorlugu) => set((s) => (writeViewPrefs({ ...s, renkKorlugu }), { renkKorlugu })),
  setVerimlilik: (verimlilik) => set({ verimlilik }),
  setVerimlilikIndeksi: (verimlilikIndeksi) => set({ verimlilikIndeksi }),
  setRenderInfo: (renderInfo) => set({ renderInfo }),

  startDrawing: () => set({ ...flowReset, mode: 'drawing', selectedGardenId: null, ...viewReset }),
  startImportPick: (imported) =>
    set({ ...flowReset, mode: 'import-pick', imported, leftPanelOpen: true, selectedGardenId: null, ...viewReset }),
  openForm: (draft) => set({ mode: 'form', draft, imported: [], liveAreaDekar: null, leftPanelOpen: true }),
  startEditingBoundary: (gardenId) =>
    set({ ...flowReset, mode: 'editing-boundary', editingGardenId: gardenId, selectedGardenId: gardenId }),
  resetFlow: () => set({ ...flowReset }),
}))
