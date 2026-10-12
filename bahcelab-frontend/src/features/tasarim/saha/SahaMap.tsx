import { useEffect, useMemo, useRef, useState } from 'react'
import type { CanvasSource, Map as MLMap, Marker } from 'maplibre-gl'
import type { Proto } from '../data'
import { loadMapLibre } from '../../bahcem/map/maplibre'
import { buildStyle } from '../../bahcem/map/mapStyles'
import { CoordTicks, NorthArrow, ScaleBar } from './assets'
import { paintGrid, type PGrid } from './grids'
import { ZONE_HEX } from './palette'

export interface MapPin { lng: number; lat: number; text: string; kind: 'pin' | 'label' }

export const ringsOf = (d: Proto): number[][] => {
  const g = d.garden?.geometry
  if (!g) return []
  return (g.type === 'Polygon' ? g.coordinates[0] : g.coordinates[0][0]) as number[][]
}
const centroid = (g: GeoJSON.Geometry): [number, number] | null => {
  const ring = g.type === 'Polygon' ? g.coordinates[0] : g.type === 'MultiPolygon' ? g.coordinates[0]?.[0] : null
  return ring?.length ? [ring.reduce((a, p) => a + p[0], 0) / ring.length, ring.reduce((a, p) => a + p[1], 0) / ring.length] : null
}

/** Zayıf bölge ve sorunlu alan işaretleri (etiketli): «−%14 · 2,3 da». */
export function problemPinsSaha(d: Proto): MapPin[] {
  const median = d.latest?.indeksler.ndvi?.medyan
  return (d.zones?.features ?? []).slice(0, 3).flatMap((f) => {
    const c = centroid(f.geometry)
    if (!c || f.properties.ortalama == null || !median) return []
    return [{ lng: c[0], lat: c[1], kind: 'pin' as const, text: `−%${Math.abs(Math.round(((f.properties.ortalama - median) / median) * 100))} · ${(f.properties.alan_m2 / 1000).toFixed(1).replace('.', ',')} da` }]
  })
}

interface Props {
  d: Proto
  grid: PGrid | undefined
  domain: [number, number]
  contours?: boolean
  zones?: boolean
  weakHatch?: boolean
  pins?: MapPin[]
  padding?: { top: number; bottom: number; left: number; right: number }
  chrome?: boolean
  minimal?: boolean
}

