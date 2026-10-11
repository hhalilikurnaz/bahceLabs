import { useRef, type KeyboardEvent, type PointerEvent } from 'react'
import { nearestSheetState, sheetHeightPx, stepSheet, type SheetState } from '../../lib/layout'

interface SheetHandleProps {
  state: SheetState
  onState: (state: SheetState) => void
  /** Sürükleme sırasında anlık yükseklik (px); null = sürükleme bitti */
  onDragHeight: (heightPx: number | null) => void
}

const STATE_LABEL: Record<SheetState, string> = { peek: 'kapalı', half: 'yarım', full: 'tam' }

/** Alt sayfanın tutamacı: sürükle (üç yükseklik), dokun/Enter ile bir üst duruma, ↑ ↓ ile yüksekliği değiştir. ≥44 px hedef. */
export function SheetHandle({ state, onState, onDragHeight }: SheetHandleProps) {
  const start = useRef<{ y: number; height: number; moved: boolean } | null>(null)

  const viewportH = () => window.innerHeight
  const clampHeight = (px: number) => Math.min(sheetHeightPx('full', viewportH()), Math.max(sheetHeightPx('peek', viewportH()), px))

  function onPointerDown(event: PointerEvent<HTMLButtonElement>) {
    event.currentTarget.setPointerCapture(event.pointerId)
    start.current = { y: event.clientY, height: sheetHeightPx(state, viewportH()), moved: false }
  }
  function onPointerMove(event: PointerEvent<HTMLButtonElement>) {
    const s = start.current
    if (!s) return
    const delta = s.y - event.clientY
    if (Math.abs(delta) > 4) s.moved = true
    if (s.moved) onDragHeight(clampHeight(s.height + delta))
  }
  function onPointerUp(event: PointerEvent<HTMLButtonElement>) {
    const s = start.current
    start.current = null
    if (!s) return
    if (s.moved) {
      onState(nearestSheetState(clampHeight(s.height + (s.y - event.clientY)), viewportH()))
      onDragHeight(null)
    } else {
      onState(state === 'full' ? 'peek' : stepSheet(state, 1)) // dokunma: bir üst duruma, en üstteyse kapat
    }
  }
  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowUp') onState(stepSheet(state, 1))
    else if (event.key === 'ArrowDown') onState(stepSheet(state, -1))
    else return
    event.preventDefault()
  }

  return (
    <button
      type="button"
      role="slider"
      aria-label="Panel yüksekliği"
      aria-orientation="vertical"
      aria-valuemin={0}
      aria-valuemax={2}
      aria-valuenow={['peek', 'half', 'full'].indexOf(state)}
      aria-valuetext={STATE_LABEL[state]}
      data-testid="sheet-handle"
      data-state={state}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        start.current = null
        onDragHeight(null)
      }}
      onKeyDown={onKeyDown}
      className="flex h-11 w-full shrink-0 touch-none items-center justify-center rounded-t-lg md:hidden"
    >
      <span className="h-1.5 w-12 rounded-full bg-app-border-strong" aria-hidden />
    </button>
  )
}
