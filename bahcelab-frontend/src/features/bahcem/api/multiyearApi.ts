import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '@/lib/apiClient'

export interface MultiyearYear {
  yil: number
  sahne_sayisi: number
  kismi: boolean
  kapsam: number | null
  korelasyon: number | null
  uyumsuz: boolean
  uyumsuz_nedeni: string | null
  dahil: boolean
  elle: boolean | null
}
export interface MultiyearZone {
  sinif: number
  ad: string
  alan_m2: number
  alan_dekar: number
  pay: number
  fark_yuzde: number | null
  istikrar: number | null
  istikrar_sinifi: 'yuksek' | 'orta' | 'dusuk' | null
  kontrol_onerisi: boolean
}
export interface MultiyearResult {
  durum: 'hazir' | 'islem_suruyor' | 'yetersiz' | 'yok'
  mesaj: string | null
  bolge_sayisi: number
  versiyon: number | null
  hesaplama: string | null
  yil_araligi: string | null
  yillar: MultiyearYear[]
  bolgeler: { type: 'FeatureCollection'; features: { type: 'Feature'; geometry: GeoJSON.Geometry; properties: MultiyearZone }[] } | null
  ozet: MultiyearZone[]
  homojen: boolean
  yayilim_yuzde: number | null
  yorumlar: string[]
  not_: string
}

export const multiyearKey = (gardenId: string | null) => ['cok-yillik', gardenId] as const

/** Çok yıllık ağaç gücü bölgeleri (3 bölge). Analiz yoksa durum «yok». */
export function useMultiyear(gardenId: string | null) {
  return useQuery({
    queryKey: multiyearKey(gardenId),
    queryFn: () => apiRequest<MultiyearResult>(`/gardens/${gardenId}/bolgeler/cok-yillik/sonuc`),
    enabled: gardenId !== null,
    staleTime: 60_000,
  })
}
