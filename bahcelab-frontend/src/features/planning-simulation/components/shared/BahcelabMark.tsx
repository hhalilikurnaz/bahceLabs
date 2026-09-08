import { Leaf } from 'lucide-react'

interface BahcelabMarkProps {
  className?: string
  iconClassName?: string
}

export function BahcelabMark({
  className = 'h-9 w-9',
  iconClassName = 'h-4 w-4',
}: BahcelabMarkProps) {
  return (
    <div
      className={`flex items-center justify-center rounded-lg border border-planning-border bg-planning-card text-planning-accent shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${className}`}
    >
      <Leaf className={iconClassName} strokeWidth={1.75} aria-hidden />
    </div>
  )
}
