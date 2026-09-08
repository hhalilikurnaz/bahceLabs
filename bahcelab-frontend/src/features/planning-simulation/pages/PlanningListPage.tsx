import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { planningApi } from '../api'
import { isPlanningApiMock } from '../api/config'
import { ApiError } from '../api/apiClient'
import { ContinuePlansSection } from '../components/entry/ContinuePlansSection'
import { GardenListPanel } from '../components/entry/GardenListPanel'
import { PlanningEntryShell } from '../components/entry/PlanningEntryShell'
import { PlanningGuideIntro } from '../components/entry/PlanningGuideIntro'
import { PlanningStartSection } from '../components/entry/PlanningStartSection'
import type { Garden } from '../types'

type EntryView = 'home' | 'garden-list'

export function PlanningListPage() {
  const navigate = useNavigate()
  const [view, setView] = useState<EntryView>('home')
  const [isCreating, setIsCreating] = useState(false)
  const [selectedGardenId, setSelectedGardenId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const useMock = isPlanningApiMock()

  async function createAndNavigate(name: string, gardenId?: string | null) {
    setIsCreating(true)
    setError(null)

    try {
      const plan = await planningApi.createPlan(name, gardenId)
      navigate(`/planning/${plan.id}`)
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'Plan oluşturulamadı. Lütfen bağlantınızı kontrol edin.'
      setError(message)
    } finally {
      setIsCreating(false)
      setSelectedGardenId(null)
    }
  }

  async function handleSelectDraftLand() {
    await createAndNavigate('Yeni Arazi')
  }

  async function handleSelectGarden(garden: Garden) {
    setSelectedGardenId(garden.id)
    await createAndNavigate(garden.name, garden.id)
  }

  return (
    <PlanningEntryShell
      footerNote={useMock ? 'Test modu aktif.' : undefined}
    >
      {view === 'home' ? (
        <div className="flex flex-col gap-4 sm:gap-5">
          <PlanningGuideIntro />

          {error && (
            <p
              role="alert"
              className="shrink-0 rounded-xl border border-planning-error/40 bg-planning-error/10 px-4 py-3 text-[13px] text-planning-error"
            >
              {error}
            </p>
          )}

          {isCreating && (
            <p className="flex shrink-0 items-center gap-2 text-[13px] text-planning-text-muted">
              <Loader2 className="h-4 w-4 animate-spin text-planning-accent" aria-hidden />
              Planınız hazırlanıyor...
            </p>
          )}

          <div className="grid gap-4 sm:gap-5 lg:grid-cols-2 lg:items-stretch">
            <PlanningStartSection
              onSelectDraftLand={handleSelectDraftLand}
              onSelectExistingGarden={() => setView('garden-list')}
              disabled={isCreating}
            />
            <ContinuePlansSection />
          </div>
        </div>
      ) : (
        <div className="h-full min-h-0 overflow-y-auto">
          <GardenListPanel
            onBack={() => setView('home')}
            onSelectGarden={handleSelectGarden}
            isCreating={isCreating}
            selectedGardenId={selectedGardenId}
          />
        </div>
      )}
    </PlanningEntryShell>
  )
}
