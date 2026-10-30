import { useMemo } from 'react'
import { Card, ErrorState, Skeleton } from '@/components/ui'
import { Akordeon, Akordeonlar, KararBlogu, PanelKabuk } from '../../calisma/panel/parcalar'
import { havaKarar } from '../../lib/karar'
import { bestSprayTime, noSprayReason } from '../../lib/spray'
import { useWeather, useWeatherHistory } from '../../api/weatherApi'
import type { Garden } from '../../api/types'
import { shiftDays, todayIstanbul } from '../../lib/dates'
import { ChartState, HavaGrafikleri, TimeDomainProvider } from '@/components/chart'
import { useElementWidth } from '../../hooks/useElementWidth'
import { useCalismaStore } from '../../calisma/calismaStore'
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
  const imlec = useCalismaStore((st) => st.imlecTarih)
  const setImlec = useCalismaStore((st) => st.setImlecTarih)
  const [grafikRef, grafikW] = useElementWidth<HTMLDivElement>()

  if (isLoading) {
    return (
      <PanelKabuk karar={null} testId="hava-paneli">
        <div className="grid gap-3" aria-label="Hava durumu yükleniyor" aria-busy role="status"><Skeleton className="m-skeleton h-44" /><Skeleton className="m-skeleton h-56" /><Skeleton className="m-skeleton h-40" /></div>
      </PanelKabuk>
    )
  }
  if (error || !data) {
    return (
      <PanelKabuk karar={null} testId="hava-paneli">
        <Card><ErrorState title="Hava durumu alınamadı" error={error} retrying={isFetching} onRetry={() => void refetch()} /></Card>
      </PanelKabuk>
    )
  }

  const simdi = data.simdi
  const bestSpray = bestSprayTime(data.gunler.map((d) => ({ tarih: d.tarih, uygunSaat: d.ilaclama.uygunSaat, enIyiAralik: d.ilaclama.enIyiAralik })), today)
  const don = data.uyarilar.some((u) => u.tur === 'don')
  const yagisYakin = data.gunler.slice(0, 2).some((g) => (g.yagisMm ?? 0) >= 2)
  const karar = havaKarar({ don, yagisYakin, ilaclamaUygun: bestSpray !== null })
  return (
    <PanelKabuk karar={karar} testId="hava-paneli">
      <KararBlogu karar={karar} alt={bestSpray ? `En iyi ilaçlama zamanı: ${bestSpray.gun} ${bestSpray.aralik[0]}–${bestSpray.aralik[1]}.` : noSprayReason(data.saatlik)} sayi={`${Math.round(simdi.sicaklik)} °C`} etiket="şu an" kucuk={`${simdi.aciklama}${simdi.nem !== null ? ` · nem %${Math.round(simdi.nem)}` : ''} · rüzgâr ${Math.round(simdi.ruzgar)} km/s`} testId="hava-karar" />
      <SprayStrip hours={data.saatlik} nowLocal={data.simdi.zaman} />
      <WeatherAlertsCard alerts={data.uyarilar} />
      <RisksCard gardenId={gardenId} />
      <DailyForecast days={data.gunler} />
      <Card aria-label="Yağış ve sıcaklık grafiği" className="space-y-2 p-4" data-testid="weather-layer">
        <h3 className="text-lead font-semibold text-app-text">Son 90 gün: yağış ve sıcaklık</h3>
        <div ref={grafikRef}>
          {history.isLoading ? <ChartState tur="yukleniyor" yukseklik={240} /> : history.isError ? <ChartState tur="hata" error={history.error} onRetry={() => void history.refetch()} /> : (
            <TimeDomainProvider imlec={imlec} setImlec={setImlec}><HavaGrafikleri gunler={history.data ?? []} from={range.from} to={range.to} genislik={Math.max(280, grafikW)} /></TimeDomainProvider>
          )}
        </div>
      </Card>
      <IrrigationCard garden={garden} />
      <Akordeonlar>
        <Akordeon baslik="Kaynak ve ayrıntı" ozet="Open-Meteo · saatler Europe/Istanbul">
          <div className="grid gap-3"><CurrentCard weather={data} /><WaterCard balances={data.suDengesi} totals={data.yagisToplamlari} /></div>
          <p className="mt-3 text-caption text-app-text-dim" data-testid="weather-attribution"><Attribution text={data.atif} /> Tarımsal değerlendirmeler bilgi amaçlıdır.</p>
        </Akordeon>
      </Akordeonlar>
    </PanelKabuk>
  )
}
