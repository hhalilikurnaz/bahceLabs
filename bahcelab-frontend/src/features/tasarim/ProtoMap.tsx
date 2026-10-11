import { useEffect, useMemo, useRef, useState } from 'react'
import type { CanvasSource, Map as MLMap, Marker } from 'maplibre-gl'
import type { Proto } from './data'
import { loadMapLibre } from '../bahcem/map/maplibre'
import { buildStyle } from '../bahcem/map/mapStyles'
import { renderScene, sceneGeometry, type Rings } from '../bahcem/lib/rasterRender'
import type { LayerId } from '../bahcem/lib/indices'

export interface Pin {
  lng: number
  lat: number
  text: string
  kind: 'sorun' | 'bolge'
}

const centroid = (g: GeoJSON.Geometry): [number, number] | null => {
  const ring = g.type === 'Polygon' ? g.coordinates[0] : g.type === 'MultiPolygon' ? g.coordinates[0]?.[0] : null
  if (!ring?.length) return null
  return [ring.reduce((a, p) => a + p[0], 0) / ring.length, ring.reduce((a, p) => a + p[1], 0) / ring.length]
}

/** Sorunlu alan çokgenlerinden etiketli işaretler: «−%14 · 2,3 da» */
export function problemPins(d: Proto): Pin[] {
  const median = d.latest?.indeksler.ndvi?.medyan
  return (d.zones?.features ?? []).slice(0, 3).flatMap((f) => {
    const c = centroid(f.geometry)
    if (!c || f.properties.ortalama == null || !median) return []
    const pct = Math.round(((f.properties.ortalama - median) / median) * 100)
    return [{ lng: c[0], lat: c[1], kind: 'sorun' as const, text: `−%${Math.abs(pct)} · ${(f.properties.alan_m2 / 1000).toFixed(1).replace('.', ',')} da` }]
  })
}

const ZONE_COLORS = ['var(--kc-zone-1)', 'var(--kc-zone-2)', 'var(--kc-zone-3)', 'var(--kc-zone-4)', 'var(--kc-zone-5)']
const ZONE_HEX: Record<string, string[]> = {
  gece: ['#c9794f', '#d9bd5c', '#5fb4a2', '#4f86c6', '#8a6fc9'],
  toprak: ['#d27b58', '#e0c06a', '#8fb996', '#7da6c9', '#a98fcf'],
}
export { ZONE_COLORS }

