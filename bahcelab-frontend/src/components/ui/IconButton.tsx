import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cx } from './cx'

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  /** Zorunlu: ikon düğmesinin erişilebilir adı */
  label: string
  children: ReactNode
  active?: boolean
}

/** 44×44 px dokunma alanı. */
export function IconButton({ label, children, active = false, className, type = 'button', ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cx(
        'flex h-11 w-11 shrink-0 items-center justify-center rounded-md transition-colors duration-[var(--duration-fast)] disabled:cursor-not-allowed disabled:opacity-50',
        active ? 'bg-app-accent-soft text-app-accent' : 'text-app-text-muted hover:bg-app-card-hover hover:text-app-text',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}
