export const PRODUCTS = [
  { value: 'limon', label: 'Limon' },
  { value: 'portakal', label: 'Portakal' },
  { value: 'mandalina', label: 'Mandalina' },
  { value: 'greyfurt', label: 'Greyfurt' },
  { value: 'diger', label: 'Diğer' },
] as const

export type Urun = (typeof PRODUCTS)[number]['value']

export type Position = [number, number]
export type PolygonCoordinates = Position[][]

export type GardenGeometry =
  | { type: 'Polygon'; coordinates: PolygonCoordinates }
  | { type: 'MultiPolygon'; coordinates: PolygonCoordinates[] }

export interface Garden {
  id: string
  ad: string
  urun: Urun
  cesit: string | null
  /** Katalog çeşit kodu; 'diger' ise `cesit` serbest metindir */
  cesitKodu: string | null
  dikimYili: number | null
  agacSayisi: number | null
  geometry: GardenGeometry
  /** Sunucuda ST_Area(ST_Transform(geom, 32636)) / 1000 ile hesaplanır */
  alanDekar: number
  il: string | null
  ilce: string | null
  createdAt: string
  /** Son geçerli (bulutsuz) NDVI gözleminin ortalaması ve tarihi; yoksa null */
  sonNdviOrtalama: number | null
  sonNdviTarihi: string | null
}

export interface GardenInput {
  ad: string
  urun: Urun
  cesit: string | null
  cesitKodu?: string | null
  dikimYili: number | null
  agacSayisi?: number | null
  geometry: GardenGeometry
  il: string | null
  ilce: string | null
}

export type GardenPatch = Partial<GardenInput>
