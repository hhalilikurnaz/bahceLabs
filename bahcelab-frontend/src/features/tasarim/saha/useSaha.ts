import { useMemo } from 'react'
import type { Scene } from '../../bahcem/api/indeksApi'
import { useWeatherHistory } from '../../bahcem/api/weatherApi'
import { shiftDays, todayIstanbul } from '../../bahcem/lib/dates'
import type { IndexId } from '../../bahcem/lib/indices'
import type { Proto } from '../data'
import { finite, sharedDomain, useSceneGrids, useYearGrids, type PGrid } from './grids'

/** Son 12 ayın her ayı için o aya en yakın (ay ortası) net sahne. */
export function monthlyScenes(scenes: Scene[], today: string): Scene[] {
  const out: Scene[] = []
  for (let k = 11; k >= 0; k--) {
    const mid = shiftDays(today, -k * 30 - 15)
    const best = [...scenes].filter((s) => s.tarih >= shiftDays(mid, -15) && s.tarih <= shiftDays(mid, 15)).sort((a, b) => Math.abs(Date.parse(a.tarih) - Date.parse(mid)) - Math.abs(Date.parse(b.tarih) - Date.parse(mid)))[0]
    if (best && !out.includes(best)) out.push(best)
  }
  return out
}

/** Önizleme için tüm ek gerçek veri: aylık ızgaralar, yıl ızgaraları, 12 aylık günlük hava geçmişi, paylaşılan skala. */
export function useSaha(d: Proto) {
  const today = todayIstanbul()
  const months = useMemo(() => monthlyScenes(d.scenes, today), [d.scenes, today])
  const monthGrids = useSceneGrids(d.id, months, 'ndvi')
  const idxScenes = useMemo(() => (d.latest ? [d.latest] : []), [d.latest])
  const layerGrids: Record<IndexId, PGrid | undefined> = {
    ndvi: useSceneGrids(d.id, idxScenes, 'ndvi').get(d.latest?.tarih ?? ''),
    msavi: useSceneGrids(d.id, idxScenes, 'msavi').get(d.latest?.tarih ?? ''),
    ndre: useSceneGrids(d.id, idxScenes, 'ndre').get(d.latest?.tarih ?? ''),
    ndmi: useSceneGrids(d.id, idxScenes, 'ndmi').get(d.latest?.tarih ?? ''),
    cigreen: useSceneGrids(d.id, idxScenes, 'cigreen').get(d.latest?.tarih ?? ''),
  }
  const years = (d.multi?.yillar ?? []).filter((y) => y.sahne_sayisi >= 3).map((y) => y.yil)
  const yearGrids = useYearGrids(d.id, years)
  const history = useWeatherHistory(d.id, shiftDays(today, -364), shiftDays(today, -1), d.id !== null)
  const latestGrid = layerGrids.ndvi
  const domain = useMemo<[number, number]>(() => sharedDomain([...(latestGrid ? [latestGrid] : []), ...monthGrids.values()]), [latestGrid, monthGrids])
  const yearDomain = useMemo<[number, number]>(() => sharedDomain([...yearGrids.values()]), [yearGrids])
  const latestValues = latestGrid ? finite(latestGrid) : []
  const weakCut = latestValues.length ? [...latestValues].sort((a, b) => a - b)[Math.floor(latestValues.length * 0.15)] : null
  return { today, months, monthGrids, layerGrids, latestGrid, yearGrids, years, history: history.data ?? [], domain, yearDomain, weakCut }
}
export type Saha = ReturnType<typeof useSaha>
