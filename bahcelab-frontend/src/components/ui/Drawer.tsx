import { X } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { cx } from './cx'
import { IconButton } from './IconButton'

interface DrawerProps {
  id?: string
  title: string
  open: boolean
  onClose: () => void
  /** `right`: yan çekmece · `bottom`: mobil alt sayfa */
  side?: 'right' | 'bottom'
  /** Yan çekmece genişliği, px (ekranı aşmaz) */
  widthPx?: number
  icon?: ReactNode
  children: ReactNode
  footer?: ReactNode
  className?: string
}

/** Harita üstü çekmece / alt sayfa. ESC ile kapanır; kapalıyken `inert`. */
export function Drawer({ id, title, open, onClose, side = 'right', widthPx = 380, icon, children, footer, className }: DrawerProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <aside
      id={id}
      aria-label={title}
      aria-hidden={!open}
      inert={!open}
      style={side === 'right' ? { width: `min(${widthPx}px, 100vw)` } : undefined}
      className={cx(
        'absolute z-30 flex flex-col border-app-border bg-app-panel text-app-text shadow-e3 transition-transform duration-[var(--duration-panel)] ease-[var(--ease-out-soft)]',
        side === 'right'
          ? cx('inset-y-0 right-0 border-l', open ? 'translate-x-0' : 'translate-x-full')
          : cx('inset-x-0 bottom-0 max-h-[85dvh] rounded-t-lg border-t', open ? 'translate-y-0' : 'translate-y-full'),
        className,
      )}
    >
      <header className="flex min-h-14 shrink-0 items-center justify-between gap-2 border-b border-app-border pl-4 pr-1.5">
        <div className="flex items-center gap-2.5">
          {icon && <span className="flex h-8 w-8 items-center justify-center rounded-sm bg-app-accent-soft text-app-accent">{icon}</span>}
          <h2 className="font-display text-h2">{title}</h2>
        </div>
        <IconButton label={`${title} penceresini kapat`} onClick={onClose}>
          <X className="h-5 w-5" aria-hidden />
        </IconButton>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
      {footer && <div className="shrink-0 border-t border-app-border p-3">{footer}</div>}
    </aside>
  )
}
