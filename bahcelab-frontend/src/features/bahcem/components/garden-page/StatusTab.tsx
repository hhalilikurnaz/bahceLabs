import { SlidersHorizontal } from 'lucide-react'
import { Card, SelectField, Skeleton } from '@/components/ui'
import { describeError } from '../../api/gardensApi'
import { useRefreshIndices } from '../../api/indeksApi'
import { useWeather, useWeatherHistory } from '../../api/weatherApi'
import { useIndexView } from '../../hooks/useIndexView'
import { shiftDays, todayIstanbul } from '../../lib/dates'
import { isIndexId, type IndexId } from '../../lib/indices'
import { useBahcemStore } from '../../stores/bahcemStore'
import { WeatherAlertsCard } from '../hava/WeatherAlertsCard'
import { AlertsCard } from '../indeks/AlertsCard'
import { IndexChart } from '../indeks/IndexChart'
import { StatusCard } from '../indeks/StatusCard'
import { ViewPanel } from '../indeks/ViewPanel'
import { useState } from 'react'
import { LatestValueCard } from './LatestValueCard'
import { ParameterPicker } from './ParameterPicker'

const THIS_YEAR = new Date().getFullYear()
const SEASONS = [THIS_YEAR, THIS_YEAR - 1, THIS_YEAR - 2]

/** Durum sekmesi: seçili parametrenin en güncel değeri, zaman grafiği, uyarılar ve uydu verisi durumu. */
export function StatusTab({ gardenId }: { gardenId: string }) {
  const { data, scenes, isLoading, active, katman } = useIndexView()
  const season = useBahcemStore((s) => s.season)
  const grafik = useBahcemStore((s) => s.grafikIndeksleri)
  const toggleGrafik = useBahcemStore((s) => s.toggleGrafikIndeksi)
  const setSelectedDate = useBahcemStore((s) => s.setSelectedDate)
  const setSeason = useBahcemStore((s) => s.setSeason)
  const setKatman = useBahcemStore((s) => s.setKatman)
  const havaKatmani = useBahcemStore((s) => s.havaKatmani)
  const setHavaKatmani = useBahcemStore((s) => s.setHavaKatmani)
  const refresh = useRefreshIndices(gardenId)
  const weather = useWeather(gardenId)
  const [refreshError, setRefreshError] = useState<string | null>(null)

  const yesterday = shiftDays(todayIstanbul(), -1)
  const yearEnd = `${season}-12-31`
  const weatherHistory = useWeatherHistory(gardenId, `${season}-01-01`, yearEnd < yesterday ? yearEnd : yesterday, havaKatmani)

  const indexLayer: IndexId = isIndexId(katman) ? katman : 'ndvi'
  const processing = data?.isleme?.durum === 'bekliyor' || data?.isleme?.durum === 'isleniyor'
  const hasImages = scenes?.some((s) => s.durum === 'tamam') ?? false

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-1 gap-3 @2xl:grid-cols-2" aria-label="Uydu verisi yükleniyor" aria-busy>
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
        <Skeleton className="h-64 @2xl:col-span-2" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <AlertsCard alerts={data.uyarilar} />
      <WeatherAlertsCard alerts={weather.data?.uyarilar ?? []} quiet />

      <div className="grid grid-cols-1 gap-3 @2xl:grid-cols-2 @2xl:items-start">
        <LatestValueCard indeks={indexLayer} scenes={scenes} loading={false} processing={processing} />
        <Card aria-label="Parametre seçimi" className="space-y-2">
          <h3 className="text-body font-semibold text-app-text">Haritada gösterilen</h3>
          <ParameterPicker value={indexLayer} onChange={setKatman} />
        </Card>
      </div>

      {hasImages && (
        <Card aria-label="Zaman grafiği" data-testid="time-chart">
          <SelectField
            label="Sezon"
            value={season}
            onChange={(event) => setSeason(Number(event.target.value))}
            className="mb-3 w-40"
          >
            {SEASONS.map((year) => (
              <option key={year} value={year}>
                {year} sezonu
              </option>
            ))}
          </SelectField>
          <IndexChart
            scenes={data.gozlemler}
            season={season}
            active={grafik}
            activeDate={active?.tarih ?? null}
            onToggle={toggleGrafik}
            onSelect={setSelectedDate}
            weather={havaKatmani ? (weatherHistory.data ?? []) : null}
            weatherLoading={weatherHistory.isLoading}
            onWeatherToggle={() => setHavaKatmani(!havaKatmani)}
          />
        </Card>
      )}

      <StatusCard
        data={data}
        refreshing={refresh.isPending}
        onRefresh={() => {
          setRefreshError(null)
          refresh.mutate(undefined, { onError: (err) => setRefreshError(describeError(err)) })
        }}
        refreshError={refreshError}
      />

      {hasImages && (
        <details className="group rounded-md border border-app-border bg-app-card">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-4 text-body font-semibold text-app-text marker:hidden">
            <SlidersHorizontal className="h-4 w-4 text-app-text-muted" aria-hidden />
            Harita ayarları
            <span className="ml-auto text-small font-normal text-app-text-dim group-open:hidden">göster</span>
          </summary>
          <div className="border-t border-app-border p-4">
            <ViewPanel />
          </div>
        </details>
      )}
    </div>
  )
}
