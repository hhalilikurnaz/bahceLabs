import { Navigate, Route, Routes } from 'react-router-dom'
import { BlogPage } from '@/features/marketing/pages/BlogPage'
import { LandingPage } from '@/features/marketing/pages/LandingPage'
import { PlanningListPage } from '@/features/planning-simulation/pages/PlanningListPage'
import { PlanningWorkspacePage } from '@/features/planning-simulation/pages/PlanningWorkspacePage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/blog" element={<BlogPage />} />
      <Route path="/planning" element={<PlanningListPage />} />
      <Route path="/planning/:planId" element={<PlanningWorkspacePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
