import { Calendar, ChevronRight, Clock, Droplets, Scissors } from 'lucide-react'
import type { ReactNode } from 'react'
import type { MaintenancePlan } from '../../../types'
import { EmptyState } from '../../shared/DataField'
import { PlanningCard } from '../../shared/PlanningCard'

interface MaintenanceSummaryCardProps {
  maintenancePlan: MaintenancePlan | null
  onOpenDetail?: () => void
  className?: string
}

interface MaintenanceRowProps {
  icon: ReactNode
  label: string
  value: string | null
  showChevron?: boolean
}

function MaintenanceRow({
  icon,
  label,
  value,
  showChevron,
}: MaintenanceRowProps) {
  return (
    <div className="flex flex-1 items-center gap-2">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-planning-border bg-planning-surface text-planning-accent">
        {icon}
      </span>
      <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
        <span className="text-[10px] text-planning-text-dim">{label}</span>
        <span className="flex items-center gap-0.5 text-right text-[10px] font-medium text-planning-text">
          {value ?? '—'}
          {showChevron && value && (
            <ChevronRight className="h-2.5 w-2.5 text-planning-text-dim" />
          )}
        </span>
      </div>
    </div>
  )
}

export function MaintenanceSummaryCard({
  maintenancePlan,
  onOpenDetail,
  className = '',
}: MaintenanceSummaryCardProps) {
  const hasPlan = Boolean(maintenancePlan)

  return (
    <PlanningCard
      compact
      fill
      title="Bakım Planı Özeti"
      className={className}
      bodyClassName="flex min-h-0 flex-1 flex-col px-3 py-3"
      footer={
        hasPlan ? (
          <button
            type="button"
            onClick={onOpenDetail}
            className="w-full rounded-md border border-planning-border bg-planning-surface px-3 py-1.5 text-[10px] font-medium text-planning-accent transition-colors hover:border-planning-accent/40"
          >
            Detaylı Bakım Planı
          </button>
        ) : undefined
      }
    >
      {maintenancePlan ? (
        <div className="flex h-full min-h-0 flex-1 flex-col justify-between">
          <MaintenanceRow
            icon={<Droplets className="h-3 w-3" strokeWidth={1.75} />}
            label="Sulama"
            value={maintenancePlan.irrigation.method}
            showChevron
          />
          <MaintenanceRow
            icon={<Clock className="h-3 w-3" strokeWidth={1.75} />}
            label="Sulama Sıklığı"
            value={maintenancePlan.irrigation.frequency}
          />
          <MaintenanceRow
            icon={<Calendar className="h-3 w-3" strokeWidth={1.75} />}
            label="Gübreleme"
            value={maintenancePlan.fertilization.schedule}
          />
          <MaintenanceRow
            icon={<Scissors className="h-3 w-3" strokeWidth={1.75} />}
            label="Budama"
            value={maintenancePlan.pruning.schedule}
          />
        </div>
      ) : (
        <EmptyState
          title="Bakım planı henüz oluşturulmadı"
          description="Bakım planı adımına geçerek oluşturun."
        />
      )}
    </PlanningCard>
  )
}
