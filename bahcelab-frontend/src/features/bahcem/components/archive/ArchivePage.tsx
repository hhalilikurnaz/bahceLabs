import { ArrowLeft, CalendarDays } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Button, Drawer, EmptyState, IconButton, Skeleton } from '@/components/ui'
import { gridKey, indeksApi, useIndices } from '../../api/indeksApi'
import { useGardens } from '../../api/useGardens'
import type { GardenGeometry } from '../../api/types'
import { useArchiveState } from '../../hooks/useArchiveState'
import { useBahcemRoute } from '../../hooks/useBahcemRoute'
import { loadImage } from '../../lib/canvas'
import { neighborDates, resolveDate } from '../../lib/archive'
import { ARCHIVE } from '../../lib/config'
import { yearOf } from '../../lib/dates'
import { TRUE_COLOR, isIndexId } from '../../lib/indices'
import { layerImageUrl } from '../../api/indeksApi'
import { isUsable } from '../../lib/scenes'
import type { Rings } from '../../lib/rasterRender'
import { gardenPath } from '../../lib/routes'
import { useBahcemStore } from '../../stores/bahcemStore'
import { TimeChart } from '../indeks/TimeChart'
import { ArchiveDates } from './ArchiveDates'
import { ArchiveParams } from './ArchiveParams'
import { ArchiveViewer } from './ArchiveViewer'

const ringsOf = (g: GardenGeometry): Rings => (g.type === 'Polygon' ? g.coordinates : g.coordinates.flat())

