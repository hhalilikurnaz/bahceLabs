import { useEffect, useState } from 'react'
import { Button, SelectField, TextField } from '@/components/ui'
import { describeError } from '../../api/gardensApi'
import { IRRIGATION_SYSTEMS, type Garden, type SulamaSistemi } from '../../api/types'
import { useUpdateGarden } from '../../api/useGardens'
import { parseOptionalInt, validateGardenFields, type GardenFieldErrors } from '../../lib/gardenFields'
import { useToast } from '../layout/toastContext'
import { VarietyField } from './VarietyField'
import { varietyPayload, varietyValueOf, type VarietyValue } from '../../lib/variety'

/** «Bilgileri tamamla»: çeşit, dikim yılı ve ağaç sayısı sonradan girilir (PATCH). Kaydedince kartlar güncellenir. */
export function GardenInfoDialog({ garden, onClose }: { garden: Garden; onClose: () => void }) {
  const update = useUpdateGarden()
  const toast = useToast()
  const [variety, setVariety] = useState<VarietyValue>(varietyValueOf(garden.cesitKodu, garden.cesit))
  const cesit = variety.metin
  const [dikimYili, setDikimYili] = useState(garden.dikimYili?.toString() ?? '')
  const [agacSayisi, setAgacSayisi] = useState(garden.agacSayisi?.toString() ?? '')
  const [sulama, setSulama] = useState<SulamaSistemi | ''>(garden.sulamaSistemi ?? '')
  const [errors, setErrors] = useState<GardenFieldErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const found = validateGardenFields({ ad: garden.ad, cesit, dikimYili, agacSayisi }, new Date().getFullYear(), false)
    setErrors(found)
    if (Object.keys(found).length > 0) return
    setServerError(null)
    update.mutate(
      { id: garden.id, patch: { ...varietyPayload(variety), dikimYili: parseOptionalInt(dikimYili), agacSayisi: parseOptionalInt(agacSayisi), sulamaSistemi: sulama || null } },
      {
        onSuccess: () => {
          toast.show('Bahçe bilgileri kaydedildi.')
          onClose()
        },
        onError: (err) => setServerError(describeError(err)),
      },
    )
  }

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-forest/60 p-4" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <form
        onSubmit={submit}
        noValidate
        role="dialog"
        aria-modal="true"
        aria-labelledby="info-title"
        className="w-full max-w-sm space-y-4 rounded-lg border border-app-border bg-app-panel p-5 shadow-e3"
        data-testid="garden-info-dialog"
      >
        <div>
          <h2 id="info-title" className="font-display text-h2 text-app-text">
            Bilgileri tamamla
          </h2>
          <p className="mt-1 text-small text-app-text-muted">“{garden.ad}” için bilgileri girin; hepsi isteğe bağlıdır.</p>
        </div>
        <VarietyField urun={garden.urun} value={variety} onChange={setVariety} error={errors.cesit} label="Çeşit" />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Dikim yılı" inputMode="numeric" value={dikimYili} onChange={(e) => setDikimYili(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="2015" error={errors.dikimYili} />
          <TextField label="Ağaç sayısı" inputMode="numeric" value={agacSayisi} onChange={(e) => setAgacSayisi(e.target.value.replace(/\D/g, '').slice(0, 7))} placeholder="500" error={errors.agacSayisi} />
        </div>
        <SelectField label="Sulama sistemi" value={sulama} onChange={(e) => setSulama(e.target.value as SulamaSistemi | '')}>
          <option value="">Seçilmedi</option>
          {IRRIGATION_SYSTEMS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </SelectField>
        {serverError && (
          <p role="alert" className="rounded-md bg-app-danger/10 px-3 py-2 text-small text-app-danger">
            {serverError}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button onClick={onClose} disabled={update.isPending}>
            Vazgeç
          </Button>
          <Button type="submit" variant="primary" loading={update.isPending}>
            Kaydet
          </Button>
        </div>
      </form>
    </div>
  )
}
