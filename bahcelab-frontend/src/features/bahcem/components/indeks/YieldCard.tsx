import { Loader2 } from 'lucide-react'
import { useYieldZones, type YieldClass } from '../../api/indeksApi'
import { describeError } from '../../api/gardensApi'
import { formatDate } from '../../lib/dates'
import { formatDecare } from '../../lib/geo'
import { INDEX_DEFS, YIELD_COLORS, formatIndexValue } from '../../lib/indices'
import { useBahcemStore } from '../../stores/bahcemStore'

const ORDER: YieldClass[] = ['yuksek', 'orta', 'dusuk']

/** Verimlilik bölgeleri: geçmiş görüntülerin ortalamasından düşük / orta / yüksek (haritada aç/kapat). */
export function YieldCard({ gardenId }: { gardenId: string }) {
  const acik = useBahcemStore((s) => s.verimlilik)
  const indeks = useBahcemStore((s) => s.verimlilikIndeksi)
  const setAcik = useBahcemStore((s) => s.setVerimlilik)
  const setIndeks = useBahcemStore((s) => s.setVerimlilikIndeksi)
  const { data, isLoading, error } = useYieldZones(gardenId, indeks, true)

  const features = data?.bolgeler.features ?? []

  return (
    <section className="space-y-3 rounded-2xl bg-app-card p-3.5" aria-label="Verimlilik bölgeleri">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-small font-semibold text-app-text">Verimlilik bölgeleri</h3>
          <p className="mt-0.5 text-caption leading-snug text-app-text-muted">
            Tüm geçerli geçmiş görüntülerin ortalamasından bahçe 3 bölgeye ayrılır; ileride blok bölmeye öneri olacak.
          </p>
        </div>
        <label className="relative inline-flex shrink-0 cursor-pointer items-center" title="Haritada göster">
          <input
            type="checkbox"
            checked={acik}
            onChange={(e) => setAcik(e.target.checked)}
            disabled={Boolean(error) || isLoading}
            className="peer sr-only"
            aria-label="Verimlilik bölgelerini haritada göster"
          />
          <span className="h-5 w-9 rounded-full bg-app-border transition-colors peer-checked:bg-app-accent peer-disabled:opacity-40 peer-focus-visible:outline-2 peer-focus-visible:outline-app-accent" />
          <span className="absolute left-0.5 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-4" />
        </label>
      </div>

      <div role="radiogroup" aria-label="Verimlilik hesabında kullanılan indeks" className="flex gap-1.5">
        {(['ndvi', 'msavi'] as const).map((id) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={indeks === id}
            onClick={() => setIndeks(id)}
            className={`h-7 rounded-full border px-3 text-caption font-medium transition-colors ${
              indeks === id ? 'border-app-accent bg-app-accent-soft text-app-accent' : 'border-app-border text-app-text-muted hover:text-app-text'
            }`}
          >
            {INDEX_DEFS[id].ad}
          </button>
        ))}
      </div>

      {isLoading && (
        <p className="flex items-center gap-2 text-caption text-app-text-muted">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Bölgeler hesaplanıyor…
        </p>
      )}
      {error && <p className="text-caption leading-snug text-app-text-muted">{describeError(error)}</p>}

      {data && (
        <>
          <ul className="space-y-1.5">
            {ORDER.map((cls) => {
              const feature = features.find((f) => f.properties.sinif === cls)
              if (!feature) return null
              const p = feature.properties
              return (
                <li key={cls} className="flex items-center gap-2.5 text-caption">
                  <i className="h-3 w-3 shrink-0 rounded-sm" style={{ background: YIELD_COLORS[cls] }} aria-hidden />
                  <span className="w-14 font-medium text-app-text">{p.etiket}</span>
                  <span className="flex-1 text-app-text-muted">{formatDecare(p.alan_m2 / 1000)}</span>
                  <span className="w-10 text-right font-medium text-app-text">%{Math.round(p.pay * 100)}</span>
                  <span className="w-10 text-right text-app-text-dim">{formatIndexValue(indeks, p.ortalama)}</span>
                </li>
              )
            })}
          </ul>
          <p className="text-caption text-app-text-dim">
            {data.gozlemSayisi} görüntü · {formatDate(data.ilkTarih)} – {formatDate(data.sonTarih)}
          </p>
        </>
      )}
    </section>
  )
}
