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
const PlanningListPage = lazy(() =>
  import('@/features/planning-simulation/pages/PlanningListPage').then((m) => ({ default: m.PlanningListPage })),
)
const PlanningWorkspacePage = lazy(() =>
  import('@/features/planning-simulation/pages/PlanningWorkspacePage').then((m) => ({ default: m.PlanningWorkspacePage })),
)

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
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      {/* Bahçelerim, bölümler ve bahçe sayfası. Üst rota sabit kalır: harita sayfalar arasında yeniden kurulmaz.
          /bahcem · /bahcem/pazar|bildirimler|ayarlar · /bahcem/:id → /durum · /bahcem/:id/:sekme */}
      <Route
        path="/bahcem"
        element={
          <ProtectedRoute>
            <BahcemPage />
          </ProtectedRoute>
        }
      >
        <Route index element={null} />
        <Route path="pazar" element={null} />
        <Route path="bildirimler" element={null} />
        <Route path="ayarlar" element={null} />
        <Route path=":id" element={<GardenIndexRedirect />} />
        <Route path=":id/:tab" element={null} />
      </Route>
      <Route
        path="/planning"
        element={
          <ProtectedRoute>
            <PlanningListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/planning/:planId"
        element={
          <ProtectedRoute>
            <PlanningWorkspacePage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  )
}
