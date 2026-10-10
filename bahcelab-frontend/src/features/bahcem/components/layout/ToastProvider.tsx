import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Toast } from '@/components/ui'
import { ToastContext, type ToastOptions } from './toastContext'

const DURATION_MS = 4200

interface ToastState extends ToastOptions {
  message: string
}

/** Tek tip bildirim: aynı anda bir mesaj; eylemli mesajlar biraz daha uzun kalır. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null)
  const [visible, setVisible] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  const hide = useCallback(() => setVisible(false), [])

  const show = useCallback((message: string, options: ToastOptions = {}) => {
    window.clearTimeout(timer.current)
    setToast({ message, ...options })
    setVisible(true)
    timer.current = window.setTimeout(() => setVisible(false), options.actionLabel ? DURATION_MS * 1.6 : DURATION_MS)
  }, [])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const api = useMemo(() => ({ show }), [show])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <Toast
        visible={visible && toast !== null}
        message={toast?.message ?? ''}
        tone={toast?.tone}
        actionLabel={toast?.actionLabel}
        onAction={() => {
          toast?.onAction?.()
          hide()
        }}
        onClose={hide}
      />
    </ToastContext.Provider>
  )
}
