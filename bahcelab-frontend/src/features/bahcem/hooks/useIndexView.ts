import { useIndices } from '../api/indeksApi'
import { pickScene } from '../lib/scenes'
import { useBahcemStore } from '../stores/bahcemStore'

/** Seçili bahçenin indeks verisi, haritada gösterilen sahne ve gösterim durumu (tek yerde). */
export function useIndexView() {
  const gardenId = useBahcemStore((s) => s.selectedGardenId)
  const katman = useBahcemStore((s) => s.katman)
  const date = useBahcemStore((s) => s.selectedDate)
  const visible = useBahcemStore((s) => s.layerVisible)
  const mode = useBahcemStore((s) => s.mode)
  const query = useIndices(gardenId)

  const scenes = query.data?.gozlemler
  const active = pickScene(scenes, katman, date)
  return {
    gardenId,
    katman,
    data: query.data,
    scenes,
    isLoading: query.isLoading,
    active,
    /** Haritada gösterilebilecek görüntü var mı (aç/kapat anahtarından bağımsız) */
    available: active !== null,
    /** Çizim/düzenleme sırasında katman gizlenir */
    shown: gardenId !== null && visible && active !== null && mode === 'idle',
  }
}
