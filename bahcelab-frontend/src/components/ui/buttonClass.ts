import { cx } from './cx'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'onDark' | 'outlineOnDark'

const VARIANT: Record<ButtonVariant, string> = {
  // Limon: yalnızca marka ve birincil eylem (koyu metin, kontrast 11,6:1)
  primary: 'bg-app-primary text-app-on-primary hover:bg-app-primary-hover font-semibold',
  secondary: 'border border-app-border-strong bg-app-card text-app-text hover:bg-app-card-hover font-medium',
  ghost: 'text-app-text-muted hover:bg-app-card-hover hover:text-app-text font-medium',
  danger: 'bg-app-danger text-white hover:opacity-90 font-semibold',
  // Tanıtım sayfalarında koyu zemin (hero, koyu şerit): açık dolgu birincil, çizgili ikincil
  onDark: 'bg-mk-on-dark text-mk-night hover:bg-white font-semibold',
  outlineOnDark: 'border border-mk-on-dark/45 text-mk-on-dark hover:bg-mk-on-dark/10 font-semibold',
}

/** Düğme görünümünün sınıfları: bağlantı (`<Link>`) düğme gibi görünecekse aynı sınıflar kullanılır; tek kaynak. */
export function buttonClass({ variant = 'secondary', size = 'md', block = false, className }: { variant?: ButtonVariant; size?: 'md' | 'lg'; block?: boolean; className?: string } = {}): string {
  return cx(
    'inline-flex items-center justify-center gap-2 rounded-md px-4 text-body no-underline transition-colors duration-[var(--duration-fast)] disabled:cursor-not-allowed disabled:opacity-50',
    size === 'lg' ? 'min-h-12' : 'min-h-11',
    block && 'w-full',
    VARIANT[variant],
    className,
  )
}
