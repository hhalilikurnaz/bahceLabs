import { TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from './Button'
import { cx } from './cx'

interface ErrorStateProps {
  title: string
  /** Ne oldu ve ne yapılabilir */
  description?: ReactNode
  onRetry?: () => void
  retrying?: boolean
  className?: string
}

export function ErrorState({ title, description, onRetry, retrying = false, className }: ErrorStateProps) {
  return (
    <div role="alert" className={cx('flex flex-col items-center px-4 py-8 text-center', className)}>
      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-app-warn/14 text-app-warn">
        <TriangleAlert className="h-6 w-6" aria-hidden />
      </span>
      <h3 className="font-display text-h2 text-app-text">{title}</h3>
      {description && <p className="mt-1.5 max-w-[36ch] text-body text-app-text-muted">{description}</p>}
      {onRetry && (
        <Button className="mt-4" variant="secondary" onClick={onRetry} loading={retrying}>
          Tekrar dene
        </Button>
      )}
    </div>
  )
}
