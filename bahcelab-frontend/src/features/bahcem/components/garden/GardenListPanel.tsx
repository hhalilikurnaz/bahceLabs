import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { Chip, EmptyState, ErrorState, SelectField, Skeleton, TextField } from '@/components/ui'
import { useGardensOverview } from '../../api/overviewApi'
import { useGardens } from '../../api/useGardens'
import type { Garden } from '../../api/types'
import { useBahcemRoute } from '../../hooks/useBahcemRoute'
import { formatDecare } from '../../lib/geo'
import { countByStatus, filterGardens, sortGardens, SORT_OPTIONS, type SortKey, type StatusFilter } from '../../lib/gardenList'
import { STATUS_META } from '../../lib/status'
import { useBahcemStore } from '../../stores/bahcemStore'
import { AddGardenMenu } from './AddGardenMenu'
import { GardenCard } from './GardenCard'
import { OnboardingSteps } from './OnboardingSteps'
import { useGardenActions } from './useGardenActions'
import { useWeatherWarmup } from '../../hooks/useWeatherWarmup'

const FILTERS: StatusFilter[] = ['hepsi', 'dikkat', 'izle', 'iyi', 'veri_yok']
const FILTER_LABEL: Record<StatusFilter, string> = {
  hepsi: 'Hepsi',
  dikkat: STATUS_META.dikkat.label,
  izle: STATUS_META.izle.label,
  iyi: STATUS_META.iyi.label,
  veri_yok: STATUS_META.veri_yok.label,
}

function ListSkeleton() {
  return (
    <ul className="space-y-2" aria-label="Bahçeler yükleniyor" data-testid="list-skeleton">
      {[0, 1, 2].map((i) => (
        <li key={i} className="flex gap-3 rounded-md border border-app-border bg-app-card p-3">
          <Skeleton className="h-14 w-14 shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        </li>
      ))}
    </ul>
  )
}

/** Sol panel — Bahçelerim: özet, durum filtresi, sıralama, arama ve bahçe kartları. */
export function GardenListPanel() {
  const gardensQuery = useGardens()
  const overviewQuery = useGardensOverview()
  const { gardenId } = useBahcemRoute()
  const busy = useBahcemStore((s) => s.mode !== 'idle')
  const actions = useGardenActions()
  const [sort, setSort] = useState<SortKey>('durum')
  const [status, setStatus] = useState<StatusFilter>('hepsi')
  const [query, setQuery] = useState('')
  useWeatherWarmup(overviewQuery.data?.bahceler)

  const byId = useMemo(() => new Map((gardensQuery.data ?? []).map((g): [string, Garden] => [g.id, g])), [gardensQuery.data])
  const all = overviewQuery.data?.bahceler
  const visible = useMemo(() => (all ? sortGardens(filterGardens(all, status, query), sort) : []), [all, status, query, sort])
  const counts = useMemo(() => countByStatus(all ?? []), [all])
  const totals = overviewQuery.data?.toplamlar

  const loading = gardensQuery.isLoading || overviewQuery.isLoading
  const failed = gardensQuery.isError || overviewQuery.isError

  return (
    <div className="flex min-h-0 flex-1 flex-col" aria-busy={loading}>
      <header className="space-y-3 border-b border-app-border p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-h1 text-app-text">Bahçelerim</h2>
          {all && all.length > 0 && <AddGardenMenu variant="compact" />}
        </div>
        {totals && totals.bahceSayisi > 0 && (
          <p className="tabular text-body text-app-text-muted" data-testid="list-summary">
            <strong className="text-app-text">{totals.bahceSayisi}</strong> bahçe ·{' '}
            <strong className="text-app-text">{formatDecare(totals.toplamDekar)}</strong>
            {totals.dikkatSayisi > 0 ? (
              <>
                {' '}
                · <strong className="text-app-danger">{totals.dikkatSayisi} dikkat gerektiriyor</strong>
              </>
            ) : (
              ' · dikkat gerektiren yok'
            )}
          </p>
        )}
      </header>

      <div data-scroll-box className={`min-h-0 flex-1 space-y-3 overflow-y-auto p-4 ${busy ? 'pointer-events-none opacity-60' : ''}`}>
        {loading ? (
          <ListSkeleton />
        ) : failed ? (
          <ErrorState
            title="Bahçeler yüklenemedi"
            description="İnternet bağlantınızı kontrol edin. Birkaç saniye sonra tekrar deneyebilirsiniz."
            retrying={gardensQuery.isFetching || overviewQuery.isFetching}
            onRetry={() => {
              void gardensQuery.refetch()
              void overviewQuery.refetch()
            }}
          />
        ) : !all || all.length === 0 ? (
          <OnboardingSteps />
        ) : (
          <>
            <div className="space-y-3">
              <TextField
                label="Bahçe ara"
                hideLabel
                type="search"
                placeholder="Bahçe ara"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <div className="flex flex-wrap gap-2" role="group" aria-label="Duruma göre filtrele">
                {FILTERS.filter((f) => f === 'hepsi' || counts[f] > 0 || f === status).map((f) => (
                  <Chip key={f} selected={status === f} count={counts[f]} onClick={() => setStatus(f)}>
                    {FILTER_LABEL[f]}
                  </Chip>
                ))}
              </div>
              <SelectField label="Sırala" value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </SelectField>
            </div>

            {visible.length === 0 ? (
              <EmptyState
                icon={<Search className="h-6 w-6" aria-hidden />}
                title="Eşleşen bahçe yok"
                description="Filtreyi veya arama sözcüğünü değiştirin."
              />
            ) : (
              <ul className="space-y-2" data-testid="garden-list">
                {visible.map((overview) => {
                  const garden = byId.get(overview.id)
                  return garden ? (
                    <GardenCard
                      key={overview.id}
                      overview={overview}
                      garden={garden}
                      selected={overview.id === gardenId}
                      onRename={actions.rename}
                      onEditBoundary={actions.editBoundary}
                      onDelete={actions.requestDelete}
                    />
                  ) : null
                })}
              </ul>
            )}
          </>
        )}
      </div>
      {actions.dialog}
    </div>
  )
}
