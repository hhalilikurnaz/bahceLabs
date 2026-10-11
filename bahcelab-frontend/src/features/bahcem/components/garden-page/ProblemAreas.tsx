import { Crosshair } from 'lucide-react'
import { Badge, Button, Card, Skeleton, type BadgeTone } from '@/components/ui'
import { describeError } from '../../api/gardensApi'
import { useZones } from '../../api/indeksApi'
import { useIndexView } from '../../hooks/useIndexView'
import { formatDate } from '../../lib/dates'
import { MAP } from '../../lib/config'
import { formatDecare, geometryBounds } from '../../lib/geo'
import { INDEX_DEFS, formatIndexValue, isIndexId } from '../../lib/indices'
import { SEVERITY_LABEL, SEVERITY_ORDER, zoneSeverity, type Severity } from '../../lib/zones'
import { useFocusPadding } from '../../map/useFocusGarden'
import { useMap } from '../../map/useMap'
import type { GardenGeometry } from '../../api/types'

const TONE: Record<Severity, BadgeTone> = { yuksek: 'danger', orta: 'warn', dusuk: 'neutral' }

/** Sorunlu alanlar: alan, şiddet ve parametre; "Haritada göster" o alana odaklanır. */
export function ProblemAreas() {
  const { map } = useMap()
  const padding = useFocusPadding()
  const { gardenId, katman, active } = useIndexView()
  const indeks = isIndexId(katman) ? katman : 'ndvi'
  const { data, isLoading, error } = useZones(gardenId, indeks, active?.tarih ?? null)
  const median = active?.indeksler[indeks]?.medyan

  const items = (data?.features ?? [])
    .map((feature, index) => ({
      key: index,
      area: feature.properties.alan_m2,
      mean: feature.properties.ortalama,
      severity: median === undefined ? ('dusuk' as const) : zoneSeverity(indeks, feature.properties.ortalama, median),
      geometry: feature.geometry,
    }))
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || b.area - a.area)

  function focus(geometry: GeoJSON.Geometry) {
    if (!map || (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon')) return
    map.fitBounds(geometryBounds(geometry as GardenGeometry), { padding: padding(), maxZoom: MAP.focusMaxZoom, duration: 900 })
  }

  return (
    <Card className="space-y-3" aria-label="Sorunlu alanlar" data-testid="problem-areas">
      <div>
        <h3 className="font-display text-h2 text-app-text">Sorunlu alanlar</h3>
        <p className="text-small text-app-text-muted">
          {active
            ? `${INDEX_DEFS[indeks].ad} · ${formatDate(active.tarih)} görüntüsünde bahçe ortalamasının belirgin altında kalan yerler.`
            : 'Uydu görüntüsü geldiğinde burada listelenir.'}
        </p>
      </div>
      {!active ? (
        <p className="text-small text-app-text-dim">Henüz kullanılabilir görüntü yok.</p>
      ) : isLoading ? (
        <Skeleton className="h-20" />
      ) : error ? (
        <p role="alert" className="text-small text-app-danger">
          {describeError(error)}
        </p>
      ) : items.length === 0 ? (
        <p className="text-body text-app-text-muted">Bu görüntüde belirgin sorunlu alan görünmüyor.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item, order) => (
            <li key={item.key} className="flex items-center justify-between gap-3 rounded-md bg-app-text/5 p-2.5">
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2 text-body font-semibold text-app-text">
                  Alan {order + 1}
                  <Badge tone={TONE[item.severity]}>{SEVERITY_LABEL[item.severity]}</Badge>
                </span>
                <span className="tabular block text-small text-app-text-muted">
                  {formatDecare(item.area / 1000)} · ort. {formatIndexValue(indeks, item.mean)}
                </span>
              </span>
              <Button icon={<Crosshair className="h-4 w-4" aria-hidden />} onClick={() => focus(item.geometry)}>
                Haritada göster
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
