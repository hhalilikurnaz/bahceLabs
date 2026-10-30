/** Rotalar (Adım 9B, hibrit kabuk): `/bahceler/:id[/sekme]`, tam sayfa `/bahceler/:id/gecmis|defter`; eski `/bahcem/...` yönlenir. */
export const GARDEN_TABS = ['durum', 'analiz', 'su', 'hava', 'gunluk', 'rapor'] as const
export type GardenTab = (typeof GARDEN_TABS)[number]

export const GARDEN_TAB_LABELS: Record<GardenTab, string> = {
  durum: 'Durum',
  analiz: 'Analiz',
  su: 'Su',
  hava: 'Hava',
  gunluk: 'Günlük',
  rapor: 'Rapor',
}

/** Bahçeye bağlı tam sayfalar (çalışma alanı dışında) */
export const GARDEN_PAGES = ['gecmis', 'defter'] as const
export type GardenPage = (typeof GARDEN_PAGES)[number]

/** Üst gezinme */
export const NAV_ITEMS = [
  { key: 'bahceler', label: 'Bahçeler', path: '/bahceler', soon: null },
  { key: 'asistan', label: 'Asistan', path: '/asistan', soon: null },
  { key: 'islerim', label: 'İşlerim', path: '/islerim', soon: 'yakında' },
  { key: 'hizmetler', label: 'Hizmetler', path: '/hizmetler', soon: 'yakında' },
  { key: 'pazar', label: 'Pazar', path: '/pazar', soon: 'yakında' },
] as const
export type NavKey = (typeof NAV_ITEMS)[number]['key']

export const isGardenTab = (value: string | undefined): value is GardenTab => (GARDEN_TABS as readonly string[]).includes(value ?? '')
export const isGardenPage = (value: string | undefined): value is GardenPage => (GARDEN_PAGES as readonly string[]).includes(value ?? '')

export const gardenPath = (id: string, tab: GardenTab = 'durum'): string => (tab === 'durum' ? `/bahceler/${id}` : `/bahceler/${id}/${tab}`)
/** Sulama modu: Su sekmesinde panel «Sulama»ya geçer (ayrı sayfa yok). */
export const sulamaPath = (id: string): string => `/bahceler/${id}/su/sulama`
export const gardenPagePath = (id: string, page: GardenPage): string => `/bahceler/${id}/${page}`
export const NEW_GARDEN_PATH = '/bahceler/yeni'
export const SETTINGS_PATH = '/ayarlar'

/** Eski `/bahcem/...` adresini yeni karşılığına çevirir (yer imleri ve bildirim bağlantıları kırılmasın). */
export function legacyRedirect(pathname: string, search = ''): string {
  const parts = pathname.split('/').filter(Boolean) // ['bahcem', ...]
  const [, first, second] = parts
  if (!first) return '/bahceler'
  if (['islerim', 'hizmetler', 'pazar'].includes(first)) return `/${first}`
  if (first === 'ayarlar') return SETTINGS_PATH
  if (first === 'bildirimler') return '/bahceler?bildirimler=1'
  if (second === 'arsiv') return gardenPagePath(first, 'gecmis') + search
  return gardenPath(first, isGardenTab(second) ? second : 'durum')
}
