import { Sprout } from 'lucide-react'
import { Card, Skeleton } from '@/components/ui'
import { useWeather } from '../../api/weatherApi'
import { PRODUCTS, type Garden } from '../../api/types'
import { formatTemp } from '../../lib/weather'
import { WeatherIcon } from '../hava/WeatherIcon'

const productLabel = (value: string): string => PRODUCTS.find((p) => p.value === value)?.label ?? value

/** Ürün · çeşit ve ağaç yaşı (dikim yılı girilmişse). */
export function ProductCard({ garden }: { garden: Garden }) {
  const age = garden.dikimYili ? new Date().getFullYear() - garden.dikimYili : null
  return (
    <Card aria-label="Ürün" data-testid="product-card" className="p-3">
      <h3 className="flex items-center gap-1.5 text-body font-semibold text-app-text">
        <Sprout className="h-4 w-4 text-app-accent" aria-hidden /> Ürün
      </h3>
      <p className="mt-1 font-display text-h1 text-app-text">{productLabel(garden.urun)}</p>
      <p className="text-small text-app-text-muted">{garden.cesit ?? 'Çeşit girilmemiş'}</p>
      <p className="mt-1 text-small text-app-text-dim">{age !== null && age >= 0 ? `Ağaç yaşı: ${age} yıl` : 'Ağaç yaşı girilmemiş'}</p>
    </Card>
  )
}

/** Bugünün havası: sıcaklık ve kısa açıklama; hava alınamıyorsa nedenini söyler. */
export function TodayWeatherCard({ gardenId }: { gardenId: string }) {
  const { data, isLoading, isError } = useWeather(gardenId)
  const today = data?.gunler[0]
  return (
    <Card aria-label="Bugünün havası" data-testid="today-weather" className="p-3">
      <h3 className="text-body font-semibold text-app-text">Bugün hava</h3>
      {isLoading ? (
        <Skeleton className="mt-2 h-14" />
      ) : data ? (
        <div className="mt-1 flex items-center justify-between gap-2">
          <div>
            <p className="tabular font-display text-h1 text-app-text">{formatTemp(data.simdi.sicaklik)}</p>
            <p className="text-small text-app-text-muted">{data.simdi.aciklama}</p>
            {today?.min != null && today.max != null && (
              <p className="tabular text-small text-app-text-dim">
                {formatTemp(today.min)} / {formatTemp(today.max)}
              </p>
            )}
          </div>
          <WeatherIcon name={data.simdi.ikon} className="h-10 w-10 shrink-0 text-app-accent" strokeWidth={1.25} aria-hidden />
        </div>
      ) : (
        <p className="mt-2 text-small text-app-text-muted">{isError ? 'Hava bilgisi alınamadı.' : 'Hava bilgisi yok.'}</p>
      )}
    </Card>
  )
}
