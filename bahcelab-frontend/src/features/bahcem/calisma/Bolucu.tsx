import { useRef, type KeyboardEvent, type PointerEvent } from 'react'
import { useCalismaStore } from './calismaStore'

const ADIM = 0.02

/** Harita ile panel arasında sürüklenebilir bölücü (oran tarayıcıda saklanır); klavyeyle ← → ile. */
export function Bolucu({ container }: { container: React.RefObject<HTMLDivElement | null> }) {
  const oran = useCalismaStore((s) => s.oran)
  const setOran = useCalismaStore((s) => s.setOran)
  const drag = useRef(false)
  const move = (e: PointerEvent<HTMLButtonElement>) => {
    if (!drag.current || !container.current) return
    const r = container.current.getBoundingClientRect()
    setOran((e.clientX - r.left) / r.width)
  }
  const key = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowLeft') setOran(oran - ADIM)
    if (e.key === 'ArrowRight') setOran(oran + ADIM)
  }
  return (
    <button
      type="button"
      role="separator"
      aria-orientation="vertical"
      aria-valuenow={Math.round(oran * 100)}
      aria-valuemin={42}
      aria-valuemax={78}
      aria-label="Harita ve panel genişliği"
      data-testid="bolucu"
      onPointerDown={(e) => ((drag.current = true), e.currentTarget.setPointerCapture(e.pointerId))}
      onPointerUp={() => (drag.current = false)}
      onPointerMove={move}
      onKeyDown={key}
      className="group relative z-10 -mx-1 w-2 shrink-0 cursor-col-resize bg-transparent max-[900px]:hidden"
    >
      <span className="absolute left-1/2 top-1/2 h-9 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded bg-app-border group-hover:bg-app-primary group-focus-visible:bg-app-primary" />
    </button>
  )
}
