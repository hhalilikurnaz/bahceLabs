/** Backend `domain/notifications/schemas.py` yanıt biçimleri. */

export type ApiNotificationPriority = 'kritik' | 'onemli' | 'bilgi'

/** Günlük özet kartının kapsadığı madde (önem, başlık, metin, bağlantı, tür). */
export interface ApiDigestItem {
  onem: ApiNotificationPriority
  baslik: string
  metin: string
  baglanti: string
  tur: string
}

export interface ApiNotification {
  id: string
  bahce_id: string | null
  tur: string
  tur_adi: string
  oncelik: ApiNotificationPriority
  baslik: string
  metin: string
  baglanti: string
  okundu: boolean
  durum: 'olustu' | 'goruldu' | 'cozuldu' | 'ertelendi'
  ertelendi_bitis: string | null
  olusturma: string
  ogeler?: ApiDigestItem[]
}

export interface ApiNotificationList {
  sayfa: number
  boyut: number
  toplam: number
  sayfa_sayisi: number
  okunmamis_sayisi: number
  ogeler: ApiNotification[]
}

export interface ApiPreference {
  tur: string
  ad: string
  aciklama: string
  acik: boolean
}
