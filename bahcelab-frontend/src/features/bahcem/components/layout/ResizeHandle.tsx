import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { LAYOUT } from '../../lib/config'

interface ResizeHandleProps {
  /** Geçerli genişlik ve izin verilen aralık, px */
  valuePx: number
  minPx: number
  maxPx: number
  onChange: (px: number) => void
  onDragChange?: (dragging: boolean) => void
}

/**
 * Sağ panelin sol kenarındaki ayırıcı: sürükleyerek ya da ← → tuşlarıyla genişlik ayarlanır.
 * Panel sağa yaslı olduğu için sola çekmek genişletir. Dokunma alanı görünen çizgiden geniştir (≥44 px).
 */
export function ResizeHandle({ valuePx, minPx, maxPx, onChange, onDragChange }: ResizeHandleProps) {
  const start = useRef<{ x: number; width: number } | null>(null)
  const [active, setActive] = useState(false)
  const clamp = (px: number) => Math.min(maxPx, Math.max(minPx, Math.round(px)))

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId)
    start.current = { x: event.clientX, width: valuePx }
    setActive(true)
    onDragChange?.(true)
  }
  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (start.current) onChange(clamp(start.current.width + (start.current.x - event.clientX)))
  }
  function end() {
    start.current = null
    setActive(false)
    onDragChange?.(false)
  }
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = LAYOUT.detailResizeStepPx
    if (event.key === 'ArrowLeft') onChange(clamp(valuePx + step))
    else if (event.key === 'ArrowRight') onChange(clamp(valuePx - step))
    else if (event.key === 'Home') onChange(minPx)
    else if (event.key === 'End') onChange(maxPx)
    else return
    event.preventDefault()
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Panel genişliği"
      aria-valuemin={minPx}
      aria-valuemax={maxPx}
      aria-valuenow={valuePx}
      tabIndex={0}
      data-testid="detail-resize"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
      onKeyDown={onKeyDown}
      className="group absolute inset-y-0 -left-2.5 z-10 hidden w-5 cursor-col-resize touch-none items-center justify-center outline-none min-[1180px]:flex"
    >
      <span
        className={`h-12 w-1 rounded-full transition-colors group-hover:bg-app-accent group-focus-visible:bg-app-accent ${
          active ? 'bg-app-accent' : 'bg-app-border-strong'
        }`}
        aria-hidden
      />
    </div>
  )
}
