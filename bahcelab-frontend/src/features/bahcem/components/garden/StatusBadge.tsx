import { Badge } from '@/components/ui'
import type { GardenStatus } from '../../api/overviewApi'
import { STATUS_META } from '../../lib/status'

/** Durum etiketi: renk + simge + metin. */
export function StatusBadge({ status, score, className }: { status: GardenStatus; score?: number | null; className?: string }) {
  const { label, tone, Icon } = STATUS_META[status]
  return (
    <Badge tone={tone} icon={<Icon className="h-3.5 w-3.5" aria-hidden />} className={className} data-status={status}>
      {label}
      {score != null && <span className="tabular" data-testid="badge-score"> · {score}</span>}
    </Badge>
  )
}
