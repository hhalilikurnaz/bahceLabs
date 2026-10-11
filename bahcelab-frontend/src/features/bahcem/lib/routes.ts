/** Bahçe sayfası sekmeleri ve rotaları (docs/design/BILGI-MIMARISI.md) */
export const GARDEN_TABS = ['durum', 'analiz', 'hava', 'gunluk', 'rapor'] as const
export type GardenTab = (typeof GARDEN_TABS)[number]

export const GARDEN_TAB_LABELS: Record<GardenTab, string> = {
  durum: 'Durum',
  analiz: 'Analiz',
  hava: 'Hava',
  gunluk: 'Günlük',
  rapor: 'Rapor',
}

/** Sol menü bölümleri */
export const SECTIONS = ['bahceler', 'pazar', 'bildirimler', 'ayarlar'] as const
export type Section = (typeof SECTIONS)[number]

export const SECTION_PATHS: Record<Section, string> = {
  bahceler: '/bahcem',
  pazar: '/bahcem/pazar',
  bildirimler: '/bahcem/bildirimler',
  ayarlar: '/bahcem/ayarlar',
}

export const isGardenTab = (value: string | undefined): value is GardenTab =>
  (GARDEN_TABS as readonly string[]).includes(value ?? '')

export const gardenPath = (id: string, tab: GardenTab = 'durum'): string => `/bahcem/${id}/${tab}`

/** Görüntü arşivi: `/bahcem/:id/arsiv?parametre=ndvi&tarih=YYYY-MM-DD` */
export const ARCHIVE_SEGMENT = 'arsiv'
