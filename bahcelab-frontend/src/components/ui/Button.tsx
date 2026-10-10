import { Loader2 } from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cx } from './cx'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

const VARIANT: Record<ButtonVariant, string> = {
  // Limon: yalnızca marka ve birincil eylem (koyu metin, kontrast 11,6:1)
  primary: 'bg-app-primary text-app-on-primary hover:bg-app-primary-hover font-semibold',
  secondary: 'border border-app-border-strong bg-app-card text-app-text hover:bg-app-card-hover font-medium',
  ghost: 'text-app-text-muted hover:bg-app-card-hover hover:text-app-text font-medium',
  danger: 'bg-app-danger text-white hover:opacity-90 font-semibold',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: 'md' | 'lg'
  loading?: boolean
  icon?: ReactNode
  block?: boolean
}

/** Dokunma hedefi en az 44 px (md) / 48 px (lg). */
export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  icon,
  block = false,
  className,
  disabled,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-md px-4 text-body transition-colors duration-[var(--duration-fast)] disabled:cursor-not-allowed disabled:opacity-50',
        size === 'lg' ? 'min-h-12' : 'min-h-11',
        block && 'w-full',
        VARIANT[variant],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  )
}
