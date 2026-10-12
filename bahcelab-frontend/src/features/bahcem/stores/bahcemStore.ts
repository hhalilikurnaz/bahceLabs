import { create } from 'zustand'
import type { GardenGeometry } from '../api/types'

/** Çizim şekli: serbest çokgen ya da daire (daire düzenlenebilir çokgene çevrilir) */
export type DrawShape = 'polygon' | 'circle'

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
  mode: FlowMode
  draft: Draft | null
  imported: ImportedPolygon[]
  editingGardenId: string | null
  /** Çizim/düzenleme sırasındaki canlı alan (dekar); null = henüz hesaplanamıyor */
  liveAreaDekar: number | null
  /** Çizim sırasındaki canlı sınır (form önizlemesi için); yoksa null */
  liveGeometry: GardenGeometry | null
  drawShape: DrawShape
  /** Kayıttan sonra uydu verisi işlenirken izlenen bahçe (bitince bildirim gösterilir) */
  watched: { id: string; ad: string; ignoreJobId: string | null } | null

  setLiveArea: (dekar: number | null) => void
  setLiveGeometry: (geometry: GardenGeometry | null) => void
  setDrawShape: (shape: DrawShape) => void
  /** `ignoreJobId`: sınır düzenlemesinde eski (bitmiş) işin kimliği; yalnızca yeni iş bitince bildirilir */
  watchProcessing: (id: string, ad: string, ignoreJobId?: string | null) => void
  clearWatched: () => void
  startDrawing: () => void
  startImportPick: (polygons: ImportedPolygon[]) => void
  openForm: (draft: Draft) => void
  startEditingBoundary: (gardenId: string) => void
  /** Akışı bitirir ve taslağı temizler */
  resetFlow: () => void
}

const flowReset = {
  mode: 'idle' as FlowMode,
  draft: null,
  imported: [] as ImportedPolygon[],
  editingGardenId: null,
  liveAreaDekar: null,
  liveGeometry: null,
}

/** Bahçe ekleme / sınır düzenleme akışı ve işleme izleme (harita görünümü `calisma/calismaStore.ts`'tedir). */
export const useBahcemStore = create<BahcemState>((set) => ({
  ...flowReset,
  drawShape: 'polygon',
  watched: null,
  setLiveArea: (liveAreaDekar) => set({ liveAreaDekar }),
  setLiveGeometry: (liveGeometry) => set({ liveGeometry }),
  setDrawShape: (drawShape) => set({ drawShape }),
  watchProcessing: (id, ad, ignoreJobId = null) => set({ watched: { id, ad, ignoreJobId } }),
  clearWatched: () => set({ watched: null }),
  startDrawing: () => set({ ...flowReset, mode: 'drawing' }),
  startImportPick: (imported) => set({ ...flowReset, mode: 'import-pick', imported }),
  openForm: (draft) => set({ mode: 'form', draft, imported: [], liveAreaDekar: null }),
  startEditingBoundary: (gardenId) => set({ ...flowReset, mode: 'editing-boundary', editingGardenId: gardenId }),
  resetFlow: () => set({ ...flowReset }),
}))
