import { useEffect, useRef } from 'react'

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
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  pending = false,
  error,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    cancelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
      onPointerDown={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        className="w-full max-w-sm rounded-2xl border border-app-border bg-app-panel p-5 shadow-2xl"
      >
        <h2 id="confirm-title" className="text-[16px] font-semibold text-app-text">
          {title}
        </h2>
        <p id="confirm-message" className="mt-2 text-[13px] leading-relaxed text-app-text-muted">
          {message}
        </p>
        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-app-danger/10 px-3 py-2 text-[12px] text-app-danger">
            {error}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="h-10 rounded-xl border border-app-border px-4 text-[14px] text-app-text transition-colors hover:bg-app-card"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="h-10 rounded-xl bg-app-danger px-4 text-[14px] font-semibold text-app-bg transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {pending ? 'Siliniyor…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
