import { useEffect, useRef, useState } from 'react'
import { Loader2, TriangleAlert, X } from 'lucide-react'
import { Button, IconButton, SelectField, TextField } from '@/components/ui'
import { describeError, gardensApi } from '../../api/gardensApi'
import { IRRIGATION_SYSTEMS, PRODUCTS, type GardenGeometry, type SulamaSistemi, type Urun } from '../../api/types'
import { useCreateGarden } from '../../api/useGardens'
import { useGardenNav } from '../../hooks/useGardenNav'
import { OverlapWarning } from './OverlapWarning'
import { VarietyField } from './VarietyField'
import { varietyPayload, type VarietyValue } from '../../lib/variety'
import { GARDEN_LIMITS } from '../../lib/config'
import { areaProblem, parseOptionalInt, validateGardenFields, type GardenFieldErrors } from '../../lib/gardenFields'
import { boundsCenter, formatDecare, geometryBounds, largestOuterRing, silhouettePath } from '../../lib/geo'
import { reverseGeocode } from '../../map/geocoding'
import { useFocusGarden } from '../../map/useFocusGarden'
import { useBahcemStore } from '../../stores/bahcemStore'
import { useToast } from '../layout/toastContext'

type Measure = { status: 'loading' } | { status: 'ok'; dekar: number } | { status: 'error'; message: string }

function Preview({ geometry }: { geometry: GardenGeometry | null }) {
  const path = geometry ? silhouettePath(largestOuterRing(geometry), 80, 6) : ''
  return (
    <svg viewBox="0 0 80 80" className="h-20 w-20 shrink-0 rounded-md bg-thumb" role="img" aria-label="Sınır önizlemesi" data-testid="boundary-preview">
      {path ? <path d={path} className="fill-white/20 stroke-white" strokeWidth={1.5} strokeLinejoin="round" /> : null}
    </svg>
  )
}

/**
 * Yeni bahçe formu (sağ panel): haritada çizim sürerken de açıktır, alan canlı güncellenir.
 * Sınır "Sınır tamam" ile forma aktarılınca (mode 'form') kaydedilebilir.
 */
