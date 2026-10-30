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
import { CartoNotlari } from './CartoNotlari'
import { MapRail } from './MapRail'
import { UcusVeVurgu } from './UcusVeVurgu'
import { NoktaInceleme } from './NoktaInceleme'
import { OlayKarti } from './OlayKarti'
import { SahaKatmani } from './SahaKatmani'

// Çizim aracı (terra-draw) ağırdır: yalnız sınır düzenlenirken yüklenir
const DrawController = lazy(() => import('../../components/draw/DrawController').then((m) => ({ default: m.DrawController })))

/** Çalışma alanının sol yarısı: tam harita (alt çubuk yok) ve köşelerdeki kontroller. */
export function HaritaPaneli({ garden, gardens }: { garden: Garden; gardens: Garden[] }) {
  const { user } = useAuth()
  const view = useHaritaGorunumu(garden.id)
  const katman = useCalismaStore((s) => s.katman)
  const saha = useCalismaStore((s) => s.saha)
  const sade = useCalismaStore((s) => s.sade)
  const others = useMemo(() => gardens.filter((g) => g.id !== garden.id), [gardens, garden.id])
  const drawing = useBahcemStore((s) => s.mode !== 'idle')
  if (!user) return null
  return (
    <div className="relative h-full w-full overflow-hidden" data-testid="harita-paneli">
      <MapProvider userId={user.id}>
        <BahceSiniri garden={garden} others={others} />
        <GorunumKatmani garden={garden} view={view} />
        <KomsuEtiketleri others={others} />
        <BolgeKatmani gardenId={garden.id} visible={katman === 'bolgeler' && !sade} />
        <UcusVeVurgu gardenId={garden.id} />
        <CartoNotlari garden={garden} />
        <div className="absolute left-3.5 top-3.5 z-20 max-w-[calc(100%-28px)]"><MapRail gardenId={garden.id} view={view} /></div>
        <div className="absolute bottom-3.5 left-3.5 z-10 max-w-[calc(100%-28px)] max-[899px]:bottom-auto max-[899px]:top-[74px]">{sade ? null : katman === 'bolgeler' ? <BolgeLejanti gardenId={garden.id} /> : <HistogramLejant view={view} />}</div>
        <div className="absolute bottom-9 right-3.5 z-10 max-[900px]:hidden"><HaritaKosesi garden={garden} /></div>
        {view.hata && (
          <div className="glass absolute left-1/2 top-1/2 z-10 w-[min(360px,calc(100%-28px))] -translate-x-1/2 -translate-y-1/2">
            <ErrorState title="Uydu verisi alınamadı" error={view.hataNesnesi} onRetry={view.tekrarDene} />
          </div>
        )}
        {view.neden && <div role="status" className="glass absolute left-1/2 top-[70px] z-10 -translate-x-1/2 px-3 py-2 text-small">{view.neden}</div>}
        {saha && <SahaKatmani gardenId={garden.id} />}
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
