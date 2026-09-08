import type { ReactNode } from 'react'

interface PlanningCardProps {
  title?: string
  children: ReactNode
  className?: string
  bodyClassName?: string
  footer?: ReactNode
  compact?: boolean
  /** Kartı mevcut dikey alanı doldurur; içerik spread ile yayılır */
  fill?: boolean
}

export function PlanningCard({
  title,
  children,
  className = '',
  bodyClassName = '',
  footer,
  compact = false,
  fill = false,
}: PlanningCardProps) {
  const headerPadding = compact ? 'px-3 py-1.5' : 'px-4 py-3'
  const defaultBodyPadding = compact ? 'p-3' : 'p-4'
  const footerPadding = compact ? 'p-2.5' : 'p-4'

  return (
    <section
      className={`flex flex-col rounded-xl border border-planning-border bg-planning-card shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] ${
        fill ? 'flex min-h-0' : ''
      } ${className}`}
    >
      {title && (
        <header
          className={`shrink-0 border-b border-planning-border-subtle ${headerPadding}`}
        >
          <h2 className="text-[11px] font-bold uppercase tracking-[0.1em] text-planning-text-muted">
            {title}
          </h2>
        </header>
      )}
      <div
        className={`${fill ? 'flex min-h-0 flex-1 flex-col ' : ''}${
          bodyClassName || defaultBodyPadding
        }`}
      >
        {children}
      </div>
      {footer && (
        <footer
          className={`shrink-0 border-t border-planning-border-subtle ${footerPadding}`}
        >
          {footer}
        </footer>
      )}
    </section>
  )
}