/** Görüntü arşivi: parametreler | büyük görüntüleyici | tarih ızgarası. Tüm durum adreste (`?parametre=&tarih=...`). */
export function ArchivePage() {
  const { gardenId } = useBahcemRoute()
  const navigate = useNavigate()
  const client = useQueryClient()
  const { state, update } = useArchiveState()
  const { data: gardens, isLoading: gardensLoading } = useGardens()
  const indices = useIndices(gardenId)
  const skala = useBahcemStore((s) => s.skala)
  const cizim = useBahcemStore((s) => s.cizim)
  const renkKorlugu = useBahcemStore((s) => s.renkKorlugu)
  const [visibleDates, setVisibleDates] = useState<string[]>([])
  const [sheetOpen, setSheetOpen] = useState(false)

  const garden = gardens?.find((g) => g.id === gardenId)
  const rings = useMemo<Rings>(() => (garden ? ringsOf(garden.geometry) : []), [garden])
  const scenes = useMemo(() => indices.data?.gozlemler ?? [], [indices.data])
  const settings = useMemo(() => ({ skala, cizim, renkKorlugu }), [skala, cizim, renkKorlugu])

  // Görüntülenebilir tarihler: bu parametre için hazır sahneler (net filtresi tarih listesinden gelir)
  const usable = useMemo(() => scenes.filter((s) => isUsable(s, state.parametre)).map((s) => s.tarih), [scenes, state.parametre])
  const dates = useMemo(() => {
    const allowed = visibleDates.length > 0 ? usable.filter((d) => visibleDates.includes(d)) : usable
    return allowed.length > 0 ? allowed : usable
  }, [usable, visibleDates])
  const selected = resolveDate(state.tarih, dates)
  const season = state.sezon ?? (selected ? yearOf(selected) : new Date().getFullYear())

  // Seçili görüntüye komşu tarihleri önceden yükle (ok tuşuyla anında geçiş)
  useEffect(() => {
    if (!gardenId) return
    for (const date of neighborDates(selected, dates, ARCHIVE.preloadNeighbors)) {
      const scene = scenes.find((s) => s.tarih === date)
      if (!scene) continue
      if (state.parametre === TRUE_COLOR) void loadImage(layerImageUrl(gardenId, scene, TRUE_COLOR)).catch(() => undefined)
      else if (isIndexId(state.parametre) && scene.indeksler[state.parametre]?.veriVar) {
        const layer = state.parametre
        void client.prefetchQuery({ queryKey: gridKey(gardenId, layer, scene.tarih, scene.surum), queryFn: () => indeksApi.grid(gardenId, scene, layer), staleTime: Infinity })
      }
    }
  }, [gardenId, selected, dates, scenes, state.parametre, client])

  const onDates = useCallback((list: string[]) => setVisibleDates(list), [])
  const back = () => navigate(gardenId ? gardenPath(gardenId) : '/bahcem')
  const chartIndex = isIndexId(state.parametre) ? state.parametre : 'ndvi'
  const pickSecond = state.mod === 'karsilastir' || state.mod === 'degisim'

  return (
    <div className="absolute inset-y-0 left-[var(--rail-w)] right-0 z-[25] flex min-w-0 flex-col overflow-hidden bg-app-bg" data-testid="archive-page">
      <header className="flex items-center gap-2 border-b border-app-border bg-app-panel px-3 py-2">
        <IconButton label="Bahçeye dön" onClick={back}>
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </IconButton>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-h1 text-app-text">Görüntü arşivi</h1>
          <p className="truncate text-small text-app-text-muted">{garden?.ad ?? ''}</p>
        </div>
        <div className="lg:hidden">
          <Button icon={<CalendarDays className="h-4 w-4" aria-hidden />} onClick={() => setSheetOpen(true)}>
            Tarihler
          </Button>
        </div>
      </header>

      {gardensLoading || indices.isLoading ? (
        <div className="space-y-3 p-4" aria-busy>
          <Skeleton className="h-24" />
          <Skeleton className="h-80" />
        </div>
      ) : !garden ? (
        <EmptyState title="Bahçe bulunamadı" description="Bahçe silinmiş olabilir." actions={<Button onClick={() => navigate('/bahcem')}>Bahçelerime dön</Button>} />
      ) : usable.length === 0 ? (
        <EmptyState
          title="Bu parametre için görüntü yok"
          description="Uydu görüntüleri hazırlanıyor ya da bu dönem bulutlu olabilir."
          actions={<Button onClick={back}>Bahçeye dön</Button>}
        />
      ) : (
        <div className="grid min-h-0 min-w-0 flex-1 grid-cols-[minmax(0,1fr)] grid-rows-[auto_auto_1fr] gap-3 overflow-y-auto overflow-x-hidden p-3 lg:grid-cols-[250px_minmax(0,1fr)_340px] lg:grid-rows-[auto_1fr] lg:overflow-hidden">
          <div className="min-w-0 lg:hidden">
            <ArchiveParams scenes={scenes} date={selected} value={state.parametre} onChange={(parametre) => update({ parametre })} layout="tabs" />
          </div>
          <div className="hidden min-h-0 overflow-y-auto lg:row-span-2 lg:block">
            <ArchiveParams scenes={scenes} date={selected} value={state.parametre} onChange={(parametre) => update({ parametre })} layout="list" />
          </div>

          <div className="min-w-0 rounded-md border border-app-border bg-app-card px-2 py-1 lg:col-start-2" data-testid="archive-chart">
            <TimeChart scenes={scenes} indeks={chartIndex} season={season} activeDate={selected} compact onSelect={(tarih) => update({ tarih })} />
          </div>
          <div className="flex min-h-[420px] min-w-0 flex-col lg:col-start-2 lg:min-h-0">
            <ArchiveViewer garden={garden} rings={rings} scenes={scenes} dates={dates} state={{ ...state, tarih: selected }} settings={settings} onChange={(patch) => update(patch)} />
          </div>
          <div className="hidden min-h-0 flex-col lg:col-start-3 lg:row-span-2 lg:row-start-1 lg:flex">
            {gardenId && <ArchiveDates gardenId={gardenId} state={{ ...state, sezon: state.sezon ?? season }} selected={selected} pickSecond={pickSecond} onChange={(patch) => update(patch)} onDates={onDates} />}
          </div>
        </div>
      )}

      <Drawer title="Tarihler" side="bottom" open={sheetOpen} onClose={() => setSheetOpen(false)}>
        {sheetOpen && gardenId && (
          <div className="h-[60dvh]">
            <ArchiveDates gardenId={gardenId} state={{ ...state, sezon: state.sezon ?? season }} selected={selected} pickSecond={pickSecond} onChange={(patch) => { update(patch); if (patch.tarih) setSheetOpen(false) }} onDates={onDates} />
          </div>
        )}
      </Drawer>
    </div>
  )
}
