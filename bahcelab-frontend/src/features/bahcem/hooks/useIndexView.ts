import { useIndices } from '../api/indeksApi'
import { latestUsableScene } from '../lib/scenes'
import { useBahcemStore } from '../stores/bahcemStore'

/** Seçili bahçenin indeks verisi ve haritada gösterilen (en güncel geçerli) sahne — tek yerde. */
export function useIndexView() {
  const gardenId = useBahcemStore((s) => s.selectedGardenId)
  const katman = useBahcemStore((s) => s.katman)
  const visible = useBahcemStore((s) => s.layerVisible)
  const mode = useBahcemStore((s) => s.mode)
  const query = useIndices(gardenId)

  const scenes = query.data?.gozlemler
  const active = latestUsableScene(scenes, katman)
  return {
    gardenId,
    katman,
    data: query.data,
    scenes,
    isLoading: query.isLoading,
    isError: query.isError,
    isFetching: query.isFetching,
    refetch: query.refetch,
    active,
    /** Haritada gösterilebilecek görüntü var mı (aç/kapat anahtarından bağımsız) */
    available: active !== null,
    /** Çizim/düzenleme sırasında katman gizlenir */
    shown: gardenId !== null && visible && active !== null && mode === 'idle',
  }
}
