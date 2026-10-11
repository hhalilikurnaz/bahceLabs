import { useState } from 'react'
import { Skeleton } from '@/components/ui'
import { useGardens } from '../../api/useGardens'
import { useBahcemRoute } from '../../hooks/useBahcemRoute'
import { usePanelLayout } from '../../hooks/usePanelLayout'
import { useBahcemStore } from '../../stores/bahcemStore'
import { GardenPage } from '../garden-page/GardenPage'
import { ResizeHandle } from './ResizeHandle'

/** Bahçe verisi gelene kadar panel iskeletle hemen görünür. */
function PanelSkeleton() {
  return (
    <div className="space-y-3 p-4" aria-busy aria-label="Yükleniyor">
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-11" />
      <Skeleton className="h-40" />
      <Skeleton className="h-40" />
    </div>
  )
}

/** Sağ bahçe paneli: seçili bahçenin Durum · Analiz · Hava · Günlük · Rapor sayfası. Genişliği sürüklenerek ayarlanır. */
export function DetailPanel() {
  const { gardenId } = useBahcemRoute()
  const { detailOpen, detailPx, detailBounds } = usePanelLayout()
  const setWidth = useBahcemStore((s) => s.setDetailWidth)
  const { data: gardens, isLoading } = useGardens()
  const [dragging, setDragging] = useState(false)
  const selected = gardenId ? gardens?.find((g) => g.id === gardenId) : undefined

  return (
    <aside
      aria-label="Bahçe paneli"
      aria-hidden={!detailOpen}
      inert={!detailOpen}
      data-testid="detail-column"
      data-open={detailOpen}
      style={{ width: detailOpen ? 'var(--detail-w)' : undefined }}
      className={`absolute bottom-16 left-[calc(var(--rail-w)+0.75rem)] right-3 top-[4.25rem] z-20 flex flex-col rounded-lg border border-app-border bg-app-panel shadow-e3 md:bottom-3 md:left-auto md:top-[3.75rem] ${
        dragging ? '' : 'transition-[width,opacity,transform] duration-[var(--duration-panel)] ease-[var(--ease-out-soft)]'
      } ${detailOpen ? 'translate-x-0 opacity-100' : 'pointer-events-none translate-x-6 opacity-0'}`}
    >
      {detailOpen && (
        <ResizeHandle
          valuePx={detailPx}
          minPx={detailBounds.min}
          maxPx={detailBounds.max}
          onChange={setWidth}
          onDragChange={setDragging}
        />
      )}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg">
        {selected ? <GardenPage key={selected.id} garden={selected} /> : isLoading ? <PanelSkeleton /> : null}
      </div>
    </aside>
  )
}