/** Önizleme haritası: gerçek altlık + bahçenin en güncel gerçek indeks görüntüsü; bölge katmanı ve etiketli işaretler isteğe bağlı. */
export function ProtoMap({ d, yon, layer = 'ndvi', zones = false, pins = [], padding, className }: { d: Proto; yon: 'gece' | 'toprak'; layer?: LayerId; zones?: boolean; pins?: Pin[]; padding?: { top: number; bottom: number; left: number; right: number }; className?: string }) {
  const box = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MLMap | null>(null)
  const markers = useRef<Marker[]>([])
  const [ready, setReady] = useState(false)
  const ring = useMemo<Rings>(() => (d.garden ? (d.garden.geometry.type === 'Polygon' ? d.garden.geometry.coordinates : d.garden.geometry.coordinates.flat()) : []), [d.garden])
  const pinKey = pins.map((p) => p.text).join('|')

  useEffect(() => {
    if (!box.current || !d.garden) return
    let disposed = false
    void loadMapLibre().then((lib) => {
      if (disposed || !box.current) return
      const map = new lib.Map({ container: box.current, style: buildStyle('satellite'), attributionControl: { compact: true }, interactive: true, fadeDuration: 0 })
      mapRef.current = map
      const r = ring[0] as number[][]
      const b = new lib.LngLatBounds(r[0] as [number, number], r[0] as [number, number])
      r.forEach((p) => b.extend(p as [number, number]))
      map.fitBounds(b, { padding: padding ?? 90, duration: 0, maxZoom: 18.2 })
      map.on('load', () => {
        map.addSource('garden', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: d.garden!.geometry } })
        map.addLayer({ id: 'garden-line', type: 'line', source: 'garden', paint: { 'line-color': '#f2c94c', 'line-width': 2 } })
        setReady(true)
      })
    })
    return () => {
      disposed = true
      mapRef.current?.remove()
      mapRef.current = null
      setReady(false)
    }
  }, [d.garden?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Gerçek indeks görüntüsü
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready || !d.latest || !d.id) return
    let cancelled = false
    const apply = async () => {
      const geo = sceneGeometry(d.latest!)
      const result = await renderScene({ gardenId: d.id!, scene: d.latest!, layer, grid: layer === 'ndvi' ? d.grid : undefined, settings: { skala: 'kendi', cizim: 'yumusak', renkKorlugu: false }, rings: ring })
      if (cancelled || !result || !geo) return
      const canvas = document.createElement('canvas')
      canvas.width = result.image.width
      canvas.height = result.image.height
      canvas.getContext('2d')?.putImageData(result.image.data, 0, 0)
      if (map.getLayer('idx')) map.removeLayer('idx')
      if (map.getSource('idx')) map.removeSource('idx')
      map.addSource('idx', { type: 'canvas', canvas, coordinates: geo.corners as never, animate: false })
      map.addLayer({ id: 'idx', type: 'raster', source: 'idx', paint: { 'raster-opacity': zones ? 0.85 : 0.92, 'raster-resampling': 'linear', 'raster-fade-duration': 0 } }, map.getLayer('garden-line') ? 'garden-line' : undefined)
      const src = map.getSource('idx') as CanvasSource
      src.play()
      requestAnimationFrame(() => requestAnimationFrame(() => src.pause()))
    }
    const run = () => void apply()
    run()
    return () => {
      cancelled = true
    }
  }, [ready, d.latest?.tarih, d.grid, layer, d.id, ring, zones])

  // Çok yıllık bölge katmanı (~%35 opaklık)
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const run = () => {
      ;['zones-fill', 'zones-line'].forEach((l) => map.getLayer(l) && map.removeLayer(l))
      if (map.getSource('zones')) map.removeSource('zones')
      if (!zones || !d.multi?.bolgeler) return
      const hex = ZONE_HEX[yon]
      map.addSource('zones', { type: 'geojson', data: { type: 'FeatureCollection', features: d.multi.bolgeler.features.map((f) => ({ type: 'Feature', geometry: f.geometry, properties: f.properties })) } })
      map.addLayer({ id: 'zones-fill', type: 'fill', source: 'zones', paint: { 'fill-color': ['match', ['get', 'sinif'], 1, hex[0], 2, hex[1], 3, hex[2], 4, hex[3], 5, hex[4], '#888'], 'fill-opacity': 0.4 } })
      map.addLayer({ id: 'zones-line', type: 'line', source: 'zones', paint: { 'line-color': '#ffffff', 'line-width': 1, 'line-opacity': 0.7 } })
      map.moveLayer('garden-line')
    }
    run()
  }, [ready, zones, d.multi, yon])

  // Etiketli işaretler
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    void loadMapLibre().then((lib) => {
      markers.current.forEach((m) => m.remove())
      if (!ready) return
      markers.current = pins.map((p) => {
        const el = document.createElement('div')
        el.className = p.kind === 'sorun' ? 'pin' : 'zonepin'
        el.innerHTML = p.kind === 'sorun' ? `<i></i>${p.text}` : p.text
        return new lib.Marker({ element: el, anchor: p.kind === 'sorun' ? 'bottom' : 'center' }).setLngLat([p.lng, p.lat]).addTo(map)
      })
    })
  }, [ready, pinKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const map = mapRef.current
    if (!map || !padding) return
    map.easeTo({ padding, duration: 0 })
  }, [padding?.top, padding?.bottom, padding?.left, padding?.right]) // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={box} className={className} style={{ position: 'absolute', inset: 0 }} />
}
