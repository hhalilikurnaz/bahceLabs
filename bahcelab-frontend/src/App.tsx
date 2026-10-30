import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { legacyRedirect } from '@/features/bahcem/lib/routes'
import { BrandMark } from '@/components/ui'
import { ProtectedRoute } from '@/features/auth/components/ProtectedRoute'
import { LandingPage } from '@/features/marketing/pages/LandingPage'

// Rota bazlı kod bölme: harita çalışma alanı (MapLibre), planlama ve blog yalnızca açılınca yüklenir
const uygulama = () => import('@/features/bahcem/BahcelerRotalari')
const UygulamaKabugu = lazy(() => uygulama().then((m) => ({ default: m.UygulamaKabugu })))
const TumBahceler = lazy(() => uygulama().then((m) => ({ default: m.TumBahceler })))
const BahceSayfasi = lazy(() => uygulama().then((m) => ({ default: m.BahceSayfasi })))
const EklemeSayfasi = lazy(() => uygulama().then((m) => ({ default: m.EklemeSayfasi })))
const AsistanSayfasi = lazy(() => uygulama().then((m) => ({ default: m.AsistanSayfasi })))
const IslerimSayfasi = lazy(() => uygulama().then((m) => ({ default: m.IslerimSayfasi })))
const HizmetlerSayfasi = lazy(() => uygulama().then((m) => ({ default: m.HizmetlerSayfasi })))
const PazarSayfasi = lazy(() => uygulama().then((m) => ({ default: m.PazarSayfasi })))
const AyarlarSayfasi = lazy(() => uygulama().then((m) => ({ default: m.AyarlarSayfasi })))
const LoginPage = lazy(() => import('@/features/auth/pages/LoginPage').then((m) => ({ default: m.LoginPage })))
const RegisterPage = lazy(() => import('@/features/auth/pages/RegisterPage').then((m) => ({ default: m.RegisterPage })))
const BlogPage = lazy(() => import('@/features/marketing/pages/BlogPage').then((m) => ({ default: m.BlogPage })))
const BlogPostPage = lazy(() => import('@/features/marketing/pages/BlogPostPage').then((m) => ({ default: m.BlogPostPage })))


function PageFallback() {
  return (
    <div className="flex h-dvh items-center justify-center bg-forest" role="status" aria-label="Sayfa yükleniyor">
      <BrandMark size={48} className="animate-pulse" />
    </div>
  )
}

/** Eski `/bahcem/...` adresleri yeni rotalara (yer imleri, bildirim bağlantıları) */
function EskiAdres() {
  const { pathname, search } = useLocation()
  return <Navigate to={legacyRedirect(pathname, search)} replace />
}

export default function App() {
  return (
    <Suspense fallback={<PageFallback />}>
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/blog" element={<BlogPage />} />
      <Route path="/blog/:slug" element={<BlogPostPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/bahcem/*" element={<EskiAdres />} />
      {/* Uygulama (giriş gerekli): /bahceler/:id[/sekme|gecmis|defter], /asistan, /islerim, /hizmetler, /pazar, /ayarlar */}
      <Route
        element={
          <ProtectedRoute>
            <UygulamaKabugu />
          </ProtectedRoute>
        }
      >
        <Route path="/bahceler" element={<TumBahceler />} />
        <Route path="/bahceler/yeni" element={<EklemeSayfasi />} />
        <Route path="/bahceler/:id" element={<BahceSayfasi />} />
        <Route path="/bahceler/:id/:sekme" element={<BahceSayfasi />} />
        <Route path="/bahceler/:id/:sekme/:alt" element={<BahceSayfasi />} />
        <Route path="/asistan" element={<AsistanSayfasi />} />
        <Route path="/islerim" element={<IslerimSayfasi />} />
        <Route path="/hizmetler" element={<HizmetlerSayfasi />} />
        <Route path="/pazar" element={<PazarSayfasi />} />
        <Route path="/ayarlar" element={<AyarlarSayfasi />} />
      </Route>
      {/* Planlama simülasyonu arayüzden kaldırıldı (kod duruyor): docs/mimari/karar/0004 */}
      <Route path="/planning/*" element={<Navigate to="/bahceler" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  )
}
