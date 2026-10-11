import { lazy, Suspense, useState, type CSSProperties } from 'react'
import { TriangleAlert } from 'lucide-react'
import { Outlet } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { useBahcemStore } from '../../stores/bahcemStore'
import { usePanelLayout } from '../../hooks/usePanelLayout'
import { LAYOUT } from '../../lib/config'
import { TOP_AREA_CLASS } from './topArea'
import { GardenLayers } from '../../map/GardenLayers'
import { GardenMapLabels } from '../../map/GardenMapLabels'
import { MapEffects } from '../../map/MapEffects'
import { IndexLayer } from '../../map/IndexLayer'
import { ZonesLayers } from '../../map/ZonesLayers'
import { MapProvider } from '../../map/MapProvider'
import { useMap } from '../../map/useMap'
import { DateStrip } from '../indeks/DateStrip'
import { IndexLegend } from '../indeks/IndexLegend'
import { SwipeHandle } from '../indeks/SwipeHandle'
import { CopilotButton, CopilotDrawer } from './CopilotDrawer'
import { FullMapBar } from './FullMapBar'
import { IconRail } from './IconRail'
import { DetailPanel } from './DetailPanel'
import { LeftPanel } from './LeftPanel'
import { MapAttribution } from './MapAttribution'
import { MapControls } from './MapControls'
import { PlaceSearch } from './PlaceSearch'
import { RouteSync } from './RouteSync'
import { ToastProvider } from './ToastProvider'

// Çizim aracı (terra-draw) ağırdır: yalnızca bahçe ekleme/düzenleme açılınca yüklenir
const DrawController = lazy(() => import('../draw/DrawController').then((m) => ({ default: m.DrawController })))

function FallbackNotice() {
  const { usingFallback } = useMap()
  if (!usingFallback) return null

  return (
    <div className={`${TOP_AREA_CLASS} pointer-events-none top-[3.75rem]`}>
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

/** Yerleşim değişkenleri: menü, panel ve haritanın görünen alanı (overlay'ler bunlara göre konumlanır). */
function layoutVars(listPx: number, detailPx: number, left: number, right: number, copilotOpen: boolean): CSSProperties {
  return {
    '--rail-w': `${LAYOUT.railPx}px`,
    '--list-w': `${listPx}px`,
    '--detail-w': `${detailPx}px`,
    '--map-left': `${left}px`,
    '--map-right': `${right}px`,
    // Üst arama alanının sağ sınırı: Copilot düğmesi görünürken onun payı da bırakılır
    '--top-right': `${right + (copilotOpen ? 0 : LAYOUT.copilotButtonPx)}px`,
  } as CSSProperties
}

/**
 * Uygulama ekranlarının ortak düzeni: tam ekran harita arkada, paneller üstünde yüzer.
 * Üst header yoktur. Sonraki ekranlar (bahçe sayfası vb.) aynı düzeni kullanır.
 */
export function BahcemLayout() {
  const { user } = useAuth()
  const { listPx, detailPx, insets } = usePanelLayout()
  const copilotOpen = useBahcemStore((s) => s.copilotOpen)
  // Çizim aracı ilk kez gerektiğinde yüklenir ve sonra açık kalır
  const flowActive = useBahcemStore((s) => s.mode !== 'idle')
  const [drawNeeded, setDrawNeeded] = useState(false)
  if (flowActive && !drawNeeded) setDrawNeeded(true) // render sırasında türetilmiş durum (React önerisi)
  if (!user) return null

  return (
    <div
      className="relative h-dvh w-screen overflow-hidden bg-app-bg font-sans text-app-text"
      style={layoutVars(listPx, detailPx, insets.left, insets.right, copilotOpen)}
    >
      <ToastProvider>
        <MapProvider userId={user.id}>
          <RouteSync />
          <Outlet />
          <GardenLayers />
          <GardenMapLabels />
          <IndexLayer />
          <ZonesLayers />
          <MapEffects />
          <IconRail />
          <LeftPanel />
          <DetailPanel />
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
          <MapAttribution />
          <FullMapBar />
          <CopilotDrawer />
        </MapProvider>
      </ToastProvider>
    </div>
  )
}
