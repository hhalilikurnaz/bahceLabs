import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '@/lib/apiClient'
import { agroApi, useGardenStatus, useIrrigation, usePhenology, useRisks, useSeries, useToday } from '../bahcem/api/agroApi'
import { useGrid, useIndices, useZones, type Scene } from '../bahcem/api/indeksApi'
import { useGardensOverview } from '../bahcem/api/overviewApi'
import { useGardens } from '../bahcem/api/useGardens'
import { useWeather } from '../bahcem/api/weatherApi'
import { seasonStartYear } from '../bahcem/lib/seasonAxis'
import { todayIstanbul } from '../bahcem/lib/dates'

export interface MultiyearYear {
  yil: number
  sahne_sayisi: number
  kismi: boolean
  kapsam: number | null
  korelasyon: number | null
  uyumsuz: boolean
  uyumsuz_nedeni: string | null
  dahil: boolean
}
export interface MultiyearZone {
  sinif: number
  ad: string
  alan_dekar: number
  pay: number
  fark_yuzde: number | null
  istikrar: number | null
  istikrar_sinifi: 'yuksek' | 'orta' | 'dusuk' | null
  kontrol_onerisi: boolean
}
export interface MultiyearResult {
  durum: string
  bolge_sayisi: number
  yil_araligi: string | null
  yillar: MultiyearYear[]
  bolgeler: { features: { geometry: GeoJSON.Geometry; properties: MultiyearZone }[] } | null
  ozet: MultiyearZone[]
  homojen: boolean
  yayilim_yuzde: number | null
  yorumlar: string[]
}

/** Önizleme için gerçek bahçenin tüm verisi (mevcut API'ler); sahte veri yoktur. Bahçe: ?bahce=<id> ya da listedeki ilk. */
export function useProto(requested: string | null) {
  const gardens = useGardens()
  const overview = useGardensOverview()
  const garden = gardens.data?.find((g) => g.id === requested) ?? gardens.data?.[0] ?? null
  const id = garden?.id ?? null
  const indices = useIndices(id)
  const scenes = (indices.data?.gozlemler ?? []).filter((s) => s.durum === 'tamam').sort((a, b) => a.tarih.localeCompare(b.tarih))
  const latest: Scene | null = scenes[scenes.length - 1] ?? null
  const status = useGardenStatus(id)
  const today = useToday(id)
  const weather = useWeather(id)
  const irrigation = useIrrigation(id)
  const risks = useRisks(id)
  const season = seasonStartYear(todayIstanbul())
  const series = useSeries(id, season)
  const phenology = usePhenology(id)
  const prevSeries = useSeries(id, season - 1)
  const prevPhenology = useQuery({ queryKey: ['proto-phen', id, season - 1], queryFn: () => agroApi.phenology(id as string, season - 1), enabled: id !== null, staleTime: 5 * 60_000 })
  const grid = useGrid(id, latest, 'ndvi')
  const zones = useZones(id, 'ndvi', latest?.tarih ?? null)
  const multi = useQuery({
    queryKey: ['proto-multi', id],
    queryFn: () => apiRequest<MultiyearResult>(`/gardens/${id}/bolgeler/cok-yillik/sonuc`),
    enabled: id !== null,
    staleTime: 60_000,
  })
  const summary = overview.data?.bahceler.find((g) => g.id === id) ?? null
  return { gardens: gardens.data ?? [], overview: overview.data, garden, id, scenes, latest, status: status.data, today: today.data, weather: weather.data, irrigation: irrigation.data, risks: risks.data, series: series.data, prevSeries: prevSeries.data, phenology: phenology.data, prevPhenology: prevPhenology.data, grid: grid.data, zones: zones.data, multi: multi.data, summary, season, ready: Boolean(garden && latest && status.data && weather.data) }
}
export type Proto = ReturnType<typeof useProto>
