import type { HTMLAttributes, ReactNode } from 'react'
import { cx } from './cx'

export type BadgeTone = 'neutral' | 'success' | 'warn' | 'danger' | 'info' | 'brand'

const TONE: Record<BadgeTone, string> = {
  neutral: 'bg-app-text/8 text-app-text-muted',
  success: 'bg-app-success/14 text-app-success',
  warn: 'bg-app-warn/14 text-app-warn',
  danger: 'bg-app-danger/14 text-app-danger',
  info: 'bg-app-water/14 text-app-water',
  brand: 'bg-app-primary text-app-on-primary',
}

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone
  icon?: ReactNode
}

/** Durum etiketi: renk + (isteğe bağlı) ikon + metin; renk tek başına anlam taşımaz. */
export function Badge({ tone = 'neutral', icon, className, children, ...rest }: BadgeProps) {
  return (
    <span
      className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-caption font-semibold', TONE[tone], className)}
      {...rest}
    >
      {icon}
      {children}
    </span>
  )
}
