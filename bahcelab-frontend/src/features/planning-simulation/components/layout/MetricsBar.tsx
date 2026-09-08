import type { DataAvailability, PlantingSummary } from '../../types'

interface MetricsBarProps {
  summary: PlantingSummary | null
}

interface MetricItem {
  label: string
  value: string | null
  availability?: DataAvailability
}

function formatMetricValue(item: MetricItem): string {
  if (item.value === null || item.value === '') {
    if (item.availability === 'not_configured') return 'Henüz yapılandırılmadı'
    return '—'
  }
  return item.value
}

export function MetricsBar({ summary }: MetricsBarProps) {
  const items: MetricItem[] = [
    {
      label: 'Toplam Ağaç',
      value:
        summary?.plantingPointCount !== null && summary?.plantingPointCount !== undefined
          ? `${summary.plantingPointCount} adet`
          : null,
    },
    {
      label: 'Dikim Mesafesi',
      value: summary?.spacingLabel ?? null,
    },
    {
      label: 'Sıra Sayısı',
      value:
        summary?.rowCount !== null && summary?.rowCount !== undefined
          ? `${summary.rowCount} sıra`
          : null,
    },
    {
      label: 'Tahmini Verim (Yıllık)',
      value: summary?.estimatedYieldLabel ?? null,
      availability: summary?.estimatedYieldAvailability,
    },
    {
      label: 'İlk Hasat Beklenen',
      value:
        summary?.firstHarvestMonth !== null && summary?.firstHarvestMonth !== undefined
          ? `${summary.firstHarvestMonth}. Ay`
          : null,
      availability: summary?.firstHarvestAvailability,
    },
  ]

  return (
    <div className="grid grid-cols-5">
      {items.map((item, index) => (
        <div
          key={item.label}
          className={`px-5 py-4 text-center ${
            index > 0 ? 'border-l border-planning-border' : ''
          }`}
        >
          <p className="text-[20px] font-semibold leading-tight text-planning-text">
            {formatMetricValue(item)}
          </p>
          <p className="mt-1.5 text-[10px] font-medium uppercase tracking-wide text-planning-text-dim">
            {item.label}
          </p>
        </div>
      ))}
    </div>
  )
}
