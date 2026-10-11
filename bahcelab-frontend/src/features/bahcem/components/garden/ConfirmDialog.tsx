import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui'

interface ConfirmDialogProps {
  title: string
  message: string
  confirmLabel: string
  pending?: boolean
  error?: string | null
  onConfirm: () => void
  onCancel: () => void
}

/** Yıkıcı işlemler için onay penceresi (Esc veya dışarı tıklama = vazgeç). */
export function ConfirmDialog({ title, message, confirmLabel, pending = false, error, onConfirm, onCancel }: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    dialogRef.current?.querySelector<HTMLElement>('[data-cancel]')?.focus()
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onCancel()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-forest/60 p-4"
      onPointerDown={(event) => event.target === event.currentTarget && onCancel()}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        className="w-full max-w-sm rounded-lg border border-app-border bg-app-panel p-5 shadow-e3"
      >
        <h2 id="confirm-title" className="font-display text-h2 text-app-text">
          {title}
        </h2>
        <p id="confirm-message" className="mt-2 text-body text-app-text-muted">
          {message}
        </p>
        {error && (
          <p role="alert" className="mt-3 rounded-md bg-app-danger/10 px-3 py-2 text-small text-app-danger">
            {error}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <Button onClick={onCancel} disabled={pending} data-cancel>
            Vazgeç
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={pending}>
            {pending ? 'Siliniyor…' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
