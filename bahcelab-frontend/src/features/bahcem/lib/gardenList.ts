import type { GardenOverview, GardenStatus } from '../api/overviewApi'

export type SortKey = 'durum' | 'ad' | 'alan'
export type StatusFilter = 'hepsi' | GardenStatus

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'durum', label: 'Duruma göre' },
  { value: 'ad', label: 'Ada göre' },
  { value: 'alan', label: 'Alana göre (büyükten küçüğe)' },
]

/** Dikkat gerektirenler en üstte */
const STATUS_RANK: Record<GardenStatus, number> = { dikkat: 0, izle: 1, veri_yok: 2, iyi: 3 }

const byName = (a: GardenOverview, b: GardenOverview): number => a.ad.localeCompare(b.ad, 'tr')

export function sortGardens(items: readonly GardenOverview[], key: SortKey): GardenOverview[] {
  const copy = [...items]
  if (key === 'ad') return copy.sort(byName)
  if (key === 'alan') return copy.sort((a, b) => b.dekar - a.dekar || byName(a, b))
  return copy.sort((a, b) => STATUS_RANK[a.durum] - STATUS_RANK[b.durum] || byName(a, b))
}

/** Durum filtresi ve ad araması (Türkçe büyük/küçük harf duyarsız). */
export function filterGardens(items: readonly GardenOverview[], status: StatusFilter, query: string): GardenOverview[] {
  const q = query.trim().toLocaleLowerCase('tr-TR')
  return items.filter(
    (g) => (status === 'hepsi' || g.durum === status) && (q === '' || g.ad.toLocaleLowerCase('tr-TR').includes(q)),
  )
}

export function countByStatus(items: readonly GardenOverview[]): Record<StatusFilter, number> {
  const counts: Record<StatusFilter, number> = { hepsi: items.length, iyi: 0, izle: 0, dikkat: 0, veri_yok: 0 }
  for (const g of items) counts[g.durum] += 1
  return counts
}
