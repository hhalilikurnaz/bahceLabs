import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import { BrandMark } from '@/components/ui'
import { ProtectedRoute } from '@/features/auth/components/ProtectedRoute'
import { LandingPage } from '@/features/marketing/pages/LandingPage'

// Rota bazlı kod bölme: harita çalışma alanı (MapLibre), planlama ve blog yalnızca açılınca yüklenir
const BahcemPage = lazy(() => import('@/features/bahcem/pages/BahcemPage').then((m) => ({ default: m.BahcemPage })))
const LoginPage = lazy(() => import('@/features/auth/pages/LoginPage').then((m) => ({ default: m.LoginPage })))
const RegisterPage = lazy(() => import('@/features/auth/pages/RegisterPage').then((m) => ({ default: m.RegisterPage })))
const BlogPage = lazy(() => import('@/features/marketing/pages/BlogPage').then((m) => ({ default: m.BlogPage })))
const BlogPostPage = lazy(() => import('@/features/marketing/pages/BlogPostPage').then((m) => ({ default: m.BlogPostPage })))

// Tasarım önizlemesi yalnızca geliştirmede yüklenir (üretim paketine girmez)
const TasarimOnizleme = import.meta.env.DEV ? lazy(() => import('@/features/tasarim/TasarimOnizleme').then((m) => ({ default: m.TasarimOnizleme }))) : null

function PageFallback() {
  return (
    <div className="flex h-dvh items-center justify-center bg-forest" role="status" aria-label="Sayfa yükleniyor">
      <BrandMark size={48} className="animate-pulse" />
    </div>
  )
}

/** /bahcem/:id → /bahcem/:id/durum */
function GardenIndexRedirect() {
  const { id } = useParams()
  return <Navigate to={id ? `/bahcem/${id}/durum` : '/bahcem'} replace />
}

export default function App() {
  return (
    <Suspense fallback={<PageFallback />}>
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/blog" element={<BlogPage />} />
      <Route path="/blog/:slug" element={<BlogPostPage />} />
      {TasarimOnizleme && (
        <Route path="/tasarim-onizleme/:yon/:ekran" element={<ProtectedRoute><TasarimOnizleme /></ProtectedRoute>} />
      )}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      {/* Bahçelerim, bölümler ve bahçe sayfası. Üst rota sabit kalır: harita sayfalar arasında yeniden kurulmaz.
          /bahcem · /bahcem/islerim|hizmetler|pazar|bildirimler|ayarlar · /bahcem/:id → /durum · /bahcem/:id/:sekme */}
      <Route
        path="/bahcem"
        element={
          <ProtectedRoute>
            <BahcemPage />
          </ProtectedRoute>
        }
      >
        <Route index element={null} />
        <Route path="islerim" element={null} />
        <Route path="hizmetler" element={null} />
        <Route path="pazar" element={null} />
        <Route path="bildirimler" element={null} />
        <Route path="ayarlar" element={null} />
        <Route path=":id" element={<GardenIndexRedirect />} />
        <Route path=":id/:tab" element={null} />
      </Route>
      {/* Planlama simülasyonu arayüzden kaldırıldı (kod duruyor): docs/mimari/karar/0004 */}
      <Route path="/planning/*" element={<Navigate to="/bahcem" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  )
}
