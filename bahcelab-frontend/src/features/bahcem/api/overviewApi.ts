import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '@/lib/apiClient'
import type { Kademe } from '../lib/kademe'

/** Bahçeler listesi için bahçe başına kademe (`/gardens/overview`); sayısal skor yoktur. */
export type ListeKademesi = Kademe | 'veri_yok'

interface ApiOverview {
  bahceler: { id: string; durum: ListeKademesi }[]
}

export function useGardenTiers() {
  return useQuery({
    queryKey: ['gardens', 'kademeler'],
    queryFn: async () => new Map((await apiRequest<ApiOverview>('/gardens/overview')).bahceler.map((g) => [g.id, g.durum] as const)),
    staleTime: 60_000,
  })
}
