import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { gardensApi } from './gardensApi'
import type { GardenInput, GardenPatch } from './types'

export const GARDENS_KEY = ['gardens'] as const

export function useGardens() {
  return useQuery({ queryKey: GARDENS_KEY, queryFn: gardensApi.list })
}

export function useCreateGarden() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: GardenInput) => gardensApi.create(input),
    onSuccess: () => client.invalidateQueries({ queryKey: GARDENS_KEY }),
  })
}

export function useUpdateGarden() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: GardenPatch }) => gardensApi.update(id, patch),
    onSuccess: () => {
      // Sınır değişirse hava konumu (merkez nokta) da değişir
      void client.invalidateQueries({ queryKey: ['weather'] })
      return client.invalidateQueries({ queryKey: GARDENS_KEY })
    },
  })
}

export function useDeleteGarden() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => gardensApi.remove(id),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['weather'] })
      return client.invalidateQueries({ queryKey: GARDENS_KEY })
    },
  })
}
