import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ToastContext } from './toastContext'

const DURATION_MS = 3200

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null)
  const [visible, setVisible] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  const show = useCallback((next: string) => {
    window.clearTimeout(timer.current)
    setMessage(next)
    setVisible(true)
    timer.current = window.setTimeout(() => setVisible(false), DURATION_MS)
  }, [])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const api = useMemo(() => ({ show }), [show])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className={`pointer-events-none absolute bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-full border border-app-border bg-app-card px-4 py-2.5 text-[13px] text-app-text shadow-lg transition-all duration-300 ${
          visible ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'
        }`}
      >
        {message}
      </div>
    </ToastContext.Provider>
  )
}
