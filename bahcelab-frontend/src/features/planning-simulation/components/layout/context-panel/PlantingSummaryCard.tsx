import type { DataAvailability, PlantingPlan } from '../../../types'
import { EmptyState } from '../../shared/DataField'
import { PlanningCard } from '../../shared/PlanningCard'

interface PlantingSummaryCardProps {
  plantingPlan: PlantingPlan | null
  className?: string
}

interface SummaryRowProps {
  label: string
  value: string | null
  availability?: DataAvailability
}

function formatValue(
  value: string | null,
  availability: DataAvailability = 'no_data',
): string {
  if (availability === 'not_configured') return 'Henüz yapılandırılmadı'
  if (availability === 'unavailable') return 'Veri bulunamadı'
  if (value === null || value === '') return '—'
  return value
}

function SummaryRow({ label, value, availability }: SummaryRowProps) {
  return (
    <div className="flex flex-1 items-center justify-between gap-2">
      <span className="text-[10px] text-planning-text-muted">{label}</span>
      <span className="text-right text-[10px] font-semibold text-planning-text">
        {formatValue(value, availability)}
      </span>
    </div>
  )
}

export function PlantingSummaryCard({
  plantingPlan,
  className = '',
}: PlantingSummaryCardProps) {
  const summary = plantingPlan?.summary

  return (
    <PlanningCard
      compact
      fill
      title="Dikim Planı Özeti"
      className={className}
      bodyClassName="flex min-h-0 flex-1 flex-col px-3 py-3"
    >
      {plantingPlan && summary ? (
        <div className="flex h-full min-h-0 flex-1 flex-col justify-between">
          <SummaryRow
            label="Alan"
            value={
              summary.totalAreaHa !== null
                ? `${(summary.totalAreaHa * 10).toFixed(1).replace(".", ",")} da`
                : null
            }
          />
          <SummaryRow label="Dikim Mesafesi" value={summary.spacingLabel} />
          <SummaryRow
            label="Toplam Ağaç"
            value={
              summary.plantingPointCount !== null
                ? `${summary.plantingPointCount} adet`
                : null
            }
          />
          <SummaryRow
            label="Sıra Sayısı"
            value={
              summary.rowCount !== null ? `${summary.rowCount} sıra` : null
            }
          />
          <SummaryRow
            label="Tahmini Yıllık Verim"
            value={summary.estimatedYieldLabel}
            availability={summary.estimatedYieldAvailability}
          />
        </div>
      ) : (
        <EmptyState
          title="Henüz dikim planı oluşturulmadı"
          description="Dikim mesafesi belirleyerek plan oluşturun."
        />
      )}
    </PlanningCard>
  )
}
