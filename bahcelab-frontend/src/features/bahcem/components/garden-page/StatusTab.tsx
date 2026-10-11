import { Cloud } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Chip, SelectField, Skeleton } from '@/components/ui'
import { describeError } from '../../api/gardensApi'
import { useRefreshIndices } from '../../api/indeksApi'
import type { Garden } from '../../api/types'
import { useWeather, useWeatherHistory } from '../../api/weatherApi'
import { useIndexView } from '../../hooks/useIndexView'
import { archivePath } from '../../lib/archive'
import { shiftDays, todayIstanbul } from '../../lib/dates'
import { isIndexId, type IndexId } from '../../lib/indices'
import { useBahcemStore } from '../../stores/bahcemStore'
import { WeatherAlertsCard } from '../hava/WeatherAlertsCard'
import { AlertsCard } from '../indeks/AlertsCard'
import { StatusCard } from '../indeks/StatusCard'
import { TimeChart } from '../indeks/TimeChart'
import { ComingSoonList } from './ComingSoonList'
import { STATUS_ITEMS } from './comingSoonItems'
import { LatestValueCard } from './LatestValueCard'
import { ParameterPicker } from './ParameterPicker'
import { ReservedSlots } from './ReservedSlots'
import { ProductCard, TodayWeatherCard } from './SummaryCards'

const THIS_YEAR = new Date().getFullYear()
const SEASONS = [THIS_YEAR, THIS_YEAR - 1, THIS_YEAR - 2]

/** Durum sekmesi: üç özet kart, tek parametre seçici, zaman grafiği, uyarılar ve uydu verisi durumu. */
export function StatusTab({ garden }: { garden: Garden }) {
  const gardenId = garden.id
  const navigate = useNavigate()
  const { data, scenes, isLoading, active, katman } = useIndexView()
  const season = useBahcemStore((s) => s.season)
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
      <div className="space-y-3" aria-label="Uydu verisi yükleniyor" aria-busy>
        <div className="grid grid-cols-1 gap-2 @md:grid-cols-3">
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
        </div>
        <Skeleton className="h-72" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <ReservedSlots />
      <div className="grid grid-cols-1 gap-2 @md:grid-cols-3" data-testid="summary-cards">
        <LatestValueCard indeks={indexLayer} scenes={scenes} loading={false} processing={processing} alerts={data.uyarilar} />
        <ProductCard garden={garden} />
        <TodayWeatherCard gardenId={gardenId} />
      </div>

      {hasImages && (
        <Card aria-label="Zaman grafiği" data-testid="time-chart" className="space-y-3">
          <ParameterPicker value={indexLayer} onChange={setKatman} />
          <div className="flex flex-wrap items-end justify-between gap-2">
            <SelectField label="Sezon" value={season} onChange={(event) => setSeason(Number(event.target.value))} className="w-40">
              {SEASONS.map((year) => (
                <option key={year} value={year}>
                  {year} sezonu
                </option>
              ))}
            </SelectField>
            <Chip selected={havaKatmani} onClick={() => setHavaKatmani(!havaKatmani)} icon={<Cloud className="h-4 w-4" aria-hidden />}>
              Yağış ve sıcaklık
            </Chip>
          </div>
          <TimeChart
            scenes={data.gozlemler}
            indeks={indexLayer}
            season={season}
            activeDate={active?.tarih ?? null}
            onSelect={(tarih) => navigate(archivePath(gardenId, { parametre: indexLayer, tarih }))}
            weather={havaKatmani ? (weatherHistory.data ?? []) : null}
            weatherLoading={weatherHistory.isLoading}
          />
        </Card>
      )}

      <AlertsCard alerts={data.uyarilar} />
      <WeatherAlertsCard alerts={weather.data?.uyarilar ?? []} quiet />

      <StatusCard
        data={data}
        refreshing={refresh.isPending}
        onRefresh={() => {
          setRefreshError(null)
          refresh.mutate(undefined, { onError: (err) => setRefreshError(describeError(err)) })
        }}
        refreshError={refreshError}
      />
      <ComingSoonList heading="Yakında" items={STATUS_ITEMS} />
    </div>
  )
}
