import { X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useMultiyear } from '../../api/multiyearApi'
import { degisim, gunAy, kaynakSatiri, sayi, yuzde } from '../../lib/format'
import { percentileOf, valueAt } from '../../lib/izgara'
import { ZONE_LABEL } from '../../lib/paletler'
import { useMap } from '../../map/useMap'
import { useCalismaStore } from '../calismaStore'
import type { HaritaGorunumu } from '../useHaritaGorunumu'

function pointInRing(lng: number, lat: number, ring: number[][]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}
function zoneAt(lng: number, lat: number, fc: { features: { geometry: GeoJSON.Geometry; properties: { sinif: number } }[] } | null): number | null {
  for (const f of fc?.features ?? []) {
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : []
    if (polys.some((p) => pointInRing(lng, lat, p[0] as number[][]) && !p.slice(1).some((h) => pointInRing(lng, lat, h as number[][])))) return f.properties.sinif
  }
  return null
}

/** Haritaya tıklayınca: o pikselin değeri, bahçe içi yüzdelik sırası, bölgesi ve kaynak satırı. */
export function NoktaInceleme({ gardenId, view }: { gardenId: string; view: HaritaGorunumu }) {
  const { map } = useMap()
  const inceleme = useCalismaStore((s) => s.inceleme)
  const setInceleme = useCalismaStore((s) => s.setInceleme)
  const multi = useMultiyear(gardenId).data
  const [, setTick] = useState(0)

  useEffect(() => {
    if (!map) return
    const onClick = (e: { lngLat: { lng: number; lat: number } }) => setInceleme({ lng: e.lngLat.lng, lat: e.lngLat.lat })
    map.on('click', onClick)
    return () => void map.off('click', onClick)
  }, [map, setInceleme])

  // Harita kaydıkça kart yerini korusun: konum her çizimde haritadan hesaplanır, hareket yalnız yeniden çizimi tetikler
  useEffect(() => {
    if (!map || !inceleme) return
    const bump = () => setTick((t) => t + 1)
    map.on('move', bump)
    return () => void map.off('move', bump)
  }, [map, inceleme])
  const pos = map && inceleme ? map.project([inceleme.lng, inceleme.lat]) : null

  const info = useMemo(() => {
    if (!inceleme) return null
    const v = view.izgara ? valueAt(view.izgara, inceleme.lng, inceleme.lat) : null
    const zone = zoneAt(inceleme.lng, inceleme.lat, multi?.durum === 'hazir' ? multi.bolgeler : null)
    return { v, p: v != null && view.izgara ? percentileOf(view.izgara, v) : null, zone }
  }, [inceleme, view.izgara, multi])

  if (!inceleme || !pos || !info) return null
  const degisimKatmani = view.tanim.id === 'degisim'
  const disarida = info.v == null && info.zone == null
  return (
    <>
      <span aria-hidden className="pointer-events-none absolute z-10 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-[2.5px] border-app-text bg-app-panel" style={{ left: pos.x, top: pos.y }} />
      <div role="dialog" aria-label="Nokta incelemesi" data-testid="nokta-inceleme" className="glass absolute z-20 w-[248px] px-3.5 pb-3 pt-3" style={{ left: Math.max(8, pos.x + 14), top: Math.max(8, pos.y - 40) }}>
        <button type="button" aria-label="Kapat" onClick={() => setInceleme(null)} className="absolute right-1.5 top-1.5 grid h-8 w-8 place-items-center rounded-md hover:bg-app-card-hover"><X className="h-4 w-4" aria-hidden /></button>
        {disarida ? (
          <p className="pr-6 text-[12.5px] text-app-text-muted">Bu nokta bahçe sınırının dışında.</p>
        ) : (
          <>
            <div className="text-[11px] font-semibold uppercase tracking-[.08em] text-app-text-dim">{view.tanim.ad}{degisimKatmani ? ' farkı' : ''}</div>
            <div className="num mt-1 text-[28px] font-semibold leading-none">{info.v == null ? '—' : degisimKatmani ? degisim(info.v * 100, 0).replace('%', '') : sayi(info.v)}</div>
            {info.p != null && !degisimKatmani && <p className="mt-1.5 text-[12.5px]">Bahçenin {yuzde(info.p)}’i bundan zayıf.</p>}
            {info.zone != null && <p className="mt-1 text-[12.5px]">Çok yıllık bölge: <b>{ZONE_LABEL[info.zone]}</b></p>}
            <p className="num mt-2 border-t border-app-border pt-2 text-[10.5px] text-app-text-muted">
              {kaynakSatiri([view.sahne ? gunAy(view.sahne.tarih) : null, view.tanim.kaynak, '10 m piksel', `${inceleme.lat.toFixed(5)}° K ${inceleme.lng.toFixed(5)}° D`])}
            </p>
          </>
        )}
      </div>
    </>
  )
}
