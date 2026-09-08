import type { DataAvailability } from '../../types'

interface DataFieldProps {
  label: string
  value: string | number | null
  availability?: DataAvailability
  unit?: string
}

function resolveDisplay(
  value: string | number | null,
  availability: DataAvailability = 'no_data',
): string {
  if (availability === 'not_configured') return 'Henüz yapılandırılmadı'
  if (availability === 'unavailable') return 'Veri bulunamadı'
  if (value === null || value === '') return '—'
  return String(value)
}

export function DataField({
  label,
  value,
  availability = value === null ? 'no_data' : 'available',
  unit,
}: DataFieldProps) {
  const display = resolveDisplay(value, availability)

  return (
    <div className="flex items-center justify-between gap-3 py-2 text-sm">
      <span className="text-planning-text-muted">{label}</span>
      <span className="font-medium text-planning-text">
        {display}
        {value !== null && unit ? ` ${unit}` : ''}
      </span>
    </div>
  )
}

export function EmptyState({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="rounded-lg border border-dashed border-planning-border bg-planning-surface/50 p-6 text-center">
      <p className="text-sm font-medium text-planning-text">{title}</p>
      <p className="mt-1 text-xs text-planning-text-muted">{description}</p>
    </div>
  )
}
