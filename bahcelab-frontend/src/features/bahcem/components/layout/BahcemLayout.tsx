import { lazy, Suspense, useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import { Outlet } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { useBahcemStore } from '../../stores/bahcemStore'
import { topAreaClass } from './topArea'
import { GardenLayers } from '../../map/GardenLayers'
import { MapEffects } from '../../map/MapEffects'
import { IndexLayer } from '../../map/IndexLayer'
import { ZonesLayers } from '../../map/ZonesLayers'
import { MapProvider } from '../../map/MapProvider'
import { useMap } from '../../map/useMap'
import { DateStrip } from '../indeks/DateStrip'
import { IndexLegend } from '../indeks/IndexLegend'
import { SwipeHandle } from '../indeks/SwipeHandle'
import { CopilotButton, CopilotDrawer } from './CopilotDrawer'
import { IconRail } from './IconRail'
import { LeftPanel } from './LeftPanel'
import { MapControls } from './MapControls'
import { PlaceSearch } from './PlaceSearch'
import { RouteSync } from './RouteSync'
import { ToastProvider } from './ToastProvider'

// Çizim aracı (terra-draw) ağırdır: yalnızca bahçe ekleme/düzenleme açılınca yüklenir
const DrawController = lazy(() => import('../draw/DrawController').then((m) => ({ default: m.DrawController })))

function FallbackNotice() {
  const { usingFallback } = useMap()
  const panelOpen = useBahcemStore((s) => s.leftPanelOpen)
  const copilotOpen = useBahcemStore((s) => s.copilotOpen)
  if (!usingFallback) return null

  return (
    <div className={`${topAreaClass(panelOpen, copilotOpen)} pointer-events-none top-[3.75rem]`}>
      <div
        role="alert"
        className="surface-dark pointer-events-auto flex w-full max-w-[480px] items-start gap-2.5 rounded-md border border-app-warn/40 bg-app-panel px-3.5 py-2.5 text-caption text-app-text-muted shadow-e2"
      >
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-app-warn" aria-hidden />
        <span>
          Harita anahtarı bulunamadı; OpenStreetMap altlığı gösteriliyor. Uydu görüntüsü için
          <code className="mx-1 rounded bg-app-card px-1">.env.local</code>
          dosyasına <code className="rounded bg-app-card px-1">VITE_MAPBOX_TOKEN</code> ekleyin.
        </span>
      </div>
    </div>
  )
}

/**
 * Uygulama ekranlarının ortak düzeni: tam ekran harita arkada, paneller üstünde yüzer.
 * Üst header yoktur. Sonraki ekranlar (bahçe sayfası vb.) aynı düzeni kullanır.
 */
export function BahcemLayout() {
  const { user } = useAuth()
  // Çizim aracı ilk kez gerektiğinde yüklenir ve sonra açık kalır
  const flowActive = useBahcemStore((s) => s.mode !== 'idle')
  const [drawNeeded, setDrawNeeded] = useState(false)
  if (flowActive && !drawNeeded) setDrawNeeded(true) // render sırasında türetilmiş durum (React önerisi)
  if (!user) return null

  return (
    <div className="relative h-dvh w-screen overflow-hidden bg-app-bg font-sans text-app-text">
      <ToastProvider>
        <MapProvider userId={user.id}>
          <RouteSync />
          <Outlet />
          <GardenLayers />
          <IndexLayer />
          <ZonesLayers />
          <MapEffects />
          <IconRail />
          <LeftPanel />
          <PlaceSearch />
          <FallbackNotice />
          {(flowActive || drawNeeded) && (
            <Suspense fallback={null}>
              <DrawController />
            </Suspense>
          )}
          <CopilotButton />
          <SwipeHandle />
          <IndexLegend />
          <DateStrip />
          <MapControls />
          <CopilotDrawer />
        </MapProvider>
      </ToastProvider>
    </div>
  )
}
