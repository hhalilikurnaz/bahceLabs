import type { ReactNode } from 'react'
import { cx } from './cx'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: ReactNode
  actions?: ReactNode
  className?: string
}

/** Boş durum: ne olduğu + ne yapılabileceği. */
export function EmptyState({ icon, title, description, actions, className }: EmptyStateProps) {
  return (
    <div className={cx('flex flex-col items-center px-4 py-8 text-center', className)}>
      {icon && (
        <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-lg bg-app-accent-soft text-app-accent">{icon}</span>
      )}
      <h3 className="font-display text-h2 text-app-text">{title}</h3>
      {description && <p className="mt-1.5 max-w-[34ch] text-body text-app-text-muted">{description}</p>}
      {actions && <div className="mt-5 flex flex-wrap items-center justify-center gap-2">{actions}</div>}
    </div>
  )
}
