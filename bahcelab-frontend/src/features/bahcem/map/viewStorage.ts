import type { BasemapId } from './mapStyles'

export interface MapView {
  center: [number, number]
  zoom: number
  basemap: BasemapId
}

/** Bahçesi olmayan kullanıcı için başlangıç: Türkiye geneli (bahçe varsa açılışta onların sınırına odaklanılır) */
export const DEFAULT_VIEW: MapView = { center: [35.2, 39.0], zoom: 5, basemap: 'satellite' }

const keyFor = (userId: string) => `bahcelab_map_view_v1:${userId}`

function isView(value: unknown): value is MapView {
  const v = value as Partial<MapView> | null
  return (
    !!v &&
    Array.isArray(v.center) &&
    v.center.length === 2 &&
    v.center.every((n) => Number.isFinite(n)) &&
    Number.isFinite(v.zoom) &&
    (v.basemap === 'satellite' || v.basemap === 'hybrid' || v.basemap === 'streets')
  )
}

export function loadView(userId: string): MapView {
  try {
    const raw = localStorage.getItem(keyFor(userId))
    const parsed: unknown = raw ? JSON.parse(raw) : null
    return isView(parsed) ? parsed : DEFAULT_VIEW
  } catch {
    return DEFAULT_VIEW
  }
}

export function saveView(userId: string, view: MapView): void {
  try {
    localStorage.setItem(keyFor(userId), JSON.stringify(view))
  } catch {
    // Depolama kapalı/dolu olabilir; konum hatırlama isteğe bağlıdır
  }
}
