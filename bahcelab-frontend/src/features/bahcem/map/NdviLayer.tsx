import { useEffect } from 'react'
import { Popup, type GeoJSONSource, type ImageSource, type MapLayerMouseEvent } from 'maplibre-gl'
import { ndviImageUrl, useNdviZones } from '../api/ndviApi'
import { useNdviView } from '../hooks/useNdviView'
import { formatNdvi } from '../lib/ndvi'
import { cssColor } from './cssColor'
import { useMap } from './useMap'

const IMAGE_SOURCE = 'ndvi-image'
const RASTER = 'ndvi-raster'
const ZONES_SOURCE = 'ndvi-zones'
const ZONES_FILL = 'ndvi-zones-fill'
const ZONES_LINE = 'ndvi-zones-line'

const empty: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }

type Corners = [[number, number], [number, number], [number, number], [number, number]]

/**
 * Seçili bahçenin NDVI PNG'sini sınırına oturtulmuş görüntü katmanı olarak çizer (nearest: keskin 10 m
 * pikseller) ve sorunlu bölgeleri kesikli kırmızı çizgiyle gösterir; bölgeye tıklayınca bilgi kartı açılır.
 */
export function NdviLayer() {
  const { map, styleVersion } = useMap()
  const { gardenId, active, shown } = useNdviView()
  const { data: zones } = useNdviZones(gardenId, active?.tarih ?? null, shown)

  // Görüntü katmanı: kaynak bir kez kurulur, tarih değişince updateImage ile güncellenir
  useEffect(() => {
    if (!map || styleVersion === 0) return

    const ready = shown && gardenId && active?.koordinatlar?.length === 4
    if (!ready) {
      if (map.getLayer(RASTER)) map.setLayoutProperty(RASTER, 'visibility', 'none')
      return
    }

    const url = ndviImageUrl(gardenId, active)
    const coordinates = active.koordinatlar as Corners
    const existing = map.getSource(IMAGE_SOURCE) as ImageSource | undefined
    if (existing) {
      existing.updateImage({ url, coordinates })
    } else {
      map.addSource(IMAGE_SOURCE, { type: 'image', url, coordinates })
    }
    if (!map.getLayer(RASTER)) {
      map.addLayer(
        {
          id: RASTER,
          type: 'raster',
          source: IMAGE_SOURCE,
          paint: { 'raster-resampling': 'nearest', 'raster-opacity': 0.92, 'raster-fade-duration': 0 },
        },
        // Bahçe sınır çizgisinin altında kalsın
        map.getLayer('gardens-fill') ? 'gardens-fill' : undefined,
      )
    }
    map.setLayoutProperty(RASTER, 'visibility', 'visible')
  }, [map, styleVersion, shown, gardenId, active])

  // Sorunlu bölgeler
  useEffect(() => {
    if (!map || styleVersion === 0) return
    const danger = cssColor('--color-app-danger', '#f87171')

    if (!map.getSource(ZONES_SOURCE)) {
      map.addSource(ZONES_SOURCE, { type: 'geojson', data: empty })
      map.addLayer({
        id: ZONES_FILL,
        type: 'fill',
        source: ZONES_SOURCE,
        paint: { 'fill-color': danger, 'fill-opacity': 0.08 },
      })
      map.addLayer({
        id: ZONES_LINE,
        type: 'line',
        source: ZONES_SOURCE,
        paint: { 'line-color': danger, 'line-width': 2, 'line-dasharray': [2, 1.5] },
      })
    }
    const source = map.getSource(ZONES_SOURCE) as GeoJSONSource
    source.setData(shown && zones ? (zones as GeoJSON.FeatureCollection) : empty)
  }, [map, styleVersion, shown, zones])

  // Bölgeye tıklayınca alan ve ortalama NDVI
  useEffect(() => {
    if (!map || styleVersion === 0) return
    let popup: Popup | null = null

    const onClick = (e: MapLayerMouseEvent) => {
      const props = e.features?.[0]?.properties as { alan_m2?: number; ortalama_ndvi?: number | null } | undefined
      if (!props) return
      const card = document.createElement('div')
      const title = document.createElement('strong')
      title.textContent = 'Sorunlu bölge'
      const area = document.createElement('div')
      area.textContent = `Alan: ${Math.round(props.alan_m2 ?? 0).toLocaleString('tr-TR')} m²`
      const mean = document.createElement('div')
      mean.textContent = `Ortalama NDVI: ${formatNdvi(props.ortalama_ndvi ?? null)}`
      const hint = document.createElement('div')
      hint.className = 'ndvi-popup-hint'
      hint.textContent = 'Bahçe medyanının 0,10 altında'
      card.append(title, area, mean, hint)

      popup?.remove()
      popup = new Popup({ closeButton: true, maxWidth: '240px', className: 'bahcem-popup' })
        .setLngLat(e.lngLat)
        .setDOMContent(card)
        .addTo(map)
    }
    const onEnter = () => (map.getCanvas().style.cursor = 'pointer')
    const onLeave = () => (map.getCanvas().style.cursor = '')

    map.on('click', ZONES_FILL, onClick)
    map.on('mouseenter', ZONES_FILL, onEnter)
    map.on('mouseleave', ZONES_FILL, onLeave)
    return () => {
      popup?.remove()
      map.off('click', ZONES_FILL, onClick)
      map.off('mouseenter', ZONES_FILL, onEnter)
      map.off('mouseleave', ZONES_FILL, onLeave)
    }
  }, [map, styleVersion])

  return null
}
