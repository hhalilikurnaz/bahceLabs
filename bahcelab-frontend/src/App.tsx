import { Navigate, Route, Routes } from 'react-router-dom'
import { PlanningListPage } from '@/features/planning-simulation/pages/PlanningListPage'
import { PlanningWorkspacePage } from '@/features/planning-simulation/pages/PlanningWorkspacePage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/planning" replace />} />
      <Route path="/planning" element={<PlanningListPage />} />
      <Route path="/planning/:planId" element={<PlanningWorkspacePage />} />
      <Route path="*" element={<Navigate to="/planning" replace />} />
    </Routes>
  )
}
