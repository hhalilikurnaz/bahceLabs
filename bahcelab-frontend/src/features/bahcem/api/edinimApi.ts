import { useQuery } from '@tanstack/react-query'
import { apiRequest, apiRequestRaw } from '@/lib/apiClient'
import { parseGrid, type Corners, type Grid } from '../lib/render'

/** Gösterge kimlikleri (ADR 0015): LAI yalnız edinimlerde (SNAP biyofizik port'u, deneysel). */
export const GOSTERGELER = ['ndvi', 'ndmi', 'ndre', 'msavi', 'lai'] as const
export type GostergeId = (typeof GOSTERGELER)[number]

export interface GostergeIstatistik {
  ortalama: number
  medyan: number
  p10: number
  p25: number
  p75: number
  p90: number
  gecerli_piksel: number
}

export interface Edinim {
  tarih: string
  scene_id: string
  bulut_orani: number | null
  gecerli_oran: number | null
  isleme_surumu: string | null
  formul_surumu: string | null
  gostergeler: Partial<Record<GostergeId, GostergeIstatistik>>
}

export interface Edinimler {
  izgara: { satir: number; sutun: number; koordinatlar: number[][] } | null
  net_sayisi: number
  bulutlu_sayisi: number
  edinimler: Edinim[]
}

export const edinimKey = (gardenId: string | null) => ['edinimler', gardenId] as const

/** Net edinimler (tek veri hattı): harita tarihleri, sezon eğrisi ve çubuklar bunu kullanır. */
export function useEdinimler(gardenId: string | null) {
  return useQuery({
    queryKey: edinimKey(gardenId),
    queryFn: () => apiRequest<Edinimler>(`/gardens/${gardenId}/edinimler`),
    enabled: gardenId !== null,
    staleTime: 60_000,
  })
}

/** Bir edinimin gösterge ızgarası (bahçenin ortak 10 m ızgarası). Tarih başına bir kez indirilir ve önbelleklenir. */
export function useEdinimIzgara(gardenId: string | null, tarih: string | null, gosterge: GostergeId | null, izgara: Edinimler['izgara'] | undefined) {
  const ready = Boolean(gardenId && tarih && gosterge && izgara)
  return useQuery({
    queryKey: ['edinim-izgara', gardenId, tarih, gosterge],
    queryFn: async (): Promise<Grid> => {
      const response = await apiRequestRaw(`/gardens/${gardenId}/edinimler/${tarih}/${gosterge}/izgara`)
      return parseGrid(await response.arrayBuffer(), izgara!.satir, izgara!.sutun, izgara!.koordinatlar as unknown as Corners)
    },
    enabled: ready,
    staleTime: Infinity,
    gcTime: 30 * 60_000,
  })
}
