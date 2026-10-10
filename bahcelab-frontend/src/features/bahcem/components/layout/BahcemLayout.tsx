import { TriangleAlert } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthContext'
import { MapProvider } from '../../map/MapProvider'
import { useMap } from '../../map/useMap'
import { CopilotButton, CopilotDrawer } from './CopilotDrawer'
import { IconRail } from './IconRail'
import { LeftPanel } from './LeftPanel'
import { MapControls } from './MapControls'
import { PlaceSearch } from './PlaceSearch'
import { ToastProvider } from './ToastProvider'

function FallbackNotice() {
  const { usingFallback } = useMap()
  if (!usingFallback) return null

  return (
    <div
      role="alert"
      className="absolute left-[4.25rem] right-3 top-[3.75rem] z-10 flex items-start gap-2.5 rounded-xl border border-amber-400/30 bg-app-panel px-3.5 py-2.5 text-[12px] text-app-text-muted shadow-xl md:left-1/2 md:right-auto md:w-[min(480px,calc(100vw-30rem))] md:-translate-x-1/2"
    >
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden />
      <span>
        MapTiler anahtarı bulunamadı; OpenStreetMap altlığı gösteriliyor. Uydu görüntüsü için
        <code className="mx-1 rounded bg-app-card px-1">.env.local</code>
        dosyasına <code className="rounded bg-app-card px-1">VITE_MAPTILER_KEY</code> ekleyin.
      </span>
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
          <IconRail />
          <LeftPanel />
          <PlaceSearch />
          <FallbackNotice />
          <CopilotButton />
          <MapControls />
          <CopilotDrawer />
        </MapProvider>
      </ToastProvider>
    </div>
  )
}
