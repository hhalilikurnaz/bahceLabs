import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { OVERVIEW_KEY, type GardenOverview } from '../api/overviewApi'
import { weatherApi } from '../api/weatherApi'

/**
 * Liste hava bilgisini önbellekten okur. Önbellek yoksa veya bayatsa tek seferlik arka plan isteği
 * (`/weather/ozet`) önbelleği tazeler, sonra liste yeniden okunur. Ağ yoksa sessizce önbellekte kalınır.
 */
export function useWeatherWarmup(gardens: GardenOverview[] | undefined): void {
  const client = useQueryClient()
  const attempted = useRef(false)
  const needsRefresh = gardens?.some((g) => g.hava === null || g.hava.bayat) ?? false

  useEffect(() => {
    if (!needsRefresh || attempted.current) return
    attempted.current = true
    void weatherApi
      .overview()
      .then(() => client.invalidateQueries({ queryKey: OVERVIEW_KEY }))
      .catch(() => undefined) // hava isteğe bağlıdır; liste önbellekle çalışmaya devam eder
  }, [needsRefresh, client])
}
