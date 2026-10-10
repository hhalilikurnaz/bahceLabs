import { createContext, useContext } from 'react'
import type { ToastTone } from '@/components/ui'

export interface ToastOptions {
  tone?: ToastTone
  actionLabel?: string
  onAction?: () => void
}

export interface ToastApi {
  show: (message: string, options?: ToastOptions) => void
}

export const ToastContext = createContext<ToastApi | null>(null)

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
