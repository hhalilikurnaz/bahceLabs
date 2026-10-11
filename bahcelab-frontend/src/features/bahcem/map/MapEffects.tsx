import { useEffect, useRef } from 'react'
import { useGardens } from '../api/useGardens'
import { useBahcemRoute } from '../hooks/useBahcemRoute'
import { usePanelLayout } from '../hooks/usePanelLayout'
import { useBahcemStore } from '../stores/bahcemStore'
import { useFocusGarden } from './useFocusGarden'
import { useMap } from './useMap'

/**
 * Görünmez yardımcı: yakınlaştırma düzeyini izler; açılışta bahçelere odaklanır; seçili bahçeye (veya panel
 * genişliği/Tam harita değişince yeniden) odaklanır.
 */
export function MapEffects() {
  const { map } = useMap()
  const setMapZoom = useBahcemStore((s) => s.setMapZoom)
  const { data: gardens } = useGardens()
  const { focusAll, focusGarden } = useFocusGarden()
  const { gardenId } = useBahcemRoute()
  const { listOpen, detailOpen, insets } = usePanelLayout()
  const fitted = useRef(false)

  useEffect(() => {
    if (!map) return
    const update = () => setMapZoom(map.getZoom())
    update()
    map.on('zoom', update)
    return () => void map.off('zoom', update)
  }, [map, setMapZoom])

  const selected = gardenId ? gardens?.find((g) => g.id === gardenId) : undefined
  const selectedId = selected?.id

  // Açılışta: bahçe sayfası açıksa o bahçeye, değilse bahçelerin tümüne (yoksa Türkiye görünümü korunur)
  useEffect(() => {
    if (!map || fitted.current || !gardens) return
    fitted.current = true
    if (selected) focusGarden(selected, { animate: false })
    else if (gardens.length > 0) focusAll(gardens, { animate: false })
  }, [map, gardens, selected, focusAll, focusGarden])

  // Bahçe seçilince veya panel türü/genişliği değişince (liste ↔ bahçe sayfası ↔ Tam harita) yeniden odaklan
  useEffect(() => {
    if (!map || !fitted.current || !selectedId) return
    const garden = gardens?.find((g) => g.id === selectedId)
    if (garden) focusGarden(garden)
  }, [map, selectedId, listOpen, detailOpen, insets.left, insets.right, gardens, focusGarden])

  return null
}
