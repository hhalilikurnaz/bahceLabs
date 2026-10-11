import { Segmented, TextField } from '@/components/ui'
import type { DateRange, PeriodKind } from '../../lib/seasonAxis'

interface PeriodSelectorProps {
  kind: PeriodKind
  onKind: (kind: PeriodKind) => void
  custom: DateRange
  onCustom: (range: DateRange) => void
  /** Seçilebilecek en geç tarih (bugün) */
  max: string
}

/** Dönem seçici: bu sezon / geçen sezon / son 12 ay / özel aralık (sezon 1 Ekim'de başlar). */
export function PeriodSelector({ kind, onKind, custom, onCustom, max }: PeriodSelectorProps) {
  const invalid = custom.from > custom.to
  return (
    <div className="space-y-2" data-testid="period-selector">
      <Segmented
        label="Dönem"
        value={kind}
        onChange={onKind}
        options={[
          { value: 'bu', label: 'Bu sezon' },
          { value: 'gecen', label: 'Geçen sezon' },
          { value: 'son12', label: 'Son 12 ay' },
          { value: 'ozel', label: 'Özel aralık' },
        ]}
        className="w-full"
      />
      {kind === 'ozel' && (
        <div className="grid grid-cols-2 gap-2">
          <TextField label="Başlangıç" type="date" max={max} value={custom.from} onChange={(e) => e.target.value && onCustom({ ...custom, from: e.target.value })} />
          <TextField
            label="Bitiş"
            type="date"
            max={max}
            value={custom.to}
            onChange={(e) => e.target.value && onCustom({ ...custom, to: e.target.value })}
            error={invalid ? 'Bitiş, başlangıçtan önce olamaz.' : null}
          />
        </div>
      )}
    </div>
  )
}
