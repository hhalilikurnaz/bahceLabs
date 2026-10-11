import { useLocation } from 'react-router-dom'
import { ARCHIVE_SEGMENT, isGardenTab, type GardenTab, type Section } from '../lib/routes'

export interface BahcemRoute {
  section: Section
  gardenId: string | null
  /** Geçersiz/yok ise 'durum' */
  tab: GardenTab
  /** Görüntü arşivi sayfası açık mı (`/bahcem/:id/arsiv`) */
  archive: boolean
  /** URL'deki ham sekme (geçersizse yönlendirme için) */
  rawTab: string | undefined
}

const OTHER_SECTIONS = ['pazar', 'bildirimler', 'ayarlar'] as const

/** `/bahcem/[bölüm | :id/:sekme]` yolunu çözer (saf fonksiyon; testlenir). */
export function parseBahcemPath(pathname: string): BahcemRoute {
  const [, first, second] = pathname.split('/').filter(Boolean)
  const other = OTHER_SECTIONS.find((section) => section === first)
  if (other) return { section: other, gardenId: null, tab: 'durum', archive: false, rawTab: undefined }
  return {
    section: 'bahceler',
    gardenId: first ?? null,
    tab: isGardenTab(second) ? second : 'durum',
    archive: second === ARCHIVE_SEGMENT,
    rawTab: second,
  }
}

/** URL'den bölüm, bahçe ve sekmeyi okur (rota tek doğruluk kaynağıdır). */
export function useBahcemRoute(): BahcemRoute {
  return parseBahcemPath(useLocation().pathname)
}
