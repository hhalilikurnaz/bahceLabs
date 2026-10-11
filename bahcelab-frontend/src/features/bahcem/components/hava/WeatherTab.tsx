import { useMemo, useState } from 'react'
import { Card, ErrorState, Skeleton } from '@/components/ui'
import { describeError } from '../../api/gardensApi'
import { useWeather, useWeatherHistory } from '../../api/weatherApi'
import type { Garden } from '../../api/types'
import { shiftDays, todayIstanbul } from '../../lib/dates'
import { ComingSoonList } from '../garden-page/ComingSoonList'
import { WEATHER_ITEMS } from '../garden-page/comingSoonItems'
import { WeatherChart } from '../indeks/WeatherChart'
import { BestSprayBanner } from './BestSprayBanner'
import { CurrentCard } from './CurrentCard'
import { IrrigationCard } from './IrrigationCard'
import { RisksCard } from './RisksCard'
import { DailyForecast } from './DailyForecast'
import { SprayStrip } from './SprayStrip'
import { WaterCard } from './WaterCard'
import { WeatherAlertsCard } from './WeatherAlertsCard'

/** "Open-Meteo.com" adı kaynağa bağlanır (CC BY atıf koşulu). */
function Attribution({ text }: { text: string }) {
  const [before, after] = text.split('Open-Meteo.com')
  if (after === undefined) return <>{text}.</>
  return (
    <>
      {before}
      <a href="https://open-meteo.com/" target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-app-text-muted">
        Open-Meteo.com
      </a>
      {after}.
    </>
  )
}

/** Bahçe sayfasındaki «Hava» sekmesi. */
export function WeatherTab({ garden }: { garden: Garden }) {
  const gardenId = garden.id
  const { data, isLoading, error, refetch, isFetching } = useWeather(gardenId)
  const today = todayIstanbul()
  const range = useMemo(() => ({ from: shiftDays(today, -89), to: today }), [today])
  const history = useWeatherHistory(gardenId, range.from, shiftDays(today, -1), true)
  const [hover, setHover] = useState<string | null>(null)

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-3 @2xl:grid-cols-2" aria-label="Hava durumu yükleniyor" aria-busy>
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
    )
  }
  if (error || !data) {
    return (
      <Card>
        <ErrorState
          title="Hava durumu alınamadı"
          description={error ? describeError(error) : 'İnternet bağlantınızı kontrol edip tekrar deneyin.'}
          retrying={isFetching}
          onRetry={() => void refetch()}
        />
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      <BestSprayBanner weather={data} />
      <WeatherAlertsCard alerts={data.uyarilar} />
      <div className="grid grid-cols-1 gap-3 @2xl:grid-cols-2 @2xl:items-start">
        <IrrigationCard garden={garden} />
        <RisksCard gardenId={gardenId} />
      </div>
      <DailyForecast days={data.gunler} />
      <SprayStrip hours={data.saatlik} nowLocal={data.simdi.zaman} />
      <Card aria-label="Yağış ve sıcaklık grafiği" className="space-y-2 p-3" data-testid="weather-layer">
        <h3 className="font-display text-h2 text-app-text">Son 90 gün: yağış ve sıcaklık</h3>
        <WeatherChart days={history.data ?? []} range={range} loading={history.isLoading} hoverDoy={hover} onHoverDoy={setHover} />
      </Card>
      <div className="grid grid-cols-1 gap-3 @2xl:grid-cols-2 @2xl:items-start">
        <CurrentCard weather={data} />
        <WaterCard balances={data.suDengesi} totals={data.yagisToplamlari} />
      </div>
      <ComingSoonList heading="Yakında" items={WEATHER_ITEMS} />
      <p className="px-1 pb-1 text-caption text-app-text-dim" data-testid="weather-attribution">
        <Attribution text={data.atif} /> Saatler Europe/Istanbul. Tarımsal değerlendirmeler bilgi amaçlıdır.
      </p>
    </div>
  )
}
