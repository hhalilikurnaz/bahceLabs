import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, ChevronRight, Loader2 } from 'lucide-react'
import { gardenApi } from '../../api/gardenApi'
import { isPlanningApiMock } from '../../api/config'
import type { Garden } from '../../types'
import { EmptyState } from '../shared/DataField'

interface GardenListPanelProps {
  onBack: () => void
  onSelectGarden: (garden: Garden) => void
  isCreating?: boolean
  selectedGardenId?: string | null
}

function formatAreaHa(areaM2: number | null): string {
  if (areaM2 === null) return '—'
  return `${(areaM2 / 1000).toFixed(1).replace(".", ",")} da`
}

export function GardenListPanel({
  onBack,
  onSelectGarden,
  isCreating = false,
  selectedGardenId = null,
}: GardenListPanelProps) {
  const useMock = isPlanningApiMock()
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['planning', 'gardens'],
    queryFn: () => gardenApi.listGardens(),
  })

  const gardens = data ?? []
  const errorMessage =
    error instanceof Error ? error.message : 'Bahçe listesi yüklenemedi.'

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <button
        type="button"
        onClick={onBack}
        disabled={isCreating}
        className="inline-flex items-center gap-1.5 text-[14px] text-planning-text-muted transition-colors hover:text-planning-text disabled:opacity-50"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        Geri
      </button>

      <section className="space-y-4">
        <h1 className="text-[22px] font-semibold leading-snug text-planning-text sm:text-[24px]">
          Kayıtlı bahçe seçimi
        </h1>
        <p className="text-[14px] leading-relaxed text-planning-text-muted sm:text-[15px]">
          Planlamaya aktarılacak bahçeyi seçin. Seçilen bahçenin arazi
          geometrisi çalışma alanına otomatik yansıtılır.
        </p>
      </section>

      {useMock && (
        <p className="rounded-lg border border-planning-border bg-planning-surface/40 px-4 py-3 text-[13px] leading-relaxed text-planning-text-muted">
          Test modu: gerçek bahçeleriniz yerine örnek bahçeler gösterilir.
        </p>
      )}

      <section className="overflow-hidden rounded-xl border border-planning-border bg-planning-card shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_12px_40px_rgba(0,0,0,0.18)]">
        {isLoading && (
          <div className="flex items-center gap-2 px-5 py-10 text-[14px] text-planning-text-muted">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Bahçeler yükleniyor...
          </div>
        )}

        {isError && (
          <div className="p-5">
            <EmptyState title="Liste alınamadı" description={errorMessage} />
          </div>
        )}

        {!isLoading && !isError && gardens.length === 0 && (
          <div className="p-5">
            <EmptyState
              title="Kayıtlı bahçe bulunamadı"
              description="Bahçelerim sayfasından bahçe ekleyebilir veya yeni arazi tanımı ile plan oluşturabilirsiniz."
            />
          </div>
        )}

        {!isLoading && !isError && gardens.length > 0 && (
          <ul>
            {gardens.map((garden) => {
              const isSelected = selectedGardenId === garden.id
              const isBusy = isCreating && isSelected

              return (
                <li
                  key={garden.id}
                  className="border-b border-planning-border-subtle last:border-b-0"
                >
                  <button
                    type="button"
                    onClick={() => onSelectGarden(garden)}
                    disabled={isCreating}
                    className="group flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-planning-surface/40 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium text-planning-text">
                        {garden.name}
                      </span>
                      <span className="mt-1 block truncate text-[13px] text-planning-text-muted">
                        {garden.locationLabel ?? 'Konum belirtilmedi'}
                        {' · '}
                        {formatAreaHa(garden.areaM2)}
                      </span>
                    </span>

                    <span className="flex shrink-0 items-center gap-2 text-[13px] text-planning-text-dim">
                      {isBusy ? 'Hazırlanıyor...' : 'Seç'}
                      {!isBusy && (
                        <ChevronRight
                          className="h-4 w-4 transition-colors group-hover:text-planning-text"
                          strokeWidth={1.75}
                          aria-hidden
                        />
                      )}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
