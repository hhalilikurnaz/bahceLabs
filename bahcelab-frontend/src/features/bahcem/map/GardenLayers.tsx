import { useEffect, useMemo } from 'react'
import { useGardenNav } from '../hooks/useGardenNav'
import type { ExpressionSpecification, GeoJSONSource, MapLayerMouseEvent } from 'maplibre-gl'
import { useGardensOverview, type GardenStatus } from '../api/overviewApi'
import { useGardens } from '../api/useGardens'
import type { GardenGeometry } from '../api/types'
import { useIndexView } from '../hooks/useIndexView'
import { MAP } from '../lib/config'
import { polygonsOf } from '../lib/geo'
import { STATUS_META } from '../lib/status'
import { useBahcemStore } from '../stores/bahcemStore'
import { cssColor } from './cssColor'
import { useMap } from './useMap'

const SOURCE = 'gardens'
const FILL = 'gardens-fill'
const CASING = 'gardens-selected-casing'
const LINE = 'gardens-line'
const SPOTLIGHT_SOURCE = 'garden-spotlight'
const SPOTLIGHT_FILL = 'garden-spotlight-fill'
const DRAFT_SOURCE = 'garden-draft'
const DRAFT_FILL = 'garden-draft-fill'
const DRAFT_LINE = 'garden-draft-line'

const empty: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }

const WORLD_RING: [number, number][] = [
  [-180, -85],
  [180, -85],
  [180, 85],
  [-180, 85],
  [-180, -85],
]

/** Dünya poligonu; seçili bahçenin dış halkaları delik olarak çıkarılır (spotlight: bahçe dışı karartılır). */
function spotlightMask(geometry: GardenGeometry): GeoJSON.FeatureCollection {
  const holes = polygonsOf(geometry).map((polygon) => polygon[0] ?? [])
  return {
    type: 'FeatureCollection',
    features: [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [WORLD_RING, ...holes] } }],
  }
}

/**
 * Kayıtlı bahçeleri (duruma göre renkli kenarlı yarı saydam poligon), seçili bahçeyi (limon çerçeve) ve
 * "Tam harita"da bahçe dışını karartan spotlight'ı, ayrıca kaydedilmemiş taslağı çizer.
 * Altlık değişince (styleVersion) kaynak ve katmanlar yeniden eklenir.
 */
export function GardenLayers() {
  const { map, styleVersion } = useMap()
  const { data: gardens } = useGardens()
  const { data: overview } = useGardensOverview()
  const fullMap = useBahcemStore((s) => s.fullMap)
  const selectedId = useBahcemStore((s) => s.selectedGardenId)
  const editingId = useBahcemStore((s) => s.editingGardenId)
  const draft = useBahcemStore((s) => s.draft)
  const imported = useBahcemStore((s) => s.imported)
  const { open: openGarden } = useGardenNav()
  const { shown: ndviShown } = useIndexView()
  const statusById = useMemo(() => new Map((overview?.bahceler ?? []).map((g) => [g.id, g.durum] as const)), [overview])

  // Kaynak ve katmanlar
  useEffect(() => {
    if (!map || styleVersion === 0) return
    const accent = cssColor('--color-app-accent')
    const lemon = cssColor('--color-lemon', '#f2c94c')
    const statusColor = (status: GardenStatus): string => cssColor(STATUS_META[status].mapColorVar, '#ffffff')

    if (!map.getSource(SPOTLIGHT_SOURCE)) {
      map.addSource(SPOTLIGHT_SOURCE, { type: 'geojson', data: empty })
      map.addLayer({
        id: SPOTLIGHT_FILL,
        type: 'fill',
        source: SPOTLIGHT_SOURCE,
        paint: { 'fill-color': cssColor('--color-app-bg', '#0c1710'), 'fill-opacity': MAP.spotlightOpacity },
      })
    }
    if (!map.getSource(SOURCE)) {
      map.addSource(SOURCE, { type: 'geojson', data: empty })
      const color: ExpressionSpecification = [
        'match',
        ['get', 'durum'],
        'iyi',
        statusColor('iyi'),
        'izle',
        statusColor('izle'),
        'dikkat',
        statusColor('dikkat'),
        statusColor('veri_yok'),
      ]
      map.addLayer({
        id: FILL,
        type: 'fill',
        source: SOURCE,
        paint: { 'fill-color': color, 'fill-opacity': ['case', ['get', 'ndvi'], 0, ['get', 'selected'], 0.3, 0.18] },
      })
      // Seçili bahçe: koyu zemin çerçevesi + limon kenar (marka vurgusu)
      map.addLayer({
        id: CASING,
        type: 'line',
        source: SOURCE,
        filter: ['==', ['get', 'selected'], true],
        paint: { 'line-color': '#0c1710', 'line-width': 8, 'line-opacity': 0.55 },
      })
      map.addLayer({
        id: LINE,
        type: 'line',
        source: SOURCE,
        paint: {
          'line-color': ['case', ['get', 'selected'], lemon, color],
          'line-width': ['case', ['get', 'selected'], 4, 2.5],
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
          properties: {
            id: g.id,
            selected: g.id === selectedId,
            ndvi: g.id === selectedId && ndviShown,
            durum: statusById.get(g.id) ?? 'veri_yok',
          },
          geometry: g.geometry,
        })),
    })
  }, [map, styleVersion, gardens, selectedId, editingId, ndviShown, statusById])

  // Spotlight: "Tam harita" açıkken seçili bahçe dışı karartılır
  useEffect(() => {
    if (!map || styleVersion === 0) return
    const source = map.getSource(SPOTLIGHT_SOURCE) as GeoJSONSource | undefined
    const selected = (gardens ?? []).find((g) => g.id === selectedId)
    source?.setData(fullMap && selected ? spotlightMask(selected.geometry) : empty)
  }, [map, styleVersion, gardens, selectedId, fullMap])

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
        openGarden(id)
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
  }, [map, styleVersion, openGarden])

  return null
}
