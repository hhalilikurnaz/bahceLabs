import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { planningApi } from '../api'
import { isPlanningApiMock } from '../api/config'
import { ApiError } from '../api/apiClient'

export function PlanningListPage() {
  const navigate = useNavigate()
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const useMock = isPlanningApiMock()

  async function handleCreatePlan() {
    setIsCreating(true)
    setError(null)

    try {
      const plan = await planningApi.createPlan('Yeni Plan')
      navigate(`/planning/${plan.id}`)
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'Plan oluşturulamadı. Backend çalışıyor mu?'
      setError(message)
    } finally {
      setIsCreating(false)
    }
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
        {!useMock && (
          <p className="mt-3 text-xs text-planning-accent">
            Backend API modu aktif
          </p>
        )}
      </div>
      {error && (
        <p className="max-w-md rounded-lg border border-planning-error/40 bg-planning-error/10 px-4 py-3 text-sm text-planning-error">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={handleCreatePlan}
        disabled={isCreating}
        className="rounded-lg bg-planning-accent px-6 py-3 text-sm font-semibold text-planning-bg disabled:opacity-60"
      >
        {isCreating ? 'Oluşturuluyor...' : 'Yeni Plan Oluştur'}
      </button>
    </div>
  )
}
