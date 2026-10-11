import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cx } from './cx'

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected: boolean
  icon?: ReactNode
  /** Sağdaki sayaç (ör. filtre sonucu adedi) */
  count?: number
}

/** Seçilebilir etiket düğmesi (filtre, parametre seçimi). `aria-pressed` ile durumunu bildirir; 44 px hedef. */
export function Chip({ selected, icon, count, className, children, type = 'button', ...rest }: ChipProps) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={cx(
        'inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-small font-semibold transition-colors duration-[var(--duration-fast)]',
        selected
          ? 'border-app-accent bg-app-accent-soft text-app-text'
          : 'border-app-border-strong bg-app-card text-app-text-muted hover:border-app-accent hover:text-app-text',
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
      {count !== undefined && <span className="tabular rounded-full bg-app-text/8 px-1.5 text-caption">{count}</span>}
    </button>
  )
}
