import { useRef, type KeyboardEvent, type PointerEvent } from 'react'
import { PANEL_LIMITS, useCalismaStore } from './calismaStore'

const ADIM = 16

/** Harita ile panel arasında sürüklenebilir ayraç (panel genişliği 420–640 px, tercih hatırlanır); klavyeyle ← → ile. */
export function Bolucu({ container }: { container: React.RefObject<HTMLDivElement | null> }) {
  const px = useCalismaStore((s) => s.panelPx)
  const setPanelPx = useCalismaStore((s) => s.setPanelPx)
  const drag = useRef(false)
  const move = (e: PointerEvent<HTMLButtonElement>) => {
    if (!drag.current || !container.current) return
    const r = container.current.getBoundingClientRect()
    setPanelPx(r.right - e.clientX)
  }
  const key = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowLeft') setPanelPx(px + ADIM)
    if (e.key === 'ArrowRight') setPanelPx(px - ADIM)
  }
  return (
    <button
      type="button"
      role="separator"
      aria-orientation="vertical"
      aria-valuenow={px}
      aria-valuemin={PANEL_LIMITS.min}
      aria-valuemax={PANEL_LIMITS.max}
      aria-label="Harita ve panel genişliği"
      data-testid="bolucu"
      onPointerDown={(e) => ((drag.current = true), e.currentTarget.setPointerCapture(e.pointerId))}
      onPointerUp={() => (drag.current = false)}
      onPointerMove={move}
      onKeyDown={key}
      className="group relative z-10 -mx-1 w-2 shrink-0 cursor-col-resize bg-transparent max-[899px]:hidden"
    >
      <span className="absolute left-1/2 top-1/2 h-9 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded bg-app-border-strong opacity-60 group-hover:bg-app-primary group-hover:opacity-100 group-focus-visible:bg-app-primary group-focus-visible:opacity-100" />
    </button>
  )
}
