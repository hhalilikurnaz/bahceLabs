import { Chip } from '@/components/ui'
import { INDEX_DEFS, INDEX_IDS, type IndexId } from '../../lib/indices'

interface ParameterPickerProps {
  value: IndexId
  onChange: (indeks: IndexId) => void
}

/** Haritada gösterilecek parametre: çiftçi dilinde ad (birincil), teknik ad ikincil. */
export function ParameterPicker({ value, onChange }: ParameterPickerProps) {
  return (
    <div role="group" aria-label="Haritada gösterilen parametre">
      <div className="flex flex-wrap gap-2">
        {INDEX_IDS.map((id) => (
          <Chip key={id} selected={id === value} onClick={() => onChange(id)}>
            {INDEX_DEFS[id].ad}
            <span className="text-caption font-medium text-app-text-dim">{INDEX_DEFS[id].teknik}</span>
          </Chip>
        ))}
      </div>
    </div>
  )
}
