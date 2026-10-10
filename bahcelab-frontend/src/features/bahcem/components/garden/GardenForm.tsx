import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Loader2, TriangleAlert } from 'lucide-react'
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

const field =
  'h-10 w-full rounded-xl border border-app-border bg-app-bg/60 px-3 text-[14px] text-app-text outline-none transition-colors placeholder:text-app-text-dim focus:border-app-accent'
const label = 'mb-1.5 block text-[12px] font-medium text-app-text-muted'

/** Sınır hazır olduktan sonra bahçe bilgilerini toplayıp kaydeder (sol panelde açılır). */
export function GardenForm() {
  const draft = useBahcemStore((s) => s.draft)
  const resetFlow = useBahcemStore((s) => s.resetFlow)
  const selectGarden = useBahcemStore((s) => s.selectGarden)
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
      .catch(() => {})
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
          selectGarden(garden.id)
          focusGarden(garden)
        },
        onError: (err) => setServerError(describeError(err)),
      },
    )
  }

  return (
    <form onSubmit={save} className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-app-border px-3 py-3">
        <button
          type="button"
          onClick={resetFlow}
          aria-label="Vazgeç ve listeye dön"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-app-text-muted transition-colors hover:bg-app-card hover:text-app-text"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
        </button>
        <h2 className="text-[15px] font-semibold text-app-text">Yeni bahçe</h2>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <div>
          <label htmlFor="garden-ad" className={label}>
            Bahçe adı
          </label>
          <input
            id="garden-ad"
            autoFocus
            required
            maxLength={120}
            value={ad}
            onChange={(e) => setAd(e.target.value)}
            placeholder="Örn. Yeni parsel limonları"
            className={field}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="garden-urun" className={label}>
              Ürün
            </label>
            <select
              id="garden-urun"
              value={urun}
              onChange={(e) => setUrun(e.target.value as Urun)}
              className={field}
            >
              {PRODUCTS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="garden-yil" className={label}>
              Dikim yılı <span className="text-app-text-dim">(isteğe bağlı)</span>
            </label>
            <input
              id="garden-yil"
              inputMode="numeric"
              value={dikimYili}
              onChange={(e) => setDikimYili(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="2015"
              className={field}
            />
          </div>
        </div>

        <div>
          <label htmlFor="garden-cesit" className={label}>
            Çeşit <span className="text-app-text-dim">(isteğe bağlı)</span>
          </label>
          <input
            id="garden-cesit"
            maxLength={100}
            value={cesit}
            onChange={(e) => setCesit(e.target.value)}
            placeholder="Örn. Interdonato"
            className={field}
          />
        </div>

        <div>
          <span className={label}>Alan</span>
          <div
            aria-live="polite"
            className="flex h-10 items-center rounded-xl border border-app-border bg-app-card px-3 text-[14px] text-app-text"
          >
            {measure.status === 'loading' && (
              <span className="flex items-center gap-2 text-app-text-muted">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Hesaplanıyor…
              </span>
            )}
            {measure.status === 'ok' && <span className="font-medium">{formatDecare(measure.dekar)}</span>}
            {measure.status === 'error' && <span className="text-app-text-dim">—</span>}
          </div>
          <p className="mt-1 text-[11px] text-app-text-dim">Alan sunucuda sınırdan otomatik hesaplanır.</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="garden-il" className={label}>
              İl
            </label>
            <input
              id="garden-il"
              maxLength={100}
              value={il}
              onChange={(e) => {
                adminTouched.current = true
                setIl(e.target.value)
              }}
              className={field}
            />
          </div>
          <div>
            <label htmlFor="garden-ilce" className={label}>
              İlçe
            </label>
            <input
              id="garden-ilce"
              maxLength={100}
              value={ilce}
              onChange={(e) => {
                adminTouched.current = true
                setIlce(e.target.value)
              }}
              className={field}
            />
          </div>
        </div>

        {(measure.status === 'error' || serverError) && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-xl bg-app-danger/10 px-3 py-2.5 text-[13px] leading-snug text-app-danger"
          >
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {serverError ?? (measure.status === 'error' ? measure.message : '')}
          </p>
        )}
        {yearInvalid && (
          <p role="alert" className="text-[12px] text-app-danger">
            Dikim yılı geçerli bir yıl olmalı.
          </p>
        )}
      </div>

      <div className="flex gap-2 border-t border-app-border p-3">
        <button
          type="button"
          onClick={resetFlow}
          disabled={create.isPending}
          className="h-10 flex-1 rounded-xl border border-app-border text-[14px] font-medium text-app-text transition-colors hover:bg-app-card"
        >
          İptal
        </button>
        <button
          type="submit"
          disabled={!canSave}
          className="h-10 flex-1 rounded-xl bg-app-accent text-[14px] font-semibold text-app-bg transition-colors hover:bg-app-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
        >
          {create.isPending ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
      </div>
    </form>
  )
}
