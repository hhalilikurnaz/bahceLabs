import { lazy, Suspense, useEffect, useState } from 'react'
import { useAuth } from '@/features/auth/useAuth'
import { AddGardenMenu } from '../components/garden/AddGardenMenu'
import { GardenForm } from '../components/garden/GardenForm'
import { ImportPicker } from '../components/garden/ImportPicker'
import { PlaceSearch } from '../components/layout/PlaceSearch'
import { MapProvider } from '../map/MapProvider'
import { useBahcemStore } from '../stores/bahcemStore'
import { BosDurum } from '../kabuk/BosDurum'

const DrawController = lazy(() => import('../components/draw/DrawController').then((m) => ({ default: m.DrawController })))

/** `/bahceler/yeni`: solda harita (çizim), sağda adımlar — yöntem seçimi, dosyadan seçim ya da kayıt formu. */
export function EklemeSayfasi() {
  const { user } = useAuth()
  const mode = useBahcemStore((s) => s.mode)
  const resetFlow = useBahcemStore((s) => s.resetFlow)
  useEffect(() => () => resetFlow(), [resetFlow])
  const [pane, setPane] = useState<HTMLDivElement | null>(null)
  if (!user) return null
  return (
    <MapProvider userId={user.id} mount={pane}>
      <div className="flex min-h-0 flex-1 max-[900px]:flex-col" data-testid="ekleme">
        <div ref={setPane} className="relative min-h-[340px] flex-[1_1_64%] border-r border-app-border">
          {mode !== 'form' && <PlaceSearch />}
          {mode !== 'idle' && mode !== 'form' && (
            <Suspense fallback={null}>
              <DrawController />
            </Suspense>
          )}
        </div>
        <aside aria-label="Bahçe ekleme" className="flex min-h-0 min-w-[360px] flex-[1_1_36%] flex-col overflow-y-auto bg-app-panel max-[900px]:min-w-0">
          {mode === 'form' ? (
            <GardenForm />
          ) : mode === 'import-pick' ? (
            <ImportPicker />
          ) : (
            <BosDurum gravur="agac" baslik={mode === 'drawing' ? 'Sınırı haritada çizin' : 'Bahçe ekle'} fayda={mode === 'drawing' ? 'Köşelere tıklayın; ilk noktaya dönünce çizim biter. Daire aracı da var.' : 'Sınırı haritada çizin ya da KML/KMZ/GeoJSON dosyası yükleyin.'}>
              {mode === 'idle' && <AddGardenMenu />}
            </BosDurum>
          )}
        </aside>
      </div>
    </MapProvider>
  )
}
