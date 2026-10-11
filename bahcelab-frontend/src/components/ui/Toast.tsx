import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react'
import { cx } from './cx'

export type ToastTone = 'success' | 'info' | 'warn' | 'error'

const ICON = { success: CircleCheck, info: Info, warn: TriangleAlert, error: CircleAlert } as const
const TONE = { success: 'text-app-success', info: 'text-app-water', warn: 'text-app-warn', error: 'text-app-danger' } as const

interface ToastProps {
  message: string
  tone?: ToastTone
  actionLabel?: string
  onAction?: () => void
  onClose?: () => void
  visible: boolean
}

/** Tek tip bildirim: ikon + metin + (isteğe bağlı) eylem. Tonlar: başarı, bilgi, uyarı, hata. */
export function Toast({ message, tone = 'info', actionLabel, onAction, onClose, visible }: ToastProps) {
  const Icon = ICON[tone]
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
      className={cx(
        'surface-dark absolute bottom-6 left-1/2 z-40 flex max-w-[min(92vw,460px)] -translate-x-1/2 items-center gap-3 rounded-full border border-app-border bg-app-card py-1.5 pl-4 pr-1.5 text-body text-app-text shadow-e2 transition-all duration-[var(--duration-panel)]',
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0',
      )}
    >
      <Icon className={cx('h-4 w-4 shrink-0', TONE[tone])} aria-hidden />
      <span className="py-1.5">{message}</span>
      {actionLabel && (
        <button type="button" onClick={onAction} className="min-h-9 rounded-full px-3 text-small font-semibold text-app-accent hover:bg-app-card-hover">
          {actionLabel}
        </button>
      )}
      {onClose && (
        <button type="button" onClick={onClose} aria-label="Bildirimi kapat" className="flex h-11 w-11 items-center justify-center rounded-full text-app-text-muted hover:bg-app-card-hover">
          <X className="h-4 w-4" aria-hidden />
        </button>
      )}
    </div>
  )
}
