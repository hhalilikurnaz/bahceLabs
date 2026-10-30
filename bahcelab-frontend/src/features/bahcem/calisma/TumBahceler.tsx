import { Link, useNavigate } from 'react-router-dom'
import { useEffect, useMemo } from 'react'
import { useAuth } from '@/features/auth/useAuth'
import { ErrorState, Skeleton } from '@/components/ui'
import { useGardenTiers } from '../api/overviewApi'
import { type Garden } from '../api/types'
import { useGardens } from '../api/useGardens'
import { BosDurum } from '../kabuk/BosDurum'
import { listeKarar } from '../lib/karar'
import { BahceSatiri } from './BahceSatiri'
import { useCalismaStore } from './calismaStore'
import { dekar } from '../lib/format'
import { unionBounds, geometryBounds } from '../lib/geo'
import { KADEME_HEX, type Kademe } from '../lib/kademe'
import { NEW_GARDEN_PATH, gardenPath } from '../lib/routes'
import { MapProvider } from '../map/MapProvider'
import { useMap } from '../map/useMap'
import { KomsuEtiketleri } from './harita/KomsuEtiketleri'
import { ODAK_PAYI } from './harita/haritaYardim'
import { HARITA } from '../map/haritaRenkleri'


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
    if (!map.getLayer('tb-fill')) map.addLayer({ id: 'tb-fill', type: 'fill', source: 'tb', paint: { 'fill-color': HARITA.r000000, 'fill-opacity': 0 } }) // dolgu yok (uydu görünür); yalnız tıklama hedefi
    if (!map.getLayer('tb-hale')) map.addLayer({ id: 'tb-hale', type: 'line', source: 'tb', paint: { 'line-color': HARITA.rffffff, 'line-width': 5, 'line-opacity': 0.9 } })
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
  const { data: gardens, isLoading, isError, error, refetch, isFetching } = useGardens()
  const { data: tiers } = useGardenTiers()
  const panelPx = useCalismaStore((s) => s.panelPx)
  if (isLoading || !user) return <div className="grid gap-3 p-6" role="status" aria-label="Bahçeler yükleniyor"><Skeleton className="m-skeleton h-28" /><Skeleton className="m-skeleton h-36" /><Skeleton className="m-skeleton h-36" /></div>
  // Hata ASLA «bahçe yok» olarak çizilmez: veri yokken hata varsa hata gösterilir (ağ ↔ sunucu ayrı mesaj)
  if (isError && !gardens) return <ErrorState title="Bahçeleriniz alınamadı" error={error} retrying={isFetching} onRetry={() => void refetch()} className="py-16" />
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
      <aside aria-label="Bahçe listesi" className="flex min-h-0 shrink-0 flex-col overflow-y-auto bg-app-canvas max-[900px]:!w-full max-[900px]:flex-1" style={{ width: panelPx, maxWidth: 'calc(100% - 360px)' }} data-testid="bahce-listesi-paneli">
        <div className="grid gap-3 p-3">
          <section className="rounded-md border border-app-border bg-app-card p-5">
            <h1 className="text-h1 font-semibold text-app-text" data-testid="liste-karar">{listeKarar(gardens.map((g) => tiers?.get(g.id))) ?? 'Bahçeler'}</h1>
            <p className="mt-1 text-small text-app-text-dim">{gardens.length} bahçe · {dekar(gardens.reduce((t, g) => t + g.alanDekar, 0))}</p>
            <Link to={NEW_GARDEN_PATH} data-testid="bahce-ekle" className="mt-3 inline-flex h-11 items-center rounded-md bg-app-primary px-4 text-body font-semibold text-app-on-primary hover:bg-app-primary-hover">+ Bahçe ekle</Link>
          </section>
          <ul className="grid gap-3" data-testid="bahce-listesi">
            {gardens.map((g) => <BahceSatiri key={g.id} garden={g} tier={tiers?.get(g.id)} />)}
          </ul>
        </div>
      </aside>
    </div>
  )
}
