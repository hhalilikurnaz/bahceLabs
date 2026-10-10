import { useEffect } from 'react'
import { Popup, type ExpressionSpecification, type GeoJSONSource, type MapLayerMouseEvent } from 'maplibre-gl'
import { useYieldZones, useZones } from '../api/indeksApi'
import { useIndexView } from '../hooks/useIndexView'
import { formatDecare } from '../lib/geo'
import { INDEX_DEFS, YIELD_COLORS, formatIndexValue, isIndexId } from '../lib/indices'
import { useBahcemStore } from '../stores/bahcemStore'
import { cssColor } from './cssColor'
import { useMap } from './useMap'

const ZONES_SOURCE = 'ndvi-zones'
const ZONES_FILL = 'ndvi-zones-fill'
const ZONES_LINE = 'ndvi-zones-line'
const YIELD_SOURCE = 'yield-zones'
const YIELD_FILL = 'yield-zones-fill'
const YIELD_LINE = 'yield-zones-line'

const empty: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }

/** Sorunlu bölgeler (kesikli kırmızı) ve verimlilik bölgeleri (3 sınıf) */
export function ZonesLayers() {
  const { map, styleVersion } = useMap()
  const { gardenId, katman, active, shown } = useIndexView()
  const verimlilik = useBahcemStore((s) => s.verimlilik)
  const verimlilikIndeksi = useBahcemStore((s) => s.verimlilikIndeksi)
  const mode = useBahcemStore((s) => s.mode)
  const karsilastirma = useBahcemStore((s) => s.karsilastirma)

  const zoneIndex = isIndexId(katman) ? katman : null
  const showProblem = shown && zoneIndex !== null && !verimlilik && !karsilastirma
  const { data: zones } = useZones(gardenId, zoneIndex ?? 'ndvi', active?.tarih ?? null, showProblem)
  const { data: yieldData } = useYieldZones(gardenId, verimlilikIndeksi, verimlilik && mode === 'idle')

  useEffect(() => {
    if (!map || styleVersion === 0) return
    const danger = cssColor('--color-app-danger', '#f87171')
    if (!map.getSource(ZONES_SOURCE)) {
      map.addSource(ZONES_SOURCE, { type: 'geojson', data: empty })
      map.addLayer({ id: ZONES_FILL, type: 'fill', source: ZONES_SOURCE, paint: { 'fill-color': danger, 'fill-opacity': 0.08 } })
      map.addLayer({
        id: ZONES_LINE,
        type: 'line',
        source: ZONES_SOURCE,
        paint: { 'line-color': danger, 'line-width': 2, 'line-dasharray': [2, 1.5] },
      })
    }
    if (!map.getSource(YIELD_SOURCE)) {
      map.addSource(YIELD_SOURCE, { type: 'geojson', data: empty })
      const color: ExpressionSpecification = [
        'match',
        ['get', 'sinif'],
        'dusuk',
        YIELD_COLORS.dusuk,
        'orta',
        YIELD_COLORS.orta,
        YIELD_COLORS.yuksek,
      ]
      map.addLayer({ id: YIELD_FILL, type: 'fill', source: YIELD_SOURCE, paint: { 'fill-color': color, 'fill-opacity': 0.55 } })
      map.addLayer({ id: YIELD_LINE, type: 'line', source: YIELD_SOURCE, paint: { 'line-color': '#ffffff', 'line-width': 1.5, 'line-opacity': 0.8 } })
    }
    ;(map.getSource(ZONES_SOURCE) as GeoJSONSource).setData(showProblem && zones ? (zones as GeoJSON.FeatureCollection) : empty)
    ;(map.getSource(YIELD_SOURCE) as GeoJSONSource).setData(
      verimlilik && yieldData && mode === 'idle' ? (yieldData.bolgeler as GeoJSON.FeatureCollection) : empty,
    )
  }, [map, styleVersion, showProblem, zones, verimlilik, yieldData, mode])

  // Bölgeye tıklayınca alan ve ortalama değer
  useEffect(() => {
    if (!map || styleVersion === 0) return
    let popup: Popup | null = null

    const open = (e: MapLayerMouseEvent, title: string, lines: string[], hint: string, danger: boolean) => {
      const card = document.createElement('div')
      const strong = document.createElement('strong')
      strong.textContent = title
      if (!danger) strong.style.color = 'var(--color-app-text)'
      card.append(strong)
      for (const line of lines) {
        const row = document.createElement('div')
        row.textContent = line
        card.append(row)
      }
      const note = document.createElement('div')
      note.className = 'ndvi-popup-hint'
      note.textContent = hint
      card.append(note)
      popup?.remove()
      popup = new Popup({ closeButton: true, maxWidth: '240px', className: 'bahcem-popup' }).setLngLat(e.lngLat).setDOMContent(card).addTo(map)
    }

    const onProblem = (e: MapLayerMouseEvent) => {
      const props = e.features?.[0]?.properties as { alan_m2?: number; ortalama?: number | null } | undefined
      if (!props) return
      const id = zoneIndex ?? 'ndvi'
      open(
        e,
        'Sorunlu bölge',
        [`Alan: ${Math.round(props.alan_m2 ?? 0).toLocaleString('tr-TR')} m²`, `Ortalama ${INDEX_DEFS[id].ad}: ${formatIndexValue(id, props.ortalama ?? null)}`],
        'Bahçe medyanının belirgin altında',
        true,
      )
    }
    const onYield = (e: MapLayerMouseEvent) => {
      const props = e.features?.[0]?.properties as { etiket?: string; alan_m2?: number; pay?: number; ortalama?: number } | undefined
      if (!props) return
      const id = useBahcemStore.getState().verimlilikIndeksi
      open(
        e,
        `${props.etiket} verimlilik bölgesi`,
        [
          `Alan: ${formatDecare((props.alan_m2 ?? 0) / 1000)} (%${Math.round((props.pay ?? 0) * 100)})`,
          `Geçmiş ortalama ${INDEX_DEFS[id].ad}: ${formatIndexValue(id, props.ortalama ?? null)}`,
        ],
        'Tüm geçerli geçmiş görüntülerin ortalamasından',
        false,
      )
    }
    const pointer = () => (map.getCanvas().style.cursor = 'pointer')
    const reset = () => (map.getCanvas().style.cursor = '')

    map.on('click', ZONES_FILL, onProblem)
    map.on('click', YIELD_FILL, onYield)
    for (const layer of [ZONES_FILL, YIELD_FILL]) {
      map.on('mouseenter', layer, pointer)
      map.on('mouseleave', layer, reset)
    }
    return () => {
      popup?.remove()
      map.off('click', ZONES_FILL, onProblem)
      map.off('click', YIELD_FILL, onYield)
      for (const layer of [ZONES_FILL, YIELD_FILL]) {
        map.off('mouseenter', layer, pointer)
        map.off('mouseleave', layer, reset)
      }
    }
  }, [map, styleVersion, zoneIndex])

  return null
}
