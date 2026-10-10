import { useEffect } from 'react'
import type { GeoJSONSource, MapLayerMouseEvent } from 'maplibre-gl'
import { useGardens } from '../api/useGardens'
import type { GardenGeometry } from '../api/types'
import { useNdviView } from '../hooks/useNdviView'
import { useBahcemStore } from '../stores/bahcemStore'
import { cssColor } from './cssColor'
import { useMap } from './useMap'

const SOURCE = 'gardens'
const FILL = 'gardens-fill'
const CASING = 'gardens-selected-casing'
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
  const imported = useBahcemStore((s) => s.imported)
  const selectGarden = useBahcemStore((s) => s.selectGarden)
  const { shown: ndviShown } = useNdviView()

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
          'fill-opacity': ['case', ['get', 'ndvi'], 0, ['get', 'selected'], 0.45, 0.2],
        },
      })
      // Seçili bahçe: açık renkli çerçeve + kalın yeşil kenar
      map.addLayer({
        id: CASING,
        type: 'line',
        source: SOURCE,
        filter: ['==', ['get', 'selected'], true],
        paint: { 'line-color': '#ffffff', 'line-width': 7, 'line-opacity': 0.85 },
      })
      map.addLayer({
        id: LINE,
        type: 'line',
        source: SOURCE,
        paint: {
          'line-color': accent,
          'line-width': ['case', ['get', 'selected'], 4, 2],
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
          // NDVI gösterilirken seçili bahçenin yeşil dolgusu kalkar: renkler görünsün
          properties: { id: g.id, selected: g.id === selectedId, ndvi: g.id === selectedId && ndviShown },
          geometry: g.geometry,
        })),
    })
  }, [map, styleVersion, gardens, selectedId, editingId, ndviShown])

  // Taslak: form açıkken tek sınır; dosyadan çok poligon geldiğinde seçim bitene kadar hepsi
  useEffect(() => {
    if (!map || styleVersion === 0) return
    const source = map.getSource(DRAFT_SOURCE) as GeoJSONSource | undefined
    const geometries: GardenGeometry[] = draft ? [draft.geometry] : imported.map((p) => p.geometry)
    source?.setData({
      type: 'FeatureCollection',
      features: geometries.map((geometry) => ({ type: 'Feature' as const, properties: {}, geometry })),
    })
  }, [map, styleVersion, draft, imported])

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