export function GardenForm() {
  const mode = useBahcemStore((s) => s.mode)
  const draft = useBahcemStore((s) => s.draft)
  const liveArea = useBahcemStore((s) => s.liveAreaDekar)
  const liveGeometry = useBahcemStore((s) => s.liveGeometry)
  const resetFlow = useBahcemStore((s) => s.resetFlow)
  const watchProcessing = useBahcemStore((s) => s.watchProcessing)
  const nav = useGardenNav()
  const toast = useToast()
  const create = useCreateGarden()
  const { focusGarden } = useFocusGarden()

  const [ad, setAd] = useState(draft?.suggestedName ?? '')
  const [urun, setUrun] = useState<Urun>('limon')
  const [variety, setVariety] = useState<VarietyValue>({ kod: '', metin: '' })
  const cesit = variety.metin
  const [dikimYili, setDikimYili] = useState('')
  const [agacSayisi, setAgacSayisi] = useState('')
  const [sulama, setSulama] = useState<SulamaSistemi | ''>('')
  const [il, setIl] = useState('')
  const [ilce, setIlce] = useState('')
  const [measured, setMeasured] = useState<{ for: unknown; result: Measure } | null>(null)
  const [errors, setErrors] = useState<GardenFieldErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const adminTouched = useRef(false)

  const geometry = draft?.geometry ?? null
  const ready = mode === 'form' && geometry !== null
  const measure: Measure = measured && measured.for === geometry ? measured.result : { status: 'loading' }

  // Alan sunucuda hesaplanır; geçersiz sınır burada hemen bildirilir
  useEffect(() => {
    if (!geometry) return
    let cancelled = false
    gardensApi
      .measure(geometry)
      .then((m) => !cancelled && setMeasured({ for: geometry, result: { status: 'ok', dekar: m.alanDekar } }))
      .catch((err) => !cancelled && setMeasured({ for: geometry, result: { status: 'error', message: describeError(err) } }))
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
        if (!(error instanceof DOMException && error.name === 'AbortError')) console.warn('[BahçeLab] İl/ilçe bulunamadı', error)
      })
    return () => controller.abort()
  }, [geometry])

  const dekar = ready ? (measure.status === 'ok' ? measure.dekar : null) : liveArea
  const areaError = ready && measure.status === 'error' ? measure.message : areaProblem(dekar)

  function save(e: React.FormEvent) {
    e.preventDefault()
    if (!ready || !geometry) return
    const found = validateGardenFields({ ad, cesit, dikimYili, agacSayisi }, new Date().getFullYear())
    setErrors(found)
    setServerError(null)
    if (Object.keys(found).length > 0 || areaError) return
    create.mutate(
      {
        ad: ad.trim(),
        urun,
        ...varietyPayload(variety),
        dikimYili: parseOptionalInt(dikimYili),
        agacSayisi: parseOptionalInt(agacSayisi),
        sulamaSistemi: sulama || null,
        geometry,
        il: il.trim() || null,
        ilce: ilce.trim() || null,
      },
      {
        onSuccess: (garden) => {
          toast.show(`“${garden.ad}” kaydedildi. Uydu verisi hazırlanıyor…`)
          watchProcessing(garden.id, garden.ad)
          resetFlow()
          nav.open(garden.id)
          focusGarden(garden)
        },
        onError: (err) => setServerError(describeError(err)),
      },
    )
  }

  return (
    <form onSubmit={save} noValidate className="flex min-h-0 flex-1 flex-col" data-testid="garden-form">
      <div className="flex items-center justify-between gap-2 border-b border-app-border px-4 py-3">
        <h2 className="font-display text-h2 text-app-text">Yeni bahçe</h2>
        <IconButton label="Vazgeç ve kapat" onClick={resetFlow}>
          <X className="h-5 w-5" aria-hidden />
        </IconButton>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <div className="flex items-center gap-3 rounded-md border border-app-border bg-app-card p-3">
          <Preview geometry={ready ? geometry : liveGeometry} />
          <div className="min-w-0" aria-live="polite">
            <p className="text-caption font-semibold uppercase tracking-wide text-app-text-dim">Alan</p>
            <p className="tabular font-display text-h1 text-app-text" data-testid="form-area">
              {dekar !== null ? formatDecare(dekar) : ready && measure.status === 'loading' ? <Loader2 className="inline h-5 w-5 animate-spin" aria-hidden /> : '—'}
            </p>
            <p className="text-caption text-app-text-dim">{ready ? 'Sunucuda sınırdan hesaplandı.' : 'Çizdikçe güncellenir (yaklaşık).'}</p>
          </div>
        </div>
        {areaError && (
          <p role="alert" data-testid="area-error" className="flex items-start gap-2 rounded-md bg-app-danger/10 px-3 py-2.5 text-small text-app-danger">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {areaError}
          </p>
        )}
        {ready && <OverlapWarning geometry={geometry} />}
        {!ready && (
          <p className="rounded-md bg-app-accent-soft px-3 py-2.5 text-small text-app-text">
            Önce haritada sınırı çizin, ardından <strong>“Sınır tamam”</strong>a basın. Bilgileri şimdiden doldurabilirsiniz.
          </p>
        )}

        <TextField
          label="Bahçe adı"
          autoFocus
          required
          maxLength={GARDEN_LIMITS.nameMax}
          value={ad}
          onChange={(e) => setAd(e.target.value)}
          placeholder="Örn. Yeni parsel limonları"
          error={errors.ad}
        />

        <div className="grid grid-cols-2 gap-3">
          <SelectField
            label="Ürün"
            value={urun}
            onChange={(e) => {
              setUrun(e.target.value as Urun)
              setVariety((v) => (v.kod === 'diger' ? v : { kod: '', metin: '' })) // çeşit listesi ürüne bağlıdır
            }}
          >
            {PRODUCTS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </SelectField>
          <VarietyField urun={urun} value={variety} onChange={setVariety} error={errors.cesit} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Dikim yılı (isteğe bağlı)"
            inputMode="numeric"
            value={dikimYili}
            onChange={(e) => setDikimYili(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="2015"
            error={errors.dikimYili}
          />
          <TextField
            label="Ağaç sayısı (isteğe bağlı)"
            inputMode="numeric"
            value={agacSayisi}
            onChange={(e) => setAgacSayisi(e.target.value.replace(/\D/g, '').slice(0, 7))}
            placeholder="500"
            error={errors.agacSayisi}
          />
        </div>

        <SelectField label="Sulama sistemi (isteğe bağlı)" value={sulama} onChange={(e) => setSulama(e.target.value as SulamaSistemi | '')} hint="Sulama önerisinde verimlilik için kullanılır.">
          <option value="">Seçilmedi</option>
          {IRRIGATION_SYSTEMS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </SelectField>

        <div className="grid grid-cols-2 gap-3">
          <TextField label="İl" maxLength={100} value={il} onChange={(e) => { adminTouched.current = true; setIl(e.target.value) }} />
          <TextField label="İlçe" maxLength={100} value={ilce} onChange={(e) => { adminTouched.current = true; setIlce(e.target.value) }} />
        </div>

        {serverError && (
          <p role="alert" className="flex items-start gap-2 rounded-md bg-app-danger/10 px-3 py-2.5 text-small text-app-danger">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {serverError}
          </p>
        )}
      </div>

      <div className="flex gap-2 border-t border-app-border p-3">
        <Button onClick={resetFlow} disabled={create.isPending} className="flex-1">
          İptal
        </Button>
        <Button type="submit" variant="primary" disabled={!ready} loading={create.isPending} className="flex-1">
          {create.isPending ? 'Kaydediliyor…' : 'Kaydet'}
        </Button>
      </div>
    </form>
  )
}
