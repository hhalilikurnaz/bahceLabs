import { useEffect, useRef, useState } from 'react'
import { useGardenNav } from '../../hooks/useGardenNav'
import { ArrowLeft, Loader2, TriangleAlert } from 'lucide-react'
import { Button, IconButton, SelectField, TextField } from '@/components/ui'
import { describeError, gardensApi } from '../../api/gardensApi'
import { PRODUCTS, type Urun } from '../../api/types'
import { useCreateGarden } from '../../api/useGardens'
import { boundsCenter, formatDecare, geometryBounds } from '../../lib/geo'
import { reverseGeocode } from '../../map/geocoding'
import { useFocusGarden } from '../../map/useFocusGarden'
import { useBahcemStore } from '../../stores/bahcemStore'
import { useToast } from '../layout/toastContext'

type Measure =
  | { status: 'loading' }
  | { status: 'ok'; dekar: number }
  | { status: 'error'; message: string }

/** Sınır hazır olduktan sonra bahçe bilgilerini toplayıp kaydeder (sol panelde açılır). */
export function GardenForm() {
  const draft = useBahcemStore((s) => s.draft)
  const resetFlow = useBahcemStore((s) => s.resetFlow)
  const nav = useGardenNav()
  const toast = useToast()
  const create = useCreateGarden()
  const { focusGarden } = useFocusGarden()

  const [ad, setAd] = useState(draft?.suggestedName ?? '')
  const [urun, setUrun] = useState<Urun>('limon')
  const [cesit, setCesit] = useState('')
  const [dikimYili, setDikimYili] = useState('')
  const [il, setIl] = useState('')
  const [ilce, setIlce] = useState('')
  // Sonuç hangi sınır için hesaplandığıyla birlikte tutulur; sınır değişince otomatik "hesaplanıyor"a döner
  const [measured, setMeasured] = useState<{ for: unknown; result: Measure } | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const adminTouched = useRef(false)

  const geometry = draft?.geometry
  const measure: Measure =
    measured && measured.for === geometry ? measured.result : { status: 'loading' }

  // Alan sunucuda hesaplanır; geçersiz sınır burada hemen bildirilir
  useEffect(() => {
    if (!geometry) return
    let cancelled = false
    gardensApi
      .measure(geometry)
      .then((m) => {
        if (!cancelled) setMeasured({ for: geometry, result: { status: 'ok', dekar: m.alanDekar } })
      })
      .catch((err) => {
        if (!cancelled) setMeasured({ for: geometry, result: { status: 'error', message: describeError(err) } })
      })
    return () => {
      cancelled = true
    }
  }, [geometry])

  // İl/ilçe: sınırın merkezinden ters geocoding (kullanıcı elle girdiyse dokunulmaz)
  useEffect(() => {
    if (!geometry) return
    const controller = new AbortController()
    const [lng, lat] = boundsCenter(geometryBounds(geometry))
    reverseGeocode(lng, lat, controller.signal)
      .then((area) => {
        if (adminTouched.current) return
        setIl(area.il ?? '')
        setIlce(area.ilce ?? '')
      })
      .catch((error: unknown) => {
        // İptal normaldir; diğer hatalarda il/ilçe elle girilebilir ama nedeni konsola yazılır
        if (!(error instanceof DOMException && error.name === 'AbortError')) console.warn('[BahçeLab] İl/ilçe bulunamadı', error)
      })
    return () => controller.abort()
  }, [geometry])

  if (!draft || !geometry) return null

  const yearNumber = dikimYili.trim() === '' ? null : Number(dikimYili)
  const yearInvalid = yearNumber !== null && !Number.isInteger(yearNumber)
  const canSave =
    ad.trim().length > 0 && measure.status === 'ok' && !yearInvalid && !create.isPending

  function save(e: React.FormEvent) {
    e.preventDefault()
    if (!canSave || !geometry) return
    setServerError(null)
    create.mutate(
      {
        ad: ad.trim(),
        urun,
        cesit: cesit.trim() || null,
        dikimYili: yearNumber,
        geometry,
        il: il.trim() || null,
        ilce: ilce.trim() || null,
      },
      {
        onSuccess: (garden) => {
          toast.show(`“${garden.ad}” kaydedildi.`)
          resetFlow()
          nav.open(garden.id)
          focusGarden(garden)
        },
        onError: (err) => setServerError(describeError(err)),
      },
    )
  }

  return (
    <form onSubmit={save} className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-app-border px-3 py-3">
        <IconButton label="Vazgeç ve listeye dön" onClick={resetFlow}>
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </IconButton>
        <h2 className="font-display text-h2 text-app-text">Yeni bahçe</h2>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <TextField
          label="Bahçe adı"
          autoFocus
          required
          maxLength={120}
          value={ad}
          onChange={(e) => setAd(e.target.value)}
          placeholder="Örn. Yeni parsel limonları"
        />

        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Ürün" value={urun} onChange={(e) => setUrun(e.target.value as Urun)}>
            {PRODUCTS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </SelectField>
          <TextField
            label="Dikim yılı (isteğe bağlı)"
            inputMode="numeric"
            value={dikimYili}
            onChange={(e) => setDikimYili(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="2015"
            error={yearInvalid ? 'Dikim yılı geçerli bir yıl olmalı.' : null}
          />
        </div>

        <TextField
          label="Çeşit (isteğe bağlı)"
          maxLength={100}
          value={cesit}
          onChange={(e) => setCesit(e.target.value)}
          placeholder="Örn. Interdonato"
        />

        <div>
          <span className="mb-1.5 block text-small font-semibold text-app-text">Alan</span>
          <div
            aria-live="polite"
            className="flex min-h-11 items-center rounded-md border border-app-border bg-app-card px-3 text-body text-app-text"
          >
            {measure.status === 'loading' && (
              <span className="flex items-center gap-2 text-app-text-muted">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Hesaplanıyor…
              </span>
            )}
            {measure.status === 'ok' && <span className="tabular font-semibold">{formatDecare(measure.dekar)}</span>}
            {measure.status === 'error' && <span className="text-app-text-dim">—</span>}
          </div>
          <p className="mt-1 text-caption text-app-text-dim">Alan sunucuda sınırdan otomatik hesaplanır.</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="İl"
            maxLength={100}
            value={il}
            onChange={(e) => {
              adminTouched.current = true
              setIl(e.target.value)
            }}
          />
          <TextField
            label="İlçe"
            maxLength={100}
            value={ilce}
            onChange={(e) => {
              adminTouched.current = true
              setIlce(e.target.value)
            }}
          />
        </div>

        {(measure.status === 'error' || serverError) && (
          <p role="alert" className="flex items-start gap-2 rounded-md bg-app-danger/10 px-3 py-2.5 text-small text-app-danger">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {serverError ?? (measure.status === 'error' ? measure.message : '')}
          </p>
        )}
      </div>

      <div className="flex gap-2 border-t border-app-border p-3">
        <Button onClick={resetFlow} disabled={create.isPending} className="flex-1">
          İptal
        </Button>
        <Button type="submit" variant="primary" disabled={!canSave} loading={create.isPending} className="flex-1">
          {create.isPending ? 'Kaydediliyor…' : 'Kaydet'}
        </Button>
      </div>
    </form>
  )
}
