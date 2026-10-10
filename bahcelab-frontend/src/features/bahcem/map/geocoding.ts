import { getMaptilerKey } from './mapStyles'

export interface PlaceResult {
  id: string
  label: string
  center: [number, number]
  bbox?: [number, number, number, number]
}

/** "36.72, 34.34", "36.72 34.34" veya "36,72;34,34" → enlem, boylam. Geçersizse null. */
export function parseCoordinates(input: string): { lat: number; lng: number } | null {
  const text = input.trim()
  const withComma = /^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/.exec(text)
  const other = /^(-?\d+(?:[.,]\d+)?)\s*[;\s]\s*(-?\d+(?:[.,]\d+)?)$/.exec(text)
  const match = withComma ?? other
  if (!match) return null

  const first = Number(match[1].replace(',', '.'))
  const second = Number(match[2].replace(',', '.'))
  // Enlem ilk yazılır; ilk değer 90'ı aşıyorsa boylam-enlem sırası kastedilmiş sayılır
  const [lat, lng] = Math.abs(first) > 90 ? [second, first] : [first, second]
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null
  return { lat, lng }
}

interface GeocodingResponse {
  features?: {
    id?: string
    place_name?: string
    text?: string
    center?: [number, number]
    bbox?: [number, number, number, number]
  }[]
}

/** MapTiler Geocoding: il, ilçe, köy vb. Türkiye ile sınırlıdır. */
export async function searchPlaces(query: string, signal?: AbortSignal): Promise<PlaceResult[]> {
  const key = getMaptilerKey()
  if (!key || query.trim().length < 2) return []

  const params = new URLSearchParams({
    key,
    language: 'tr',
    country: 'tr',
    limit: '6',
    autocomplete: 'true',
  })
  const response = await fetch(
    `https://api.maptiler.com/geocoding/${encodeURIComponent(query.trim())}.json?${params}`,
    { signal },
  )
  if (!response.ok) throw new Error(`Geocoding ${response.status}`)

  const data = (await response.json()) as GeocodingResponse
  return (data.features ?? [])
    .filter((f) => f.center)
    .map((f, index) => ({
      id: f.id ?? `${index}`,
      label: f.place_name ?? f.text ?? '',
      center: f.center as [number, number],
      bbox: f.bbox,
    }))
}

export interface AdminArea {
  il: string | null
  ilce: string | null
}

interface ReverseResponse {
  features?: { place_type?: string[]; text?: string }[]
}

const DISTRICT_TYPES = ['joint_municipality', 'municipality', 'municipal_district']

/**
 * MapTiler ters geocoding: Türkiye'de il `county`, ilçe `joint_municipality`/`municipality`
 * olarak döner. Bulunamayan alan null kalır (kullanıcı elle girebilir).
 */
export async function reverseGeocode(
  lng: number,
  lat: number,
  signal?: AbortSignal,
): Promise<AdminArea> {
  const key = getMaptilerKey()
  if (!key) return { il: null, ilce: null }

  const params = new URLSearchParams({ key, language: 'tr' })
  const response = await fetch(`https://api.maptiler.com/geocoding/${lng},${lat}.json?${params}`, {
    signal,
  })
  if (!response.ok) throw new Error(`Geocoding ${response.status}`)

  const features = ((await response.json()) as ReverseResponse).features ?? []
  const textOf = (types: string[]) =>
    features.find((f) => f.place_type?.some((t) => types.includes(t)))?.text?.trim() || null

  return { il: textOf(['county']), ilce: textOf(DISTRICT_TYPES) }
}
