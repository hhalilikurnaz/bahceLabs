import { CircleAlert, CircleCheck, Eye, Hourglass, type LucideIcon } from 'lucide-react'
import type { GardenStatus } from '../api/overviewApi'

export interface StatusMeta {
  label: string
  /** ui/Badge tonu */
  tone: 'success' | 'warn' | 'danger' | 'neutral'
  Icon: LucideIcon
  /** Haritada kenar rengi için token (surface-dark değeri okunur) */
  mapColorVar: string
  /** Kısa çiftçi açıklaması */
  hint: string
}

/** Durum etiketi: renk + simge + metin (renk tek başına anlam taşımaz). */
export const STATUS_META: Record<GardenStatus, StatusMeta> = {
  iyi: { label: 'İyi', tone: 'success', Icon: CircleCheck, mapColorVar: '--color-app-success', hint: 'Şu an dikkat gerektiren bir uyarı yok.' },
  izle: { label: 'İzle', tone: 'warn', Icon: Eye, mapColorVar: '--color-app-warn', hint: 'Takip edilmesi gereken bir değişim var.' },
  dikkat: { label: 'Dikkat', tone: 'danger', Icon: CircleAlert, mapColorVar: '--color-app-danger', hint: 'Öncelikli bir uyarı var; bahçeyi kontrol edin.' },
  veri_yok: { label: 'Veri yok', tone: 'neutral', Icon: Hourglass, mapColorVar: '--color-app-text-dim', hint: 'Henüz kullanılabilir uydu görüntüsü yok.' },
}
