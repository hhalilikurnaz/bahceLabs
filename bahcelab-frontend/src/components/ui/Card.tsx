import type { HTMLAttributes, ReactNode } from 'react'
import { cx } from './cx'
import { Sparkline } from './Sparkline'

export function Card({ className, ...rest }: HTMLAttributes<HTMLElement>) {
  return <section className={cx('rounded-md border border-app-border bg-app-card p-4 shadow-e1', className)} {...rest} />
}

interface StatCardProps {
  label: string
  /** İkincil (teknik) ad, ör. NDVI */
  sublabel?: string
  value: string
  unit?: string
  /** Değişim metni, ör. "+%3" */
  delta?: string
  deltaTone?: 'up' | 'down' | 'flat'
  series?: number[]
  hint?: ReactNode
  onClick?: () => void
  selected?: boolean
  className?: string
}

const DELTA_TONE = { up: 'text-app-success', down: 'text-app-danger', flat: 'text-app-text-dim' } as const
const DELTA_ARROW = { up: '▲', down: '▼', flat: '▬' } as const

/** Değer + değişim oku + mini grafik. Renk tek başına anlam taşımaz: ok ve metin de var. */
export function StatCard({
  label,
  sublabel,
  value,
  unit,
  delta,
  deltaTone = 'flat',
  series,
  hint,
  onClick,
  selected = false,
  className,
}: StatCardProps) {
  const content = (
    <>
      <span className="flex items-baseline justify-between gap-2">
        <span className="text-small font-semibold text-app-text">{label}</span>
        {sublabel && <span className="text-caption text-app-text-dim">{sublabel}</span>}
      </span>
      <span className="mt-1 flex items-end justify-between gap-3">
        <span>
          <span className="tabular font-display text-h1 text-app-text">{value}</span>
          {unit && <span className="ml-1 text-small text-app-text-dim">{unit}</span>}
          {delta && (
            <span className={cx('tabular mt-0.5 block text-caption font-semibold', DELTA_TONE[deltaTone])}>
              {DELTA_ARROW[deltaTone]} {delta}
            </span>
          )}
        </span>
        {series && series.length > 1 && <Sparkline values={series} width={88} height={32} className="text-app-accent" />}
      </span>
      {hint && <span className="mt-1 block text-caption text-app-text-dim">{hint}</span>}
    </>
  )
  const base = cx(
    'block w-full rounded-md border bg-app-card p-3 text-left shadow-e1',
    selected ? 'border-app-accent ring-1 ring-app-accent' : 'border-app-border',
    onClick && 'transition-colors hover:bg-app-card-hover',
    className,
  )
  return onClick ? (
    <button type="button" onClick={onClick} aria-pressed={selected} className={base}>
      {content}
    </button>
  ) : (
    <div className={base}>{content}</div>
  )
}
