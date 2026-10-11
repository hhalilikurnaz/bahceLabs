import { Sprout } from 'lucide-react'
import { useState } from 'react'
import { Card, Skeleton } from '@/components/ui'
import { useWeather } from '../../api/weatherApi'
import { PRODUCTS, type Garden } from '../../api/types'
import { formatTemp } from '../../lib/weather'
import { GardenInfoDialog } from '../garden/GardenInfoDialog'
import { WeatherIcon } from '../hava/WeatherIcon'

const productLabel = (value: string): string => PRODUCTS.find((p) => p.value === value)?.label ?? value

/** Ürün · çeşit, ağaç yaşı ve ağaç sayısı. Eksik bilgi varsa «Bilgileri tamamla» formu açılır. */
export function ProductCard({ garden }: { garden: Garden }) {
  const [editing, setEditing] = useState(false)
  const age = garden.dikimYili ? new Date().getFullYear() - garden.dikimYili : null
  const missing = !garden.cesit || garden.dikimYili === null || garden.agacSayisi === null
  const facts = [garden.cesit, age !== null && age >= 0 ? `Ağaç yaşı: ${age} yıl` : null, garden.agacSayisi !== null ? `${garden.agacSayisi.toLocaleString('tr-TR')} ağaç` : null].filter(Boolean)
  return (
    <Card aria-label="Ürün" data-testid="product-card" className="p-3">
      <h3 className="flex items-center gap-1.5 text-body font-semibold text-app-text">
        <Sprout className="h-4 w-4 text-app-accent" aria-hidden /> Ürün
      </h3>
      <p className="mt-1 font-display text-h1 text-app-text">{productLabel(garden.urun)}</p>
      {facts.length > 0 && (
        <p className="text-small text-app-text-muted" data-testid="product-facts">
          {facts.join(' · ')}
        </p>
      )}
      {missing && (
        <button type="button" onClick={() => setEditing(true)} className="mt-1 inline-flex min-h-11 items-center text-small font-semibold text-app-accent underline-offset-2 hover:underline">
          Bilgileri tamamla
        </button>
      )}
      {editing && <GardenInfoDialog garden={garden} onClose={() => setEditing(false)} />}
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
