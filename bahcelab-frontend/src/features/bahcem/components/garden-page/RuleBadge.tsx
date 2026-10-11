import { Badge } from '@/components/ui'
import type { RuleMeta } from '../../api/agroApi'

/** Doğrulanmamış kurallar her yerde aynı rozetle işaretlenir; kaynak notu başlıkta (title) durur. */
export function RuleBadge({ meta, className }: { meta: RuleMeta | null; className?: string }) {
  if (!meta) return null
  if (meta.durum === 'muhendis_onayli') {
    return (
      <Badge tone="success" className={className}>
        Mühendis onaylı{meta.onaylayan ? ` · ${meta.onaylayan}` : ''}
      </Badge>
    )
  }
  return (
    <span title={meta.kaynak} data-testid="rule-badge" className={className}>
      <Badge tone="neutral">Ön değer – ziraat mühendisi onayı bekleniyor</Badge>
    </span>
  )
}
