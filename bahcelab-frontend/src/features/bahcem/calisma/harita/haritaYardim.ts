import type { Map as MapLibreMap } from 'maplibre-gl'

/** Bahçeye odaklanırken kenar payı (köşe kontrolleri haritayı örtmesin) ve en yüksek yakınlaştırma */
export const ODAK_PAYI = { top: 76, bottom: 72, left: 56, right: 56 } as const
export const ODAK_MAKS_YAKINLASTIRMA = 18.2

/** En üstte kalması gereken katmanlar (soluk dış alan, sınır çizgileri) yeni eklenen katmanların üstüne taşınır. */
export function sinirlarUste(map: MapLibreMap): void {
  ;['kb-dim', 'kb-rest', 'kb-sel-hale', 'kb-sel'].forEach((id) => map.getLayer(id) && map.moveLayer(id))
}