/** Saha defteri haritası: sönük altlık, net piksel (10 m) indeks katmanı, isteğe bağlı kontur/bölge/tarama; bahçe dışı soluk; ölçek, kuzey oku, koordinat. */
export function SahaMap({ d, grid, domain, contours = false, zones = false, weakHatch = false, pins = [], padding, chrome = true, minimal = false }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MLMap | null>(null)
  const markers = useRef<Marker[]>([])
  const [ready, setReady] = useState(false)
  const [view, setView] = useState<{ b: { w: number; s: number; e: number; n: number }; ppm: number; w: number; h: number } | null>(null)
  const ring = useMemo(() => ringsOf(d), [d])
  const pinKey = pins.map((p) => p.text).join('|')

  useEffect(() => {
    if (!box.current || !d.garden) return
    let disposed = false
    void loadMapLibre().then((lib) => {
      if (disposed || !box.current) return
      const map = new lib.Map({ container: box.current, style: buildStyle('satellite'), attributionControl: { compact: true }, fadeDuration: 0 })
      mapRef.current = map
      const b = new lib.LngLatBounds(ring[0] as [number, number], ring[0] as [number, number])
      ring.forEach((p) => b.extend(p as [number, number]))
      map.fitBounds(b, { padding: padding ?? 90, duration: 0, maxZoom: 18.3 })
      const sync = () => {
        const bb = map.getBounds()
        const c = map.getContainer()
        const mpp = (40075016.686 * Math.cos((map.getCenter().lat * Math.PI) / 180)) / (512 * Math.pow(2, map.getZoom()))
        setView({ b: { w: bb.getWest(), s: bb.getSouth(), e: bb.getEast(), n: bb.getNorth() }, ppm: 1 / mpp, w: c.clientWidth, h: c.clientHeight })
      }
      map.on('move', sync)
      map.on('load', () => {
        // sönük altlık: veri öne çıksın
        if (map.getLayer('basemap')) {
          map.setPaintProperty('basemap', 'raster-saturation', -0.8)
          map.setPaintProperty('basemap', 'raster-contrast', -0.2)
          map.setPaintProperty('basemap', 'raster-brightness-min', 0.22)
        }
        map.addSource('garden', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: d.garden!.geometry } })
        map.addSource('dim', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]], ring] } } })
        map.addLayer({ id: 'dim', type: 'fill', source: 'dim', paint: { 'fill-color': '#fbfaf6', 'fill-opacity': 0.5 } })
        map.addLayer({ id: 'garden-line', type: 'line', source: 'garden', paint: { 'line-color': '#16181a', 'line-width': 1.6 } })
        // tarama deseni
        const c = document.createElement('canvas')
        c.width = c.height = 8
        const x = c.getContext('2d')!
        x.strokeStyle = 'rgba(22,24,26,.85)'
        x.lineWidth = 1.1
        x.beginPath()
        x.moveTo(-1, 9)
        x.lineTo(9, -1)
        x.moveTo(-1, 1)
        x.lineTo(1, -1)
        x.moveTo(7, 9)
        x.lineTo(9, 7)
        x.stroke()
        map.addImage('hatch', x.getImageData(0, 0, 8, 8))
        sync()
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

  // net piksel indeks katmanı (+ kontur)
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready || !grid) return
    const canvas = paintGrid(grid, { domain, scale: contours ? 8 : 4, contourStep: contours ? Math.max(0.01, Math.ceil(((domain[1] - domain[0]) / 6) * 100) / 100) : null, clip: ring })
    if (map.getLayer('idx')) map.removeLayer('idx')
    if (map.getSource('idx')) map.removeSource('idx')
    map.addSource('idx', { type: 'canvas', canvas, coordinates: grid.corners as never, animate: false })
    map.addLayer({ id: 'idx', type: 'raster', source: 'idx', paint: { 'raster-resampling': 'nearest', 'raster-opacity': 1, 'raster-fade-duration': 0 } }, 'dim')
    const src = map.getSource('idx') as CanvasSource
    src.play()
    requestAnimationFrame(() => requestAnimationFrame(() => src.pause()))
  }, [ready, grid, domain, contours, ring])

  // bölge katmanı (%30) ve zayıf bölge tarama deseni
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    ;['zones-fill', 'zones-line', 'weak-hatch'].forEach((l) => map.getLayer(l) && map.removeLayer(l))
    if (map.getSource('zones')) map.removeSource('zones')
    const feats = d.multi?.bolgeler?.features ?? []
    if (!feats.length || (!zones && !weakHatch)) return
    map.addSource('zones', { type: 'geojson', data: { type: 'FeatureCollection', features: feats.map((f) => ({ type: 'Feature', geometry: f.geometry, properties: f.properties })) } })
    if (zones) {
      map.addLayer({ id: 'zones-fill', type: 'fill', source: 'zones', paint: { 'fill-color': ['match', ['get', 'sinif'], 1, ZONE_HEX[0], 2, ZONE_HEX[1], 3, ZONE_HEX[2], 4, ZONE_HEX[3], 5, ZONE_HEX[4], '#888'], 'fill-opacity': 0.32 } }, 'garden-line')
      map.addLayer({ id: 'zones-line', type: 'line', source: 'zones', paint: { 'line-color': '#16181a', 'line-width': 1.2, 'line-dasharray': [3, 2] } }, 'garden-line')
    }
    if (weakHatch) map.addLayer({ id: 'weak-hatch', type: 'fill', source: 'zones', filter: ['==', ['get', 'sinif'], 1], paint: { 'fill-pattern': 'hatch', 'fill-opacity': 0.9 } }, 'garden-line')
  }, [ready, zones, weakHatch, d.multi])

  // etiketler
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    void loadMapLibre().then((lib) => {
      markers.current.forEach((m) => m.remove())
      markers.current = pins.map((p) => {
        const el = document.createElement('div')
        el.className = p.kind === 'pin' ? 'mappin' : 'maplabel'
        el.textContent = p.text
        return new lib.Marker({ element: el, anchor: p.kind === 'pin' ? 'bottom' : 'center' }).setLngLat([p.lng, p.lat]).addTo(map)
      })
    })
  }, [ready, pinKey]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div ref={box} style={{ position: 'absolute', inset: 0 }} />
      {chrome && view && !minimal && (
        <>
          <CoordTicks bounds={view.b} width={view.w} height={view.h} />
          <div style={{ position: 'absolute', right: 16, top: 40, pointerEvents: 'none', background: 'rgb(251 250 246 / .86)', padding: 4 }}><NorthArrow /></div>
          <div style={{ position: 'absolute', left: 16, bottom: 22, pointerEvents: 'none', background: 'rgb(251 250 246 / .86)', padding: '2px 6px 0' }}><ScaleBar pxPerMeter={view.ppm} /></div>
        </>
      )}
    </div>
  )
}
