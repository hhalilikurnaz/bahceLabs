import { createElement } from 'react'
import { CloudOff, SprayCan, TriangleAlert } from 'lucide-react'
import { useGardens } from '../../api/useGardens'
import { useWeatherOverview, type WeatherSummary } from '../../api/weatherApi'
import { formatClockIstanbul, todayIstanbul, weekdayName } from '../../lib/dates'
import { formatMm, formatPercent, formatTemp, mergeAlerts, whenText } from '../../lib/weather'
import { useFocusGarden } from '../../map/useFocusGarden'
import { useBahcemStore } from '../../stores/bahcemStore'
import { WeatherIcon } from './WeatherIcon'

function sprayText(item: WeatherSummary, today: string): string {
  const next = item.sonrakiIlaclama
  if (!next) return '7 gün içinde uygun ilaçlama aralığı yok'
  const day = next.baslangic.slice(0, 10)
  const label = day === today ? 'bugün' : weekdayName(day)
  return `İlaçlama: ${label} ${next.baslangic.slice(11, 16)}–${next.bitis.slice(11, 16)}`
}

/** Sol şeritteki «Hava durumu»: tüm bahçelerin özeti; bahçeye tıklayınca onun Hava sekmesi açılır. */
export function WeatherOverviewPanel() {
  const { data, isLoading, isError, refetch } = useWeatherOverview()
  const { data: gardens } = useGardens()
  const openGardenWeather = useBahcemStore((s) => s.openGardenWeather)
  const { focusGarden } = useFocusGarden()
  const today = todayIstanbul()

  function open(item: WeatherSummary) {
    openGardenWeather(item.gardenId)
    const garden = gardens?.find((g) => g.id === item.gardenId)
    if (garden) focusGarden(garden)
  }

  return (
    <>
      <header className="border-b border-app-border px-4 py-3">
        <h2 className="text-[16px] font-semibold text-app-text">Hava durumu</h2>
        <p className="mt-0.5 text-[12px] text-app-text-muted">Tüm bahçelerin bugünkü durumu ve yaklaşan uyarılar</p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-3" data-testid="weather-overview">
        {isLoading ? (
          <ul className="space-y-2" aria-label="Hava özeti yükleniyor">
            {[0, 1, 2].map((i) => (
              <li key={i} className="h-24 animate-pulse rounded-xl bg-app-card" />
            ))}
          </ul>
        ) : isError || !data ? (
          <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
            <TriangleAlert className="h-6 w-6 text-amber-300" aria-hidden />
            <p className="text-[13px] text-app-text-muted">Hava özeti yüklenemedi.</p>
            <button type="button" onClick={() => void refetch()} className="h-9 rounded-xl border border-app-border px-4 text-[13px] text-app-text hover:bg-app-card">
              Tekrar dene
            </button>
          </div>
        ) : data.length === 0 ? (
          <p className="px-3 py-10 text-center text-[13px] leading-relaxed text-app-text-muted">
            Hava durumunu görmek için önce bir bahçe ekleyin.
          </p>
        ) : (
          <ul className="space-y-2">
            {data.map((item) => {
              const alerts = mergeAlerts([item], undefined).get(item.gardenId) ?? []
              const first = item.uyarilar[0]
              return (
                <li key={item.gardenId}>
                  <button
                    type="button"
                    onClick={() => open(item)}
                    className="w-full rounded-xl bg-app-card p-3 text-left transition-colors hover:bg-app-card-hover focus-visible:outline-2 focus-visible:outline-app-accent"
                  >
                    <div className="flex items-center gap-3">
                      {item.simdi ? (
                        <WeatherIcon name={item.simdi.ikon} className="h-9 w-9 shrink-0 text-app-accent" strokeWidth={1.4} aria-hidden />
                      ) : (
                        <CloudOff className="h-9 w-9 shrink-0 text-app-text-dim" strokeWidth={1.4} aria-hidden />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-medium text-app-text">{item.ad}</p>
                        {item.simdi ? (
                          <p className="text-[12px] text-app-text-muted">
                            <span className="text-[15px] font-semibold text-app-text">{formatTemp(item.simdi.sicaklik)}</span>{' '}
                            {item.simdi.aciklama} · {formatTemp(item.bugunMax)}/{formatTemp(item.bugunMin)}
                          </p>
                        ) : (
                          <p className="text-[12px] text-amber-300">{item.hata ?? 'Hava verisi alınamadı'}</p>
                        )}
                      </div>
                    </div>

                    {item.simdi && (
                      <p className="mt-2 text-[11px] text-app-text-dim">
                        Bugün yağış {formatMm(item.bugunYagisMm)} ({formatPercent(item.bugunYagisOlasiligi)})
                        {item.onbellekten && item.guncelleme ? ` · önbellek ${formatClockIstanbul(item.guncelleme)}` : ''}
                        {item.ornekVeri ? ' · örnek veri' : ''}
                      </p>
                    )}

                    {first && alerts[0] && (
                      <p
                        data-priority={first.seviye}
                        className={`mt-2 flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12px] font-medium ${
                          first.seviye === 'kirmizi' ? 'bg-app-danger/15 text-red-200' : 'bg-amber-400/15 text-amber-200'
                        }`}
                      >
                        {createElement(alerts[0].Icon, { className: 'h-3.5 w-3.5 shrink-0', 'aria-hidden': true })}
                        <span className="truncate">
                          {first.baslik} · {whenText(first.baslangic, today)}
                        </span>
                      </p>
                    )}

                    {item.simdi && (
                      <p className="mt-2 flex items-center gap-1.5 text-[11px] text-app-text-muted">
                        <SprayCan className="h-3 w-3" aria-hidden />
                        {sprayText(item, today)}
                      </p>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </>
  )
}
