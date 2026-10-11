import { useEffect, useState } from 'react'
import { Skeleton } from '@/components/ui'
import { useGardens } from '../../api/useGardens'
import { useBahcemRoute } from '../../hooks/useBahcemRoute'
import { usePanelLayout } from '../../hooks/usePanelLayout'
import { sheetHeightPx } from '../../lib/layout'
import { useBahcemStore } from '../../stores/bahcemStore'
import { GardenForm } from '../garden/GardenForm'
import { GardenPage } from '../garden-page/GardenPage'
import { ResizeHandle } from './ResizeHandle'
import { SheetHandle } from './SheetHandle'

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

/**
 * Sağ bahçe paneli. Masaüstünde sürüklenerek genişliği ayarlanır; mobilde alttan açılan sayfadır
 * (kapalı / yarım / tam, sürüklenebilir).
 */
export function DetailPanel() {
  const { gardenId } = useBahcemRoute()
  const { detailOpen, detailPx, detailBounds, desktop } = usePanelLayout()
  const setWidth = useBahcemStore((s) => s.setDetailWidth)
  const mode = useBahcemStore((s) => s.mode)
  const sheet = useBahcemStore((s) => s.sheet)
  const setSheet = useBahcemStore((s) => s.setSheet)
  const { data: gardens, isLoading } = useGardens()
  const [dragging, setDragging] = useState(false)
  const [dragHeight, setDragHeight] = useState<number | null>(null)
  const selected = gardenId ? gardens?.find((g) => g.id === gardenId) : undefined
  const drawing = mode === 'drawing'

  // Mobilde panel her açılışta yarım yükseklikte başlar; çizim sırasında harita görünsün diye kapalı (başlık) kalır
  useEffect(() => {
    if (detailOpen) setSheet(drawing ? 'peek' : 'half')
  }, [detailOpen, drawing, gardenId, setSheet])

  const sheetPx = dragHeight ?? sheetHeightPx(sheet, typeof window === 'undefined' ? 800 : window.innerHeight)
  const animated = !(dragging || dragHeight !== null)

  return (
    <aside
      aria-label="Bahçe paneli"
      aria-hidden={!detailOpen}
      inert={!detailOpen}
      data-testid="detail-column"
      data-open={detailOpen}
      data-sheet={desktop ? undefined : sheet}
      style={desktop ? { width: detailOpen ? 'var(--detail-w)' : undefined } : { height: detailOpen ? sheetPx : 0 }}
      className={`absolute z-30 flex flex-col border border-app-border bg-app-panel shadow-e3 min-[1180px]:z-20 min-[1180px]:rounded-lg ${
        desktop
          ? 'bottom-3 right-3 top-[3.75rem]'
          : 'inset-x-0 bottom-0 left-[var(--rail-w)] rounded-t-xl'
      } ${animated ? 'transition-[width,height,opacity,transform] duration-[var(--duration-panel)] ease-[var(--ease-out-soft)]' : ''} ${
        detailOpen ? 'translate-x-0 opacity-100' : desktop ? 'pointer-events-none translate-x-6 opacity-0' : 'pointer-events-none translate-y-full opacity-0'
      }`}
    >
      {detailOpen && desktop && (
        <ResizeHandle valuePx={detailPx} minPx={detailBounds.min} maxPx={detailBounds.max} onChange={setWidth} onDragChange={setDragging} />
      )}
      {detailOpen && !desktop && <SheetHandle state={sheet} onState={setSheet} onDragHeight={setDragHeight} />}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg">
        {mode === 'drawing' || mode === 'form' ? (
          <GardenForm />
        ) : selected ? (
          <GardenPage key={selected.id} garden={selected} />
        ) : isLoading ? (
          <PanelSkeleton />
        ) : null}
      </div>
    </aside>
  )
}
