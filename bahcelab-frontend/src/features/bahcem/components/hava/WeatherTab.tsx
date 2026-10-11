import { Card, ErrorState, Skeleton } from '@/components/ui'
import { describeError } from '../../api/gardensApi'
import { useWeather } from '../../api/weatherApi'
import { ComingSoonList } from '../garden-page/ComingSoonList'
import { WEATHER_ITEMS } from '../garden-page/comingSoonItems'
import { CurrentCard } from './CurrentCard'
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
export function WeatherTab({ gardenId }: { gardenId: string }) {
  const { data, isLoading, error, refetch, isFetching } = useWeather(gardenId)

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
      <WeatherAlertsCard alerts={data.uyarilar} />
      <div className="grid grid-cols-1 gap-3 @2xl:grid-cols-2 @2xl:items-start">
        <div className="space-y-3">
          <CurrentCard weather={data} />
          <WaterCard balances={data.suDengesi} totals={data.yagisToplamlari} />
        </div>
        <div className="space-y-3">
          <DailyForecast days={data.gunler} />
          <SprayStrip hours={data.saatlik} nowLocal={data.simdi.zaman} />
        </div>
      </div>
      <ComingSoonList heading="Yakında" items={WEATHER_ITEMS} />
      <p className="px-1 pb-1 text-caption text-app-text-dim" data-testid="weather-attribution">
        <Attribution text={data.atif} /> Saatler Europe/Istanbul. Tarımsal değerlendirmeler bilgi amaçlıdır.
      </p>
    </div>
  )
}
