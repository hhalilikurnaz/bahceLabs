import { kml } from '@tmcw/togeojson'
import JSZip from 'jszip'
import type { GardenGeometry, Position } from '../api/types'
import { geometryAreaDekar } from './geo'
import type { ImportedPolygon } from '../stores/bahcemStore'

export const MAX_FILE_BYTES = 10 * 1024 * 1024

export class ImportError extends Error {}

type Json = Record<string, unknown>

const isRecord = (value: unknown): value is Json => typeof value === 'object' && value !== null

/** Koordinatları [boylam, enlem] çiftine indirger (KML yükseklik değerini atar). */
function strip2D(position: unknown): Position {
  const p = position as number[]
  return [p[0], p[1]]
}

function cleanGeometry(geometry: Json): GardenGeometry | null {
  const coords = geometry.coordinates as unknown
  if (geometry.type === 'Polygon' && Array.isArray(coords)) {
    return { type: 'Polygon', coordinates: coords.map((ring: unknown[]) => ring.map(strip2D)) }
  }
  if (geometry.type === 'MultiPolygon' && Array.isArray(coords)) {
    return {
      type: 'MultiPolygon',
      coordinates: coords.map((poly: unknown[][]) => poly.map((ring) => ring.map(strip2D))),
    }
  }
  return null
}

function collectGeometries(node: unknown, name: string | undefined, out: { name?: string; g: Json }[]) {
  if (!isRecord(node)) return
  switch (node.type) {
    case 'FeatureCollection':
      for (const feature of (node.features as unknown[]) ?? []) collectGeometries(feature, undefined, out)
      break
    case 'Feature': {
      const props = isRecord(node.properties) ? node.properties : {}
      const featureName = typeof props.name === 'string' ? props.name.trim() : undefined
      collectGeometries(node.geometry, featureName || name, out)
      break
    }
    case 'GeometryCollection':
      for (const g of (node.geometries as unknown[]) ?? []) collectGeometries(g, name, out)
      break
    case 'Polygon':
    case 'MultiPolygon':
      out.push({ name, g: node })
      break
  }
}

/** GeoJSON (Feature, FeatureCollection veya çıplak geometri) içindeki poligonları çıkarır. */
export function extractPolygons(geojson: unknown): ImportedPolygon[] {
  const found: { name?: string; g: Json }[] = []
  collectGeometries(geojson, undefined, found)

  const polygons: ImportedPolygon[] = []
  for (const { name, g } of found) {
    const geometry = cleanGeometry(g)
    if (!geometry) continue
    const index = polygons.length + 1
    polygons.push({
      id: `poly-${index}`,
      name: name || `Poligon ${index}`,
      geometry,
      areaDekar: geometryAreaDekar(geometry),
    })
  }

  const outOfRange = polygons.some((p) =>
    (p.geometry.type === 'Polygon' ? [p.geometry.coordinates] : p.geometry.coordinates)
      .flat(2)
      .some(([lng, lat]) => Math.abs(lng) > 180 || Math.abs(lat) > 90),
  )
  if (outOfRange) {
    throw new ImportError(
      'Dosyadaki koordinatlar boylam/enlem (WGS84) biçiminde değil. Dosyayı EPSG:4326 olarak dışa aktarın.',
    )
  }
  return polygons
}

async function kmlTextFromKmz(file: File): Promise<string> {
  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(await file.arrayBuffer())
  } catch {
    throw new ImportError('KMZ dosyası açılamadı. Dosya bozuk olabilir.')
  }
  const entries = Object.values(zip.files).filter((f) => !f.dir && f.name.toLowerCase().endsWith('.kml'))
  const entry = entries.find((f) => f.name.toLowerCase() === 'doc.kml') ?? entries[0]
  if (!entry) throw new ImportError('KMZ içinde KML dosyası bulunamadı.')
  return entry.async('text')
}

function parseKml(text: string): unknown {
  const doc = new DOMParser().parseFromString(text, 'text/xml')
  if (doc.querySelector('parsererror')) {
    throw new ImportError('KML dosyası okunamadı. Dosya bozuk olabilir.')
  }
  return kml(doc)
}

/** KML, KMZ veya GeoJSON dosyasından poligonları okur. Hata mesajları kullanıcıya gösterilebilir. */
export async function parseGardenFile(file: File): Promise<ImportedPolygon[]> {
  if (file.size > MAX_FILE_BYTES) {
    throw new ImportError('Dosya çok büyük (en fazla 10 MB).')
  }
  const name = file.name.toLowerCase()

  let geojson: unknown
  if (name.endsWith('.kmz')) {
    geojson = parseKml(await kmlTextFromKmz(file))
  } else if (name.endsWith('.kml')) {
    geojson = parseKml(await file.text())
  } else if (name.endsWith('.geojson') || name.endsWith('.json')) {
    try {
      geojson = JSON.parse(await file.text())
    } catch {
      throw new ImportError('GeoJSON dosyası okunamadı. Dosya bozuk olabilir.')
    }
  } else {
    throw new ImportError('Desteklenen dosya türleri: KML, KMZ, GeoJSON.')
  }

  const polygons = extractPolygons(geojson)
  if (polygons.length === 0) {
    throw new ImportError('Dosyada poligon bulunamadı. Bahçe sınırı poligon olarak kaydedilmiş olmalı.')
  }
  return polygons
}
