import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '@/lib/apiClient'

/** Kesintisiz günlük canlılık (NDVI) eğrisi (ADR 0018): gözlemler (Sentinel-2 + HLS), yumuşatılmış eğri, belirsizlik bandı, boşluklarda radar değişim işareti. */
export interface EgriNoktasi {
  tarih: string
  deger: number
  alt: number
  ust: number
  /** gözlemden uzak: kesikli çizgi + soluk bant + «tahmini» etiketi */
  tahmini: boolean
}
export interface EgriGozlemi {
  tarih: string
  deger: number
  kaynak: 's2' | 'hls'
  agirlik: number
}
export interface RadarIsareti {
  tarih: string
  degisim: boolean
}
export interface CanlilikEgrisi {
  baslangic: string
  bitis: string
  noktalar: EgriNoktasi[]
  gozlemler: EgriGozlemi[]
  radar_isaretleri: RadarIsareti[]
  yeterli: boolean
  kaynaklar: string
  yontem: string
  kademe_notu: string
}

export function useCanlilikEgrisi(gardenId: string | null, gun = 730) {
  return useQuery({
    queryKey: ['egri', gardenId, gun],
    queryFn: () => apiRequest<CanlilikEgrisi>(`/gardens/${gardenId}/canlilik-egrisi?gun=${gun}`),
    enabled: gardenId !== null,
    staleTime: 5 * 60_000,
  })
}
