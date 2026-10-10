import type { ReactNode } from 'react'
import { cx } from './cx'

interface TooltipProps {
  label: string
  children: ReactNode
  side?: 'right' | 'top' | 'bottom' | 'left'
  className?: string
}

const SIDE = {
  right: 'left-full top-1/2 ml-3 -translate-y-1/2',
  left: 'right-full top-1/2 mr-3 -translate-y-1/2',
  top: 'bottom-full left-1/2 mb-2 -translate-x-1/2',
  bottom: 'top-full left-1/2 mt-2 -translate-x-1/2',
} as const

/** Üzerine gelince ve klavye odağında görünür; içerik yalnızca bilgi verir (eylem taşımaz). */
export function Tooltip({ label, children, side = 'right', className }: TooltipProps) {
  return (
    <span className={cx('group/tip relative inline-flex', className)}>
      {children}
      <span
        role="tooltip"
        className={cx(
          'pointer-events-none absolute z-50 whitespace-nowrap rounded-sm border border-app-border bg-app-card px-2.5 py-1.5 text-caption text-app-text opacity-0 shadow-e2 transition-opacity duration-[var(--duration-fast)] group-hover/tip:opacity-100 group-focus-within/tip:opacity-100',
          SIDE[side],
        )}
      >
        {label}
      </span>
    </span>
  )
}
