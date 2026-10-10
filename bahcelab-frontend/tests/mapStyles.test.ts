import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  MAPBOX_NATIVE_MAX_ZOOM,
  availableProviders,
  buildStyle,
  effectiveProvider,
} from '@/features/bahcem/map/mapStyles'

afterEach(() => vi.unstubAllEnvs())

const KEYS = { mapbox: 'tok_test', maptiler: 'key_test' }

describe('altlık sağlayıcı', () => {
  it('Mapbox uydu: @2x 512 px karolar, gerçek ayrıntı sınırında maxzoom, atıflı', () => {
    const style = buildStyle('satellite', 'mapbox', KEYS)
    if (typeof style === 'string') throw new Error('Mapbox stili nesne olmalı')
    const source = style.sources.basemap
    if (source.type !== 'raster') throw new Error('raster olmalı')
    expect(source.tiles?.[0]).toContain('/v4/mapbox.satellite/{z}/{x}/{y}@2x.jpg90')
    expect(source.tileSize).toBe(512)
    expect(source.maxzoom).toBe(MAPBOX_NATIVE_MAX_ZOOM)
    expect(source.attribution).toContain('Mapbox')
    expect(source.attribution).toContain('OpenStreetMap')
    expect(source.attribution).toContain('Improve this map')
  })

  it('Mapbox hibrit ve harita: stil karoları', () => {
    const hybrid = buildStyle('hybrid', 'mapbox', KEYS)
    const streets = buildStyle('streets', 'mapbox', KEYS)
    expect(JSON.stringify(hybrid)).toContain('satellite-streets-v12')
    expect(JSON.stringify(streets)).toContain('streets-v12')
  })

  it('MapTiler: stil adresi', () => {
    expect(buildStyle('satellite', 'maptiler', KEYS)).toBe(
      'https://api.maptiler.com/maps/satellite/style.json?key=key_test',
    )
  })

  it('anahtar yoksa diğer sağlayıcıya, hiçbiri yoksa OSM yedeğine düşer', () => {
    expect(buildStyle('satellite', 'mapbox', { maptiler: 'k' })).toContain('maptiler.com')
    expect(JSON.stringify(buildStyle('satellite', 'maptiler', { mapbox: 't' }))).toContain('mapbox.satellite')
    expect(JSON.stringify(buildStyle('satellite', 'mapbox', {}))).toContain('tile.openstreetmap.org')
  })

  it('kullanılabilir sağlayıcılar ve etkin sağlayıcı ortam değişkenlerinden gelir', () => {
    vi.stubEnv('VITE_MAPBOX_TOKEN', '')
    vi.stubEnv('VITE_MAPTILER_KEY', 'k')
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(availableProviders()).toEqual(['maptiler'])
    expect(effectiveProvider('mapbox')).toBe('maptiler')
    vi.stubEnv('VITE_MAPTILER_KEY', '')
    expect(effectiveProvider('mapbox')).toBe('osm')
    vi.stubEnv('VITE_MAPBOX_TOKEN', 't')
    expect(effectiveProvider('mapbox')).toBe('mapbox')
  })
})
