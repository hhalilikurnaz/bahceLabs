import { Card, Chip, Skeleton, Switch } from '@/components/ui'
import { describeError } from '../../api/gardensApi'
import { useYieldZones, type YieldClass } from '../../api/indeksApi'
import { formatDate } from '../../lib/dates'
import { formatDecare } from '../../lib/geo'
import { ZONES } from '../../lib/config'
import { isHomogeneous } from '../../lib/zones'
import { INDEX_DEFS, YIELD_COLORS, formatIndexValue } from '../../lib/indices'
import { useBahcemStore } from '../../stores/bahcemStore'

const ORDER: YieldClass[] = ['yuksek', 'orta', 'dusuk']
const COMMENT: Record<YieldClass, string> = {
  yuksek: 'Geçmişte güçlü seyretmiş kesim',
  orta: 'Ortalama seyretmiş kesim',
  dusuk: 'Geçmişte zayıf seyretmiş kesim; nedenini yerinde kontrol edin',
}

/** Bölgeler: geçmiş görüntülerin ortalamasına göre bahçe 3 bölgeye ayrılır (haritada aç/kapat). */
export function YieldCard({ gardenId }: { gardenId: string }) {
  const acik = useBahcemStore((s) => s.verimlilik)
  const indeks = useBahcemStore((s) => s.verimlilikIndeksi)
  const setAcik = useBahcemStore((s) => s.setVerimlilik)
  const setIndeks = useBahcemStore((s) => s.setVerimlilikIndeksi)
  const { data, isLoading, error } = useYieldZones(gardenId, indeks, true)

  const features = data?.bolgeler.features ?? []
  const homogeneous = features.length > 0 && isHomogeneous(features.map((f) => f.properties.ortalama), indeks, ZONES.homogeneityRangeShare)

  return (
    <Card className="space-y-3" aria-label="Bölgeler" data-testid="yield-card">
      <div>
        <h3 className="font-display text-h2 text-app-text">Bölgeler</h3>
        <p className="text-small text-app-text-muted">
          Geçmiş görüntülerin ortalamasına göre bahçe, güçlü ve zayıf kesimlere ayrılır.
        </p>
      </div>
      <Switch label="Haritada göster" checked={acik} onChange={setAcik} disabled={Boolean(error) || isLoading} />

      <div role="group" aria-label="Bölgelerin hesaplandığı parametre" className="flex flex-wrap gap-2">
        {(['ndvi', 'msavi'] as const).map((id) => (
          <Chip key={id} selected={indeks === id} onClick={() => setIndeks(id)}>
            {INDEX_DEFS[id].ad}
          </Chip>
        ))}
      </div>

      {isLoading && <Skeleton className="h-24" />}
      {error && <p className="text-small text-app-text-muted">{describeError(error)}</p>}

      {data && (
        <>
          {homogeneous ? (
            <p className="text-body text-app-text-muted" data-testid="homogeneous-note">Bahçe homojen – belirgin güçlü/zayıf kesim yok.</p>
          ) : (
            <ul className="space-y-2">
              {ORDER.map((cls) => {
                const feature = features.find((f) => f.properties.sinif === cls)
                if (!feature) return null
                const p = feature.properties
                return (
                  <li key={cls} className="flex items-start gap-3 rounded-md bg-app-text/5 p-2.5">
                    <i className="mt-1 h-3.5 w-3.5 shrink-0 rounded-sm" style={{ background: YIELD_COLORS[cls] }} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <span className="text-body font-semibold text-app-text">{p.etiket}</span>
                        <span className="tabular text-small text-app-text-muted">
                          {formatDecare(p.alan_m2 / 1000)} · %{Math.round(p.pay * 100)}
                        </span>
                      </span>
                      <span className="block text-small text-app-text-dim">
                        {COMMENT[cls]} · ort. {formatIndexValue(indeks, p.ortalama)}
                      </span>
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
          <p className="text-caption text-app-text-dim">
            {data.gozlemSayisi} görüntü · {formatDate(data.ilkTarih)} – {formatDate(data.sonTarih)}
          </p>
        </>
      )}
    </Card>
  )
}
