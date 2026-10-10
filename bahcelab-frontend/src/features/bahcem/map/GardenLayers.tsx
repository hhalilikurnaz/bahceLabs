import { useEffect } from 'react'
import type { GeoJSONSource, MapLayerMouseEvent } from 'maplibre-gl'
import { useGardens } from '../api/useGardens'
import type { GardenGeometry } from '../api/types'
import { useBahcemStore } from '../stores/bahcemStore'
import { cssColor } from './cssColor'
import { useMap } from './useMap'

const SOURCE = 'gardens'
const FILL = 'gardens-fill'
const LINE = 'gardens-line'
const DRAFT_SOURCE = 'garden-draft'
const DRAFT_FILL = 'garden-draft-fill'
const DRAFT_LINE = 'garden-draft-line'

const empty: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }

/**
 * Kayıtlı bahçeleri (yeşil kenarlı yarı saydam poligon) ve kaydedilmemiş taslağı çizer.
 * Altlık değişince (styleVersion) kaynak ve katmanlar yeniden eklenir.
 */
export function GardenLayers() {
  const { map, styleVersion } = useMap()
  const { data: gardens } = useGardens()
  const selectedId = useBahcemStore((s) => s.selectedGardenId)
  const editingId = useBahcemStore((s) => s.editingGardenId)
  const draft = useBahcemStore((s) => s.draft)
  const selectGarden = useBahcemStore((s) => s.selectGarden)

  // Kaynak ve katmanlar
  useEffect(() => {
    if (!map || styleVersion === 0) return
    const accent = cssColor('--color-app-accent')

    if (!map.getSource(SOURCE)) {
      map.addSource(SOURCE, { type: 'geojson', data: empty })
      map.addLayer({
        id: FILL,
        type: 'fill',
        source: SOURCE,
        paint: {
          'fill-color': accent,
          'fill-opacity': ['case', ['get', 'selected'], 0.4, 0.24],
        },
      })
      map.addLayer({
        id: LINE,
        type: 'line',
        source: SOURCE,
        paint: {
          'line-color': accent,
          'line-width': ['case', ['get', 'selected'], 3.5, 2],
        },
      })
    }
    if (!map.getSource(DRAFT_SOURCE)) {
      map.addSource(DRAFT_SOURCE, { type: 'geojson', data: empty })
      map.addLayer({
        id: DRAFT_FILL,
        type: 'fill',
        source: DRAFT_SOURCE,
        paint: { 'fill-color': accent, 'fill-opacity': 0.2 },
      })
      map.addLayer({
        id: DRAFT_LINE,
        type: 'line',
        source: DRAFT_SOURCE,
        paint: { 'line-color': accent, 'line-width': 2.5, 'line-dasharray': [2, 1.5] },
      })
    }
  }, [map, styleVersion])

  // Veri
  useEffect(() => {
    if (!map || styleVersion === 0) return
    const source = map.getSource(SOURCE) as GeoJSONSource | undefined
    source?.setData({
      type: 'FeatureCollection',
      features: (gardens ?? [])
        // Sınırı düzenlenen bahçe, düzenleme çizimiyle çakışmasın diye gizlenir
        .filter((g) => g.id !== editingId)
        .map((g) => ({
          type: 'Feature' as const,
          id: g.id,
          properties: { id: g.id, selected: g.id === selectedId },
          geometry: g.geometry,
        })),
    })
  }, [map, styleVersion, gardens, selectedId, editingId])

  useEffect(() => {
    if (!map || styleVersion === 0) return
    const source = map.getSource(DRAFT_SOURCE) as GeoJSONSource | undefined
    source?.setData(
      draft
        ? {
            type: 'FeatureCollection',
            features: [{ type: 'Feature', properties: {}, geometry: draft.geometry as GardenGeometry }],
          }
        : empty,
    )
  }, [map, styleVersion, draft])

  // Tıklayınca seçim ve imleç
  useEffect(() => {
    if (!map || styleVersion === 0) return

    const onClick = (e: MapLayerMouseEvent) => {
      // Çizim/düzenleme sırasında tıklamalar çizim aracına aittir
      if (useBahcemStore.getState().mode !== 'idle') return
      const id = e.features?.[0]?.properties?.id as string | undefined
      if (id) {
        selectGarden(id)
        useBahcemStore.getState().setLeftPanelOpen(true)
      }
    }
    const onEnter = () => {
      if (useBahcemStore.getState().mode === 'idle') map.getCanvas().style.cursor = 'pointer'
    }
    const onLeave = () => {
      map.getCanvas().style.cursor = ''
    }

    map.on('click', FILL, onClick)
    map.on('mouseenter', FILL, onEnter)
    map.on('mouseleave', FILL, onLeave)
    return () => {
      map.off('click', FILL, onClick)
      map.off('mouseenter', FILL, onEnter)
      map.off('mouseleave', FILL, onLeave)
    }
  }, [map, styleVersion, selectGarden])

  return null
}
