import { Link, useNavigate } from 'react-router-dom'
import { useEffect, useMemo } from 'react'
import { useAuth } from '@/features/auth/useAuth'
import { Skeleton } from '@/components/ui'
import { useGardenTiers } from '../api/overviewApi'
import { PRODUCTS, type Garden } from '../api/types'
import { useGardens } from '../api/useGardens'
import { BosDurum } from '../kabuk/BosDurum'
import { dekar } from '../lib/format'
import { unionBounds, geometryBounds } from '../lib/geo'
import { KADEME_HEX, KADEME_META, type Kademe } from '../lib/kademe'
import { NEW_GARDEN_PATH, gardenPath } from '../lib/routes'
import { MapProvider } from '../map/MapProvider'
import { useMap } from '../map/useMap'
import { KomsuEtiketleri } from './harita/KomsuEtiketleri'
import { ODAK_PAYI } from './harita/haritaYardim'

const urunAdi = (v: string) => PRODUCTS.find((p) => p.value === v)?.label ?? v

/** Tüm bahçelerin çokgenleri (kademe rengiyle) ve odak: tıklayınca bahçeye gider. */
function TumBahcelerKatmani({ gardens, tiers }: { gardens: Garden[]; tiers: Map<string, Kademe | 'veri_yok'> | undefined }) {
  const { map, styleVersion } = useMap()
  const navigate = useNavigate()
  const data = useMemo(
    () => ({ type: 'FeatureCollection' as const, features: gardens.map((g) => ({ type: 'Feature' as const, properties: { id: g.id, renk: KADEME_HEX[tiers?.get(g.id) ?? 'veri_yok'] }, geometry: g.geometry })) }),
    [gardens, tiers],
  )
  useEffect(() => {
    if (!map || styleVersion === 0) return
    const src = map.getSource('tb') as { setData?: (d: GeoJSON.GeoJSON) => void } | undefined
    if (src?.setData) src.setData(data)
    else map.addSource('tb', { type: 'geojson', data })
    if (!map.getLayer('tb-fill')) map.addLayer({ id: 'tb-fill', type: 'fill', source: 'tb', paint: { 'fill-color': '#000000', 'fill-opacity': 0 } }) // dolgu yok (uydu görünür); yalnız tıklama hedefi
    if (!map.getLayer('tb-hale')) map.addLayer({ id: 'tb-hale', type: 'line', source: 'tb', paint: { 'line-color': '#ffffff', 'line-width': 5, 'line-opacity': 0.9 } })
    if (!map.getLayer('tb-line')) map.addLayer({ id: 'tb-line', type: 'line', source: 'tb', paint: { 'line-color': ['get', 'renk'], 'line-width': 2 } })
  }, [map, styleVersion, data])
  useEffect(() => {
    if (!map || gardens.length === 0) return
    const box = unionBounds(gardens.map((g) => geometryBounds(g.geometry)))
    if (box) map.fitBounds(box, { padding: ODAK_PAYI, maxZoom: 17, duration: 0 })
  }, [map, gardens])
  useEffect(() => {
    if (!map) return
    const open = (e: { features?: { properties?: Record<string, unknown> }[] }) => {
      const id = e.features?.[0]?.properties?.id
      if (typeof id === 'string') navigate(gardenPath(id))
    }
    map.on('click', 'tb-fill', open)
    return () => void map.off('click', 'tb-fill', open)
  }, [map, navigate])
  return <KomsuEtiketleri others={gardens} kademeler={tiers} />
}

/** `/bahceler`: haritada tüm bahçeler + liste (ad · ürün · dekar · kademe) + «+ Bahçe ekle». Bahçe yoksa boş durum. */
export function TumBahceler() {
  const { user } = useAuth()
  const { data: gardens, isLoading } = useGardens()
  const { data: tiers } = useGardenTiers()
  if (isLoading || !user) return <Skeleton className="m-6 h-40" aria-label="Bahçeler yükleniyor" />
  if (!gardens || gardens.length === 0) {
    return (
      <BosDurum gravur="agac" baslik="İlk bahçenizi ekleyin" fayda="Sınırı haritada çizin ya da KML/KMZ/GeoJSON dosyası yükleyin; uydu görüntüleri birkaç dakikada işlenir." testId="bahce-yok">
        <Link to={NEW_GARDEN_PATH} className="inline-flex h-10 items-center rounded-md bg-app-primary px-4 text-[14px] font-semibold text-app-on-primary">Bahçe ekle</Link>
      </BosDurum>
    )
  }
  return (
    <div className="flex min-h-0 flex-1 max-[900px]:flex-col" data-testid="tum-bahceler">
      <div className="relative min-h-[340px] flex-[1_1_64%] border-r border-app-border max-[900px]:h-[56vh] max-[900px]:flex-none" data-testid="tum-bahceler-harita">
        <MapProvider userId={user.id}>
          <TumBahcelerKatmani gardens={gardens} tiers={tiers} />
        </MapProvider>
      </div>
      <aside aria-label="Bahçe listesi" className="flex min-h-0 min-w-[360px] flex-[1_1_36%] flex-col overflow-y-auto bg-app-panel max-[900px]:min-w-0">
        <div className="flex items-center justify-between gap-3 border-b border-app-border px-5 py-4">
          <div>
            <h1 className="text-[20px] font-bold leading-tight">Bahçeler</h1>
            <p className="num text-[12.5px] text-app-text-muted">{gardens.length} bahçe · {dekar(gardens.reduce((t, g) => t + g.alanDekar, 0))}</p>
          </div>
          <Link to={NEW_GARDEN_PATH} data-testid="bahce-ekle" className="flex h-11 items-center rounded-md bg-app-primary px-4 text-[14px] font-semibold text-app-on-primary">+ Bahçe ekle</Link>
        </div>
        <ul className="divide-y divide-app-border" data-testid="bahce-listesi">
          {gardens.map((g) => {
            const tier = tiers?.get(g.id)
            const meta = tier && tier !== 'veri_yok' ? KADEME_META[tier] : null
            return (
              <li key={g.id}>
                <Link to={gardenPath(g.id)} data-testid="bahce-satiri" className="flex min-h-14 items-center gap-3 px-5 py-3 hover:bg-app-card-hover">
                  <div className="min-w-0 flex-1">
                    <b className="block truncate text-[15px]">{g.ad}</b>
                    <span className="num block truncate text-[12.5px] text-app-text-muted">{[urunAdi(g.urun), dekar(g.alanDekar)].join(' · ')}</span>
                  </div>
                  <span className="flex items-center gap-1.5 text-[13px] font-semibold" data-testid="bahce-kademe" style={{ color: meta?.renk }}>
                    <span aria-hidden>{meta?.isaret ?? '–'}</span>
                    {meta?.ad ?? 'Veri yok'}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </aside>
    </div>
  )
}
