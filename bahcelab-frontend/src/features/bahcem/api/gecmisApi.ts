import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '@/lib/apiClient'

/** Geçmiş doldurma ilerlemesi (ADR 0015): «Geçmiş çekiliyor · %40». */
export interface GecmisDoldurma {
  durum: 'yok' | 'isleniyor' | 'tamam' | 'hata'
  toplam_ay: number
  tamamlanan_ay: number
  hata_ay: number
  yuzde: number
  net_sahne: number
  depolanan_sahne: number
  depolama_bayt: number
}

export const gecmisKey = (gardenId: string | null) => ['gecmis-doldurma', gardenId] as const

export function useGecmisDoldurma(gardenId: string | null) {
  return useQuery({
    queryKey: gecmisKey(gardenId),
    queryFn: () => apiRequest<GecmisDoldurma>(`/gardens/${gardenId}/gecmis-doldurma`),
    enabled: gardenId !== null,
    // Çekim sürerken 5 sn'de bir yoklanır; bitince durur
    refetchInterval: (q) => (q.state.data?.durum === 'isleniyor' ? 5000 : false),
  })
}

export function useGecmisBaslat(gardenId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () => apiRequest<GecmisDoldurma>(`/gardens/${gardenId}/gecmis-doldurma`, { method: 'POST' }),
    onSuccess: (data) => client.setQueryData(gecmisKey(gardenId), data),
  })
}
