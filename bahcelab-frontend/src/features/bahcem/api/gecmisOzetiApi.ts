import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '@/lib/apiClient'
import type { SeviyeKodu } from '../lib/kademe'

/** Geçmiş sayfası yıl özeti (9G): sayı yok, kademe dili; hasat yalnız Saha Defteri kaydından, yoksa «kayıt yok». */
export interface YilSatiri {
  yil: number
  canlilik: SeviyeKodu | null
  canlilik_nedeni: string | null
  olay_sayisi: number
  olaylar: { tur_adi: string; sayi: number }[]
  uyumsuz: boolean | null
  uyumsuz_nedeni: string | null
  hasat: { durum: 'kayit_yok' | 'kayit'; adet: number; son_tarih: string | null }
}
export interface GecmisOzeti {
  ilk_yil: number | null
  son_yil: number
  yillar: YilSatiri[]
  yesillenme: { yil: number; tarih: string; etiket: string; gozlem_sayisi: number }[]
  esik_durumu: string
  not_: string
}

export function useGecmisOzeti(gardenId: string | null) {
  return useQuery({
    queryKey: ['gecmis-ozeti', gardenId],
    queryFn: () => apiRequest<GecmisOzeti>(`/gardens/${gardenId}/gecmis-ozeti`),
    enabled: gardenId !== null,
    staleTime: 60_000,
  })
}
