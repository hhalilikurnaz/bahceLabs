import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from '@/features/auth/components/ProtectedRoute'
import { BahcemPage } from '@/features/bahcem/pages/BahcemPage'
import { LoginPage } from '@/features/auth/pages/LoginPage'
import { RegisterPage } from '@/features/auth/pages/RegisterPage'
import { BlogPage } from '@/features/marketing/pages/BlogPage'
import { BlogPostPage } from '@/features/marketing/pages/BlogPostPage'
import { LandingPage } from '@/features/marketing/pages/LandingPage'
import { PlanningListPage } from '@/features/planning-simulation/pages/PlanningListPage'
import { PlanningWorkspacePage } from '@/features/planning-simulation/pages/PlanningWorkspacePage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/blog" element={<BlogPage />} />
      <Route path="/blog/:slug" element={<BlogPostPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/bahcem"
        element={
          <ProtectedRoute>
            <BahcemPage />
          </ProtectedRoute>
        }
      />
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
  )
}
