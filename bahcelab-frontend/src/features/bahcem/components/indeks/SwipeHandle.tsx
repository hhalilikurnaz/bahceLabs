import { useRef } from 'react'
import { GripVertical } from 'lucide-react'
import { useIndexView } from '../../hooks/useIndexView'
import { useBahcemStore } from '../../stores/bahcemStore'

/** Haritayı ortadan bölen sürgü (karşılaştırma). Sürüklenince yalnızca birleştirme güncellenir. */
export function SwipeHandle() {
  const { shown } = useIndexView()
  const karsilastirma = useBahcemStore((s) => s.karsilastirma)
  const patch = useBahcemStore((s) => s.patchKarsilastirma)
  const dragging = useRef(false)
  const lineRef = useRef<HTMLDivElement>(null)

  if (!shown || !karsilastirma?.tarihB) return null

  const move = (clientX: number) => {
    const root = lineRef.current?.parentElement
    if (!root) return
    const rect = root.getBoundingClientRect()
    patch({ bolme: Math.min(0.98, Math.max(0.02, (clientX - rect.left) / rect.width)) })
  }

  return (
    <div
      ref={lineRef}
      className="pointer-events-none absolute inset-y-0 z-20 w-0"
      style={{ left: `${karsilastirma.bolme * 100}%` }}
    >
      <div className="absolute inset-y-0 -left-px w-0.5 bg-white/90 shadow-[0_0_6px_rgba(0,0,0,0.6)]" />
      <button
        type="button"
        role="slider"
        aria-label="Karşılaştırma ayırıcısı"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(karsilastirma.bolme * 100)}
        onPointerDown={(e) => {
          dragging.current = true
          e.currentTarget.setPointerCapture(e.pointerId)
        }}
        onPointerMove={(e) => dragging.current && move(e.clientX)}
        onPointerUp={() => (dragging.current = false)}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 0.1 : 0.02
          if (e.key === 'ArrowLeft') patch({ bolme: Math.max(0.02, karsilastirma.bolme - step) })
          if (e.key === 'ArrowRight') patch({ bolme: Math.min(0.98, karsilastirma.bolme + step) })
        }}
        className="pointer-events-auto absolute left-0 top-1/2 flex h-14 w-11 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize touch-none items-center justify-center rounded-full border border-white/80 bg-app-panel text-app-text shadow-e2"
      >
        <GripVertical className="h-4 w-4" aria-hidden />
      </button>
    </div>
  )
}
