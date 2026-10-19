import { lazy, Suspense, useMemo } from 'react'
import { useAuth } from '@/features/auth/useAuth'
import { ErrorState } from '@/components/ui'
import { useBahcemStore } from '../../stores/bahcemStore'
import type { Garden } from '../../api/types'
import { MapProvider } from '../../map/MapProvider'
import { useCalismaStore } from '../calismaStore'
import { useHaritaGorunumu } from '../useHaritaGorunumu'
import { BahceSiniri } from './BahceSiniri'
import { BolgeKatmani } from './BolgeKatmani'
import { BolgeLejanti } from './BolgeLejanti'
import { GorunumKatmani } from './GorunumKatmani'
import { HaritaKosesi } from './HaritaKosesi'
import { HistogramLejant } from './HistogramLejant'
import { KomsuEtiketleri } from './KomsuEtiketleri'
import { KatmanMenusu } from './KatmanMenusu'
import { NoktaInceleme } from './NoktaInceleme'
import { OlayKarti } from './OlayKarti'
import { TarihKutusu } from './TarihKutusu'

// Çizim aracı (terra-draw) ağırdır: yalnız sınır düzenlenirken yüklenir
const DrawController = lazy(() => import('../../components/draw/DrawController').then((m) => ({ default: m.DrawController })))

/** Çalışma alanının sol yarısı: tam harita (alt çubuk yok) ve köşelerdeki kontroller. */
export function HaritaPaneli({ garden, gardens }: { garden: Garden; gardens: Garden[] }) {
  const { user } = useAuth()
  const view = useHaritaGorunumu(garden.id)
  const katman = useCalismaStore((s) => s.katman)
  const others = useMemo(() => gardens.filter((g) => g.id !== garden.id), [gardens, garden.id])
  const drawing = useBahcemStore((s) => s.mode !== 'idle')
  if (!user) return null
  return (
    <div className="relative h-full w-full overflow-hidden" data-testid="harita-paneli">
      <MapProvider userId={user.id}>
        <BahceSiniri garden={garden} others={others} />
        <GorunumKatmani garden={garden} view={view} />
        <KomsuEtiketleri others={others} />
        <BolgeKatmani gardenId={garden.id} visible={katman === 'bolgeler'} />
        <div className="absolute left-3.5 top-3.5 z-20"><KatmanMenusu gardenId={garden.id} /></div>
        <div className="absolute right-3.5 top-3.5 z-10 max-[1279px]:left-3.5 max-[1279px]:right-auto max-[1279px]:top-[66px]"><TarihKutusu gardenId={garden.id} view={view} /></div>
        <div className="absolute bottom-3.5 left-3.5 z-10 max-w-[calc(100%-28px)] max-[560px]:bottom-9">{katman === 'bolgeler' ? <BolgeLejanti gardenId={garden.id} /> : <HistogramLejant view={view} />}</div>
        <div className="absolute bottom-9 right-3.5 z-10 max-[900px]:hidden"><HaritaKosesi garden={garden} /></div>
        {view.hata && (
          <div className="glass absolute left-1/2 top-1/2 z-10 w-[min(360px,calc(100%-28px))] -translate-x-1/2 -translate-y-1/2">
            <ErrorState title="Uydu verisi alınamadı" description="İnternet bağlantınızı kontrol edip tekrar deneyin." onRetry={view.tekrarDene} />
          </div>
        )}
        {view.neden && <div role="status" className="glass absolute left-1/2 top-[70px] z-10 -translate-x-1/2 px-3 py-2 text-[12.5px]">{view.neden}</div>}
        <OlayKarti gardenId={garden.id} />
        {!drawing && <NoktaInceleme gardenId={garden.id} view={view} />}
        {drawing && (
          <Suspense fallback={null}>
            <DrawController />
          </Suspense>
        )}
      </MapProvider>
    </div>
  )
}
