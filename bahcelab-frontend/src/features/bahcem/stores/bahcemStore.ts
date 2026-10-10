import { create } from 'zustand'
import type { GardenGeometry } from '../api/types'

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

  toggleLeftPanel: () => void
  setLeftPanelOpen: (open: boolean) => void
  setCopilotOpen: (open: boolean) => void
  setSeason: (season: number) => void
  selectGarden: (id: string | null) => void
  setMapZoom: (zoom: number) => void
  setLiveArea: (dekar: number | null) => void

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

export const useBahcemStore = create<BahcemState>((set) => ({
  // Dar ekranda panel kapalı başlar; harita görünür kalır
  leftPanelOpen: isDesktop(),
  copilotOpen: false,
  season: new Date().getFullYear(),

  selectedGardenId: null,
  ...flowReset,
  mapZoom: 0,

  toggleLeftPanel: () => set((s) => ({ leftPanelOpen: !s.leftPanelOpen })),
  setLeftPanelOpen: (open) => set({ leftPanelOpen: open }),
  setCopilotOpen: (open) => set({ copilotOpen: open }),
  setSeason: (season) => set({ season }),
  selectGarden: (id) => set({ selectedGardenId: id }),
  setMapZoom: (mapZoom) => set({ mapZoom }),
  setLiveArea: (liveAreaDekar) => set({ liveAreaDekar }),

  startDrawing: () => set({ ...flowReset, mode: 'drawing', selectedGardenId: null }),
  startImportPick: (imported) =>
    set({ ...flowReset, mode: 'import-pick', imported, leftPanelOpen: true, selectedGardenId: null }),
  openForm: (draft) => set({ mode: 'form', draft, imported: [], liveAreaDekar: null, leftPanelOpen: true }),
  startEditingBoundary: (gardenId) =>
    set({ ...flowReset, mode: 'editing-boundary', editingGardenId: gardenId, selectedGardenId: gardenId }),
  resetFlow: () => set({ ...flowReset }),
}))
