import { CircleHelp } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { cx } from './cx'

interface InfoHintProps {
  /** Erişilebilir ad, ör. "Canlılık nedir?" */
  label: string
  /** Tek cümlelik açıklama */
  text: string
  className?: string
  /** Açılır metnin yönü: ekranın altındaki öğelerde `top` */
  placement?: 'bottom' | 'top'
}

/** "Bu ne demek?" açıklaması: tıkla/odakla aç, ESC veya dışarı tıkla kapat. */
export function InfoHint({ label, text, className, placement = 'bottom' }: InfoHintProps) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => !ref.current?.contains(event.target as Node) && setOpen(false)
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <span ref={ref} className={cx('relative inline-flex', className)}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 w-11 items-center justify-center rounded-full text-app-text-dim transition-colors hover:text-app-text"
      >
        <CircleHelp className="h-[18px] w-[18px]" aria-hidden />
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className={cx('absolute right-0 z-40 w-64 rounded-md border border-app-border bg-app-card p-3 text-small text-app-text shadow-e2', placement === 'top' ? 'bottom-full mb-1' : 'top-full mt-1')}
        >
          {text}
        </span>
      )}
    </span>
  )
}
