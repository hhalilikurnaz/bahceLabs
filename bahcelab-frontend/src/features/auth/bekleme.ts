import { apiRequest } from '@/lib/apiClient'

export const BEKLEME_URUNLERI = [
  { deger: 'limon', etiket: 'Limon' },
  { deger: 'portakal', etiket: 'Portakal' },
  { deger: 'mandalina', etiket: 'Mandalina' },
  { deger: 'diger', etiket: 'Diğer' },
] as const
export type BeklemeUrun = (typeof BEKLEME_URUNLERI)[number]['deger']

/** Narenciye yetiştirilen başlıca iller (yalnız öneri; il alanına başka bir ad da yazılabilir). */
export const IL_ONERILERI = ['Adana', 'Antalya', 'Aydın', 'Hatay', 'İzmir', 'Mersin', 'Muğla', 'Osmaniye'] as const

/** Aydınlatma metni sürümü: sunucudaki AYDINLATMA_SURUMU ile aynı olmalı (bahcelab-backend/.../domain/bekleme/schemas.py); metin değişince ikisi birlikte artar. */
export const AYDINLATMA_SURUMU = '2026-11'

export interface BeklemeBasvurusu {
  email: string
  il: string
  urun: BeklemeUrun
  riza: boolean
}

/** Erken erişim listesine başvuru. Sunucu yeni ve yinelenen e-postaya aynı yanıtı verir. */
export function beklemeListesineKatil(basvuru: BeklemeBasvurusu): Promise<{ kayit: 'alindi' }> {
  return apiRequest('/bekleme-listesi', { method: 'POST', body: JSON.stringify(basvuru) })
}
