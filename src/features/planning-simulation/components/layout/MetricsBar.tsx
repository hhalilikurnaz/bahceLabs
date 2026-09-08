import type { PlantingSummary } from '../../types'

interface MetricsBarProps {
  summary: PlantingSummary | null
}

export function MetricsBar({ summary }: MetricsBarProps) {
  const items = [
    {
      label: 'Toplam Ağaç',
      value: summary?.plantingPointCount ?? null,
      unit: 'adet',
    },
    {
      label: 'Dikim Mesafesi',
      value: summary?.spacingLabel ?? null,
    },
    {
      label: 'Sıra Sayısı',
      value: summary?.rowCount ?? null,
      unit: 'sıra',
    },
    {
      label: 'Tahmini Verim (Simülasyon)',
      value: summary?.estimatedYieldLabel ?? null,
      availability: summary?.estimatedYieldAvailability ?? 'no_data',
    },
    {
      label: 'İlk Hasat Beklenen',
      value:
        summary?.firstHarvestMonth !== null
          ? `${summary?.firstHarvestMonth}. Ay`
          : null,
      availability: summary?.firstHarvestAvailability ?? 'no_data',
    },
  ]

  return (
    <div className="grid grid-cols-5 gap-4 border-t border-planning-border bg-planning-panel/80 px-6 py-4 backdrop-blur">
      {items.map((item) => (
        <div key={item.label} className="text-center">
          <p className="text-lg font-semibold text-planning-text">
            {item.value ?? '—'}
            {item.value && item.unit ? ` ${item.unit}` : ''}
          </p>
          <p className="mt-1 text-[10px] text-planning-text-dim">{item.label}</p>
        </div>
      ))}
    </div>
  )
}
