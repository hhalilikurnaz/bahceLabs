import { useMemo, useState } from 'react'
import { ChevronDown, Plus, Search, Sprout } from 'lucide-react'
import { GardenListItem, type GardenListEntry } from '../garden/GardenListItem'
import { useBahcemStore } from '../../stores/bahcemStore'
import { useToast } from './toastContext'

const CURRENT_YEAR = new Date().getFullYear()
const SEASONS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2]

// Bahçe listesi Adım 4'te GET /gardens ile dolacak; o zamana kadar boş durum gösterilir.
const GARDENS: GardenListEntry[] = []

export function LeftPanel() {
  const open = useBahcemStore((s) => s.leftPanelOpen)
  const season = useBahcemStore((s) => s.season)
  const setSeason = useBahcemStore((s) => s.setSeason)
  const toast = useToast()

  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr-TR')
    return q ? GARDENS.filter((g) => g.name.toLocaleLowerCase('tr-TR').includes(q)) : GARDENS
  }, [query])

  return (
    <aside
      aria-label="Bahçeler"
      aria-hidden={!open}
      inert={!open}
      className={`absolute bottom-3 left-[4.25rem] top-16 z-20 flex w-[min(360px,calc(100vw-5.25rem))] flex-col rounded-2xl border border-app-border bg-app-panel shadow-2xl transition-all duration-300 ease-out md:top-3 ${
        open ? 'translate-x-0 opacity-100' : 'pointer-events-none -translate-x-6 opacity-0'
      }`}
    >
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

        <label className="relative block">
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
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {GARDENS.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-4 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-app-card text-app-accent">
              <Sprout className="h-7 w-7" strokeWidth={1.5} aria-hidden />
            </span>
            <h2 className="mt-4 text-[15px] font-semibold text-app-text">Henüz bahçe eklemediniz</h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-app-text-muted">
              Haritada bahçenizin sınırını çizin; uydu görüntüsü ve hava durumuyla izlemeye başlayın.
            </p>
            <button
              type="button"
              onClick={() => toast.show("Bahçe ekleme Adım 4'te gelecek.")}
              className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-app-accent px-4 text-[14px] font-semibold text-app-bg transition-colors hover:bg-app-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-accent"
            >
              <Plus className="h-4 w-4" strokeWidth={2.25} aria-hidden />
              Bahçe ekle
            </button>
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
                onSelect={setSelectedId}
              />
            ))}
          </ul>
        )}
      </div>
    </aside>
  )
}
