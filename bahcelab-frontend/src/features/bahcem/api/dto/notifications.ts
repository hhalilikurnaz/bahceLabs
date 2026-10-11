/** Backend `domain/notifications/schemas.py` yanıt biçimleri. */

export type ApiNotificationPriority = 'kritik' | 'uyari' | 'bilgi'

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
  olusturma: string
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
