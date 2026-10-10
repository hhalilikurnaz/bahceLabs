import { useEffect, useRef } from 'react'
import { useGardens } from '../api/useGardens'
import { useBahcemStore } from '../stores/bahcemStore'
import { useFocusGarden } from './useFocusGarden'
import { useMap } from './useMap'

/** Görünmez yardımcı: yakınlaştırma düzeyini izler, açılışta bahçelere odaklanır. */
export function MapEffects() {
  const { map } = useMap()
  const setMapZoom = useBahcemStore((s) => s.setMapZoom)
  const { data: gardens } = useGardens()
  const { focusAll } = useFocusGarden()
  const fitted = useRef(false)

  useEffect(() => {
    if (!map) return
    const update = () => setMapZoom(map.getZoom())
    update()
    map.on('zoom', update)
    return () => void map.off('zoom', update)
  }, [map, setMapZoom])

  // Bahçe varsa açılışta hepsini kapsayacak şekilde odaklan (kayıtlı konum yerine); bir kez
  useEffect(() => {
    if (!map || fitted.current || !gardens) return
    fitted.current = true
    if (gardens.length > 0) focusAll(gardens, { animate: false })
  }, [map, gardens, focusAll])

  return null
}
