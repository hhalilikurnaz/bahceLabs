import { useNavigate } from 'react-router-dom'
import { planningApi } from '../api'

export function PlanningListPage() {
  const navigate = useNavigate()

  async function handleCreatePlan() {
    const plan = await planningApi.createPlan('Yeni Plan')
    navigate(`/planning/${plan.id}`)
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-planning-bg p-8">
      <div className="max-w-lg text-center">
        <h1 className="text-2xl font-semibold text-planning-text">
          BahçeLab Planlama &amp; Simülasyon
        </h1>
        <p className="mt-2 text-sm text-planning-text-muted">
          Boş araziden hasada kadar akıllı planlama workspace&apos;i.
        </p>
      </div>
      <button
        type="button"
        onClick={handleCreatePlan}
        className="rounded-lg bg-planning-accent px-6 py-3 text-sm font-semibold text-planning-bg"
      >
        Yeni Plan Oluştur
      </button>
    </div>
  )
}
