import { SelectField, TextField } from '@/components/ui'
import { useCatalog } from '../../api/agroApi'
import { GARDEN_LIMITS } from '../../lib/config'
import type { VarietyValue } from '../../lib/variety'

interface VarietyFieldProps {
  urun: string
  value: VarietyValue
  onChange: (value: VarietyValue) => void
  error?: string | null
  label?: string
}

/** Çeşit: katalogdan seçim; «Diğer» seçilirse serbest metin alanı açılır. */
export function VarietyField({ urun, value, onChange, error, label = 'Çeşit (isteğe bağlı)' }: VarietyFieldProps) {
  const { data: catalog } = useCatalog()
  const options = catalog?.find((p) => p.kod === urun)?.cesitler ?? []
  const known = options.some((o) => o.kod === value.kod)
  const selected = known ? value.kod : ''
  const note = options.find((o) => o.kod === value.kod)?.not

  return (
    <div className="space-y-2">
      <SelectField
        label={label}
        value={selected}
        onChange={(event) => onChange({ kod: event.target.value, metin: event.target.value === 'diger' ? value.metin : '' })}
        hint={note ?? undefined}
        error={selected === 'diger' ? null : error}
      >
        <option value="">Seçilmedi</option>
        {options.map((o) => (
          <option key={o.kod} value={o.kod}>
            {o.ad}
          </option>
        ))}
      </SelectField>
      {selected === 'diger' && (
        <TextField
          label="Çeşit adı"
          maxLength={GARDEN_LIMITS.varietyMax}
          value={value.metin}
          onChange={(event) => onChange({ kod: 'diger', metin: event.target.value })}
          placeholder="Çeşidin adını yazın"
          error={error}
        />
      )}
    </div>
  )
}
