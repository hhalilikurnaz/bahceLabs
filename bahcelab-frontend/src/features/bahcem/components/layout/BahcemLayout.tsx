import { TriangleAlert } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthContext'
import { useBahcemStore } from '../../stores/bahcemStore'
import { topAreaClass } from './topArea'
import { GardenLayers } from '../../map/GardenLayers'
import { MapEffects } from '../../map/MapEffects'
import { MapProvider } from '../../map/MapProvider'
import { useMap } from '../../map/useMap'
import { DrawController } from '../draw/DrawController'
import { CopilotButton, CopilotDrawer } from './CopilotDrawer'
import { IconRail } from './IconRail'
import { LeftPanel } from './LeftPanel'
import { MapControls } from './MapControls'
import { PlaceSearch } from './PlaceSearch'
import { ToastProvider } from './ToastProvider'

function FallbackNotice() {
  const { usingFallback } = useMap()
  const panelOpen = useBahcemStore((s) => s.leftPanelOpen)
  const copilotOpen = useBahcemStore((s) => s.copilotOpen)
  if (!usingFallback) return null

  return (
    <div className={`${topAreaClass(panelOpen, copilotOpen)} pointer-events-none top-[3.75rem]`}>
      <div
        role="alert"
        className="pointer-events-auto flex w-full max-w-[480px] items-start gap-2.5 rounded-xl border border-amber-400/30 bg-app-panel px-3.5 py-2.5 text-[12px] text-app-text-muted shadow-xl"
      >
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden />
        <span>
          MapTiler anahtarı bulunamadı; OpenStreetMap altlığı gösteriliyor. Uydu görüntüsü için
          <code className="mx-1 rounded bg-app-card px-1">.env.local</code>
          dosyasına <code className="rounded bg-app-card px-1">VITE_MAPTILER_KEY</code> ekleyin.
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
  if (!user) return null

  return (
    <div className="relative h-dvh w-screen overflow-hidden bg-app-bg font-sans text-app-text">
      <ToastProvider>
        <MapProvider userId={user.id}>
          <GardenLayers />
          <MapEffects />
          <IconRail />
          <LeftPanel />
          <PlaceSearch />
          <FallbackNotice />
          <DrawController />
          <CopilotButton />
          <MapControls />
          <CopilotDrawer />
        </MapProvider>
      </ToastProvider>
    </div>
  )
}
