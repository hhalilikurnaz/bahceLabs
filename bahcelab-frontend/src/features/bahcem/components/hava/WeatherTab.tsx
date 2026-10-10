import { TriangleAlert } from 'lucide-react'
import { describeError } from '../../api/gardensApi'
import { useWeather } from '../../api/weatherApi'
import { CurrentCard } from './CurrentCard'
import { DailyForecast } from './DailyForecast'
import { SprayStrip } from './SprayStrip'
import { WaterCard } from './WaterCard'
import { WeatherAlertsCard } from './WeatherAlertsCard'

/** "Hava verisi: Open-Meteo.com (CC BY 4.0)" — Open-Meteo adı kaynağa bağlanır (CC BY atıf koşulu) */
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

/** Bahçe detayındaki «Hava» sekmesi. */
export function WeatherTab({ gardenId }: { gardenId: string }) {
  const { data, isLoading, error, refetch, isFetching } = useWeather(gardenId)

  if (isLoading) {
    return (
      <div className="space-y-3" aria-label="Hava durumu yükleniyor">
        <div className="h-44 animate-pulse rounded-2xl bg-app-card" />
        <div className="h-56 animate-pulse rounded-2xl bg-app-card" />
      </div>
    )
  }
  if (error || !data) {
    return (
      <div role="alert" className="flex flex-col items-center gap-3 rounded-2xl bg-app-card px-4 py-8 text-center">
        <TriangleAlert className="h-6 w-6 text-amber-300" aria-hidden />
        <p className="text-[13px] leading-snug text-app-text-muted">{error ? describeError(error) : 'Hava durumu alınamadı.'}</p>
        <button
          type="button"
          disabled={isFetching}
          onClick={() => void refetch()}
          className="h-9 rounded-xl border border-app-border px-4 text-[13px] text-app-text hover:bg-app-card-hover disabled:opacity-50"
        >
          Tekrar dene
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <WeatherAlertsCard alerts={data.uyarilar} />
      <CurrentCard weather={data} />
      <DailyForecast days={data.gunler} />
      <SprayStrip hours={data.saatlik} nowLocal={data.simdi.zaman} />
      <WaterCard balances={data.suDengesi} totals={data.yagisToplamlari} />
      <p className="px-1 pb-1 text-[10px] leading-snug text-app-text-dim" data-testid="weather-attribution">
        <Attribution text={data.atif} /> Saatler Europe/Istanbul. Tarımsal değerlendirmeler bilgi amaçlıdır.
      </p>
    </div>
  )
}
