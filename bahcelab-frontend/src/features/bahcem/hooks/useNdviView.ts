import { useNdvi } from '../api/ndviApi'
import { pickActiveObservation } from '../lib/ndvi'
import { useBahcemStore } from '../stores/bahcemStore'

/** Seçili bahçenin NDVI verisi, haritada gösterilen görüntü ve gösterim durumu (tek yerde). */
export function useNdviView() {
  const gardenId = useBahcemStore((s) => s.selectedGardenId)
  const date = useBahcemStore((s) => s.ndviDate)
  const visible = useBahcemStore((s) => s.ndviVisible)
  const mode = useBahcemStore((s) => s.mode)
  const query = useNdvi(gardenId)

  const active = pickActiveObservation(query.data?.gozlemler, date)
  return {
    gardenId,
    data: query.data,
    isLoading: query.isLoading,
    active,
    /** Haritada gösterilebilecek görüntü var mı (aç/kapat anahtarından bağımsız) */
    available: active !== null,
    /** Çizim/düzenleme sırasında NDVI gizlenir */
    shown: gardenId !== null && visible && active !== null && mode === 'idle',
  }
}
