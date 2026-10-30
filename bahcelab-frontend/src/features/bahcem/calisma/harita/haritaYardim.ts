import type { Map as MapLibreMap } from 'maplibre-gl'

/** Bahçeye odaklanırken kenar payı (köşe kontrolleri haritayı örtmesin) ve en yüksek yakınlaştırma */
export const ODAK_PAYI = { top: 76, bottom: 72, left: 56, right: 56 } as const
export const ODAK_MAKS_YAKINLASTIRMA = 18.2
/** Dar ekranda en az bu kadar yükseklik (px) harita bahçeye ayrılır: çokgen her alt sayfa durağında görünür kalır. */
export const ODAK_EN_AZ_ALAN = 90

/** Odak payı: alt sayfa varsa görünür yüksekliği (px) alt dolgu sayılır; bahçeye en az ODAK_EN_AZ_ALAN kalır. Alt sayfa yoksa (0) masaüstü payı. */
export function odakPayi(altSayfaPx: number, haritaH: number): { top: number; bottom: number; left: number; right: number } {
  if (altSayfaPx <= 0) return { ...ODAK_PAYI }
  const top = 118 // ray + lejant çipi
  const bottom = Math.max(16, Math.min(altSayfaPx + 12, haritaH - top - ODAK_EN_AZ_ALAN))
  return { top, bottom, left: 24, right: 24 }
}

/** En üstte kalması gereken katmanlar (soluk dış alan, sınır çizgileri) yeni eklenen katmanların üstüne taşınır. */
export function sinirlarUste(map: MapLibreMap): void {
  ;['kb-dim', 'kb-rest', 'kb-sel-hale', 'kb-sel'].forEach((id) => map.getLayer(id) && map.moveLayer(id))
}
