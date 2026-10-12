import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
  /** Uyumsuz ve kullanıcı henüz karar vermedi */
  karar_bekliyor: boolean
  /** Karar verilmezse analizde olur mu (son iki yıl: evet) */
  varsayilan_dahil: boolean
  karar_zamani: string | null
  karar_notu: string | null
  /** Net sahne/dönem kapsamı eşiğin altında: kompozitte görünür, analize girmez */
  yetersiz_veri: boolean
  yetersiz_nedeni: string | null
  net_gun_sayisi: number | null
  donem_kapsami: number | null
  aday_sayisi: number
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

/** Yıl dahil/hariç kararı (`dahil: null` = geri al, otomatiğe dön). Sonuç yeniden hesaplanır. */
export function useYearDecision(gardenId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (choice: { yil: number; dahil: boolean | null; olay_notu?: string }) =>
      apiRequest<MultiyearResult>(`/gardens/${gardenId}/bolgeler/cok-yillik/yillar`, { method: 'PATCH', body: JSON.stringify({ yillar: [choice], bolge_sayisi: 3 }) }),
    onSuccess: (result) => client.setQueryData(multiyearKey(gardenId), result),
  })
}

export function useStartMultiyear(gardenId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () => apiRequest(`/gardens/${gardenId}/bolgeler/cok-yillik`, { method: 'POST', body: JSON.stringify({ bolge_sayisi: 3 }) }),
    onSuccess: () => client.invalidateQueries({ queryKey: multiyearKey(gardenId) }),
  })
}
