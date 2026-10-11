import { create } from 'zustand'
import type { GardenGeometry } from '../api/types'
import { INDEX_IDS, type IndexId, type LayerId } from '../lib/indices'

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

/** Değer görünümü: sabit skala ya da o tarihin bahçe içi p2–p98 aralığına gerilmiş */
export type ViewMode = 'mutlak' | 'kontrastli'
/** Çizim: keskin 10 m pikseller ya da yalnızca görsel yumuşatma (bilinear) */
export type DrawStyle = 'piksel' | 'yumusak'
export type ChangePreset = 'ikihafta' | 'gecenyil' | 'ozel'

export interface Compare {
  /** Sağ taraftaki görüntü (A: soldaki = seçili tarih ve katman) */
  tarihB: string | null
  katmanB: LayerId
  /** Ayırıcı çizginin harita genişliğine oranı (0–1) */
  bolme: number
}

/** Haritanın son çizimi hakkında bilgi: lejant ve etiket için */
export interface RenderInfo {
  kind: 'mutlak' | 'kontrastli' | 'fark' | 'gercek'
  vmin: number
  vmax: number
  indeks: IndexId | null
  etiket: string
}

interface BahcemState {
  leftPanelOpen: boolean
  /** "Tam harita": bahçe sayfası paneli daraltılır, seçili bahçe dışı karartılır */
  fullMap: boolean
  copilotOpen: boolean
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

  // --- indeks görselleştirme
  katman: LayerId
  selectedDate: string | null // null = en son geçerli görüntü
  layerVisible: boolean
  gorunum: ViewMode
  cizim: DrawStyle
  degisim: { preset: ChangePreset; tarih: string | null } | null
  karsilastirma: Compare | null
  oynat: boolean
  hiz: 0.5 | 1 | 2
  grafikIndeksleri: IndexId[]
  verimlilik: boolean
  verimlilikIndeksi: 'ndvi' | 'msavi'
  renderInfo: RenderInfo | null

  toggleLeftPanel: () => void
  setFullMap: (fullMap: boolean) => void
  setLeftPanelOpen: (open: boolean) => void
  setCopilotOpen: (open: boolean) => void
  setSeason: (season: number) => void
  selectGarden: (id: string | null) => void
  setMapZoom: (zoom: number) => void
  setLiveArea: (dekar: number | null) => void

  setHavaKatmani: (acik: boolean) => void

  setKatman: (katman: LayerId) => void
  setSelectedDate: (tarih: string | null) => void
  setLayerVisible: (visible: boolean) => void
  setGorunum: (gorunum: ViewMode) => void
  setCizim: (cizim: DrawStyle) => void
  setDegisim: (degisim: BahcemState['degisim']) => void
  setKarsilastirma: (karsilastirma: Compare | null) => void
  patchKarsilastirma: (patch: Partial<Compare>) => void
  setOynat: (oynat: boolean) => void
  setHiz: (hiz: BahcemState['hiz']) => void
  toggleGrafikIndeksi: (indeks: IndexId) => void
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

const isDesktop = () => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches

const flowReset = {
  mode: 'idle' as FlowMode,
  draft: null,
  imported: [] as ImportedPolygon[],
  editingGardenId: null,
  liveAreaDekar: null,
}

/** Bahçe değişince görselleştirme tercihleri (katman hariç) sıfırlanır: her bahçe en son görüntüyle açılır */
const viewReset = {
  fullMap: false,
  selectedDate: null,
  degisim: null,
  karsilastirma: null,
  oynat: false,
  verimlilik: false,
  renderInfo: null,
}

export const useBahcemStore = create<BahcemState>((set) => ({
  // Dar ekranda panel kapalı başlar; harita görünür kalır
  leftPanelOpen: isDesktop(),
  copilotOpen: false,
  season: new Date().getFullYear(),

  selectedGardenId: null,
  ...flowReset,
  mapZoom: 0,
  havaKatmani: false,

  katman: 'ndvi',
  layerVisible: true,
  gorunum: 'mutlak',
  cizim: 'piksel',
  hiz: 1,
  grafikIndeksleri: ['ndvi'],
  verimlilikIndeksi: 'ndvi',
  ...viewReset,

  toggleLeftPanel: () => set((s) => ({ leftPanelOpen: !s.leftPanelOpen })),
  setFullMap: (fullMap) => set({ fullMap }),
  setLeftPanelOpen: (open) => set({ leftPanelOpen: open }),
  setCopilotOpen: (open) => set({ copilotOpen: open }),
  setSeason: (season) => set({ season }),
  selectGarden: (id) => set((s) => (s.selectedGardenId === id ? s : { selectedGardenId: id, ...viewReset })),
  setMapZoom: (mapZoom) => set({ mapZoom }),
  setLiveArea: (liveAreaDekar) => set({ liveAreaDekar }),

  // Katman değişince grafik de o indeksi gösterir (en az bir indeks açık kalır)
  setHavaKatmani: (havaKatmani) => set({ havaKatmani }),

  setKatman: (katman) =>
    set((s) => ({
      katman,
      grafikIndeksleri:
        katman !== 'gercek-renk' && !s.grafikIndeksleri.includes(katman) ? [katman] : s.grafikIndeksleri,
    })),
  setSelectedDate: (selectedDate) => set({ selectedDate }),
  setLayerVisible: (layerVisible) => set({ layerVisible }),
  setGorunum: (gorunum) => set({ gorunum }),
  setCizim: (cizim) => set({ cizim }),
  setDegisim: (degisim) => set(degisim ? { degisim, karsilastirma: null, oynat: false } : { degisim: null }),
  setKarsilastirma: (karsilastirma) =>
    set({ karsilastirma, ...(karsilastirma ? { degisim: null, oynat: false } : {}) }),
  patchKarsilastirma: (patch) =>
    set((s) => (s.karsilastirma ? { karsilastirma: { ...s.karsilastirma, ...patch } } : {})),
  setOynat: (oynat) => set({ oynat }),
  setHiz: (hiz) => set({ hiz }),
  toggleGrafikIndeksi: (indeks) =>
    set((s) => {
      const on = s.grafikIndeksleri.includes(indeks)
      if (on && s.grafikIndeksleri.length === 1) return {} // en az bir indeks
      const next = on ? s.grafikIndeksleri.filter((i) => i !== indeks) : [...s.grafikIndeksleri, indeks]
      return { grafikIndeksleri: INDEX_IDS.filter((i) => next.includes(i)) }
    }),
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
