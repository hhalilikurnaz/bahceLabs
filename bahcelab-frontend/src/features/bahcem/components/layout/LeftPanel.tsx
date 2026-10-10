import { useMemo, useState } from 'react'
import { ChevronDown, Search, Sprout, TriangleAlert } from 'lucide-react'
import { describeError } from '../../api/gardensApi'
import type { Garden } from '../../api/types'
import { useDeleteGarden, useGardens, useUpdateGarden } from '../../api/useGardens'
import { useFocusGarden } from '../../map/useFocusGarden'
import { useBahcemStore } from '../../stores/bahcemStore'
import { AddGardenMenu } from '../garden/AddGardenMenu'
import { ConfirmDialog } from '../garden/ConfirmDialog'
import { GardenForm } from '../garden/GardenForm'
import { GardenListItem } from '../garden/GardenListItem'
import { ImportPicker } from '../garden/ImportPicker'
import { useToast } from './toastContext'

const CURRENT_YEAR = new Date().getFullYear()
const SEASONS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2]

function GardenList() {
  const { data: gardens, isLoading, isError, refetch } = useGardens()
  const selectedId = useBahcemStore((s) => s.selectedGardenId)
  const selectGarden = useBahcemStore((s) => s.selectGarden)
  const startEditingBoundary = useBahcemStore((s) => s.startEditingBoundary)
  const season = useBahcemStore((s) => s.season)
  const setSeason = useBahcemStore((s) => s.setSeason)
  const busy = useBahcemStore((s) => s.mode !== 'idle')
  const toast = useToast()
  const { focusGarden } = useFocusGarden()
  const update = useUpdateGarden()
  const remove = useDeleteGarden()

  const [query, setQuery] = useState('')
  const [toDelete, setToDelete] = useState<Garden | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr-TR')
    const all = gardens ?? []
    return q ? all.filter((g) => g.ad.toLocaleLowerCase('tr-TR').includes(q)) : all
  }, [gardens, query])

  function select(garden: Garden) {
    selectGarden(garden.id)
    focusGarden(garden)
  }

  async function rename(garden: Garden, name: string) {
    try {
      await update.mutateAsync({ id: garden.id, patch: { ad: name } })
    } catch (err) {
      toast.show(describeError(err))
      throw err
    }
  }

  function editBoundary(garden: Garden) {
    if (garden.geometry.type !== 'Polygon' || garden.geometry.coordinates.length !== 1) {
      toast.show('Çok parçalı veya delikli bahçelerin sınırı şimdilik düzenlenemez.')
      return
    }
    startEditingBoundary(garden.id)
  }

  function confirmDelete() {
    if (!toDelete) return
    setDeleteError(null)
    remove.mutate(toDelete.id, {
      onSuccess: () => {
        if (selectedId === toDelete.id) selectGarden(null)
        toast.show(`“${toDelete.ad}” silindi.`)
        setToDelete(null)
      },
      onError: (err) => setDeleteError(describeError(err)),
    })
  }

  const hasGardens = (gardens?.length ?? 0) > 0

  return (
    <>
      <div className="space-y-3 p-3 pb-2">
        <label className="relative block">
          <span className="sr-only">Sezon</span>
          <select
            value={season}
            onChange={(e) => setSeason(Number(e.target.value))}
            className="h-10 w-full cursor-pointer appearance-none rounded-xl border border-app-border bg-app-card pl-3.5 pr-9 text-[14px] font-medium text-app-text outline-none transition-colors hover:bg-app-card-hover focus-visible:border-app-accent"
          >
            {SEASONS.map((year) => (
              <option key={year} value={year}>
                {year} sezonu
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-text-muted"
            aria-hidden
          />
        </label>

        <div className="flex items-center gap-2">
          <label className="relative block min-w-0 flex-1">
            <span className="sr-only">Bahçe ara</span>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-text-dim"
              aria-hidden
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Bahçe ara"
              className="h-10 w-full rounded-xl border border-app-border bg-app-bg/60 pl-9 pr-3 text-[14px] text-app-text outline-none placeholder:text-app-text-dim focus:border-app-accent"
            />
          </label>
          {hasGardens && <AddGardenMenu variant="compact" />}
        </div>
      </div>

      <div className={`min-h-0 flex-1 overflow-y-auto px-3 pb-3 ${busy ? 'pointer-events-none opacity-60' : ''}`}>
        {isLoading ? (
          <ul className="space-y-2" aria-label="Bahçeler yükleniyor">
            {[0, 1, 2].map((i) => (
              <li key={i} className="h-[72px] animate-pulse rounded-xl bg-app-card" />
            ))}
          </ul>
        ) : isError ? (
          <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
            <TriangleAlert className="h-6 w-6 text-app-danger" aria-hidden />
            <p className="text-[13px] text-app-text-muted">Bahçeler yüklenemedi.</p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="h-9 rounded-xl border border-app-border px-4 text-[13px] text-app-text hover:bg-app-card"
            >
              Tekrar dene
            </button>
          </div>
        ) : !hasGardens ? (
          <div className="flex h-full flex-col items-center justify-center px-4 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-app-card text-app-accent">
              <Sprout className="h-7 w-7" strokeWidth={1.5} aria-hidden />
            </span>
            <h2 className="mt-4 text-[15px] font-semibold text-app-text">Henüz bahçe eklemediniz</h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-app-text-muted">
              Haritada bahçenizin sınırını çizin; uydu görüntüsü ve hava durumuyla izlemeye başlayın.
            </p>
            <div className="mt-5">
              <AddGardenMenu />
            </div>
          </div>
        ) : visible.length === 0 ? (
          <p className="px-2 py-6 text-center text-[13px] text-app-text-muted">
            “{query}” ile eşleşen bahçe yok.
          </p>
        ) : (
          <ul className="space-y-2">
            {visible.map((garden) => (
              <GardenListItem
                key={garden.id}
                garden={garden}
                selected={garden.id === selectedId}
                onSelect={select}
                onRename={rename}
                onEditBoundary={editBoundary}
                onDelete={(g) => {
                  setDeleteError(null)
                  setToDelete(g)
                }}
              />
            ))}
          </ul>
        )}
      </div>

      {toDelete && (
        <ConfirmDialog
          title="Bahçe silinsin mi?"
          message={`“${toDelete.ad}” ve sınırı kalıcı olarak silinecek. Bu işlem geri alınamaz.`}
          confirmLabel="Sil"
          pending={remove.isPending}
          error={deleteError}
          onConfirm={confirmDelete}
          onCancel={() => setToDelete(null)}
        />
      )}
    </>
  )
}

export function LeftPanel() {
  const open = useBahcemStore((s) => s.leftPanelOpen)
  const mode = useBahcemStore((s) => s.mode)

  return (
    <aside
      aria-label="Bahçeler"
      aria-hidden={!open}
      inert={!open}
      className={`absolute bottom-3 left-[4.25rem] top-16 z-20 flex w-[min(360px,calc(100vw-5.25rem))] flex-col rounded-2xl border border-app-border bg-app-panel shadow-2xl transition-all duration-300 ease-out md:top-3 ${
        open ? 'translate-x-0 opacity-100' : 'pointer-events-none -translate-x-6 opacity-0'
      }`}
    >
      {mode === 'form' ? <GardenForm /> : mode === 'import-pick' ? <ImportPicker /> : <GardenList />}
    </aside>
  )
}
