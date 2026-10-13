import { X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useMultiyear } from '../../api/multiyearApi'
import { useRadarNokta, yonAdi } from '../../api/radarApi'
import { degisim, gunAy, kaynakSatiri, sayi, yuzde } from '../../lib/format'
import { lngLatToCell, percentileOf, valueAt } from '../../lib/izgara'
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

/** Radar nokta incelemesi: seçili pikselin son 6 radar sahnesindeki VH dB değeri (mini çizgi). Değer yoksa nokta çizilmez (uydurma yok). */
function MiniSeri({ seri }: { seri: { tarih: string; vh_db: number | null }[] }) {
  const degerler = seri.map((s) => s.vh_db).filter((v): v is number => v != null)
  if (degerler.length < 2) return null
  const lo = Math.min(...degerler)
  const hi = Math.max(...degerler)
  const W = 216
  const H = 34
  const x = (i: number) => 4 + (i / Math.max(1, seri.length - 1)) * (W - 8)
  const y = (v: number) => 4 + (1 - (v - lo) / (hi - lo || 1)) * (H - 8)
  const pts = seri.flatMap((s, i) => (s.vh_db == null ? [] : [[x(i), y(s.vh_db)] as const]))
  return (
    <figure className="mt-2" data-testid="radar-mini-seri">
      <svg width={W} height={H} role="img" aria-label={`Son ${seri.length} radar sahnesinde VH dB: ${lo.toFixed(1)} ile ${hi.toFixed(1)} arası`} className="block">
        <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke="var(--color-app-text)" strokeWidth={1.4} />
        {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={i === pts.length - 1 ? 3 : 2} fill="var(--color-app-text)" />)}
      </svg>
      <figcaption className="num flex justify-between text-[10.5px] text-app-text-muted"><span>{gunAy(seri[0].tarih)}</span><span>son {seri.length} sahne</span><span>{gunAy(seri[seri.length - 1].tarih)}</span></figcaption>
    </figure>
  )
}

/** Haritaya tıklayınca: o pikselin değeri, bahçe içi yüzdelik sırası, bölgesi ve kaynak satırı. */
export function NoktaInceleme({ gardenId, view }: { gardenId: string; view: HaritaGorunumu }) {
  const { map } = useMap()
  const inceleme = useCalismaStore((s) => s.inceleme)
  const setInceleme = useCalismaStore((s) => s.setInceleme)
  const multi = useMultiyear(gardenId).data
  const [, setTick] = useState(0)
  const radar = view.tanim.radar
  const hucre = useMemo(() => {
    if (!radar || !inceleme || !view.izgara) return null
    const [c, r] = lngLatToCell(view.izgara, inceleme.lng, inceleme.lat)
    return { satir: Math.floor(r), sutun: Math.floor(c) }
  }, [radar, inceleme, view.izgara])
  const nokta = useRadarNokta(gardenId, radar && view.sahne ? view.sahne.tarih : null, hucre?.satir ?? null, hucre?.sutun ?? null).data

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
  const radarKatmani = Boolean(radar)
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
            <div className="text-[11px] font-semibold uppercase tracking-[.08em] text-app-text-dim">{radarKatmani ? <>{view.tanim.ad} · <span className="normal-case">dB</span></> : view.tanim.landsat ? <>{view.tanim.ad}</> : `${view.tanim.ad}${degisimKatmani ? ' farkı' : ''}`}</div>
            <div className="num mt-1 text-[28px] font-semibold leading-none">{info.v == null ? '—' : radarKatmani ? `${view.tanim.fark && info.v > 0 ? '+' : ''}${sayi(info.v, 1)}` : view.tanim.landsat ? `${sayi(info.v, 1)} °C` : degisimKatmani ? degisim(info.v * 100, 0).replace('%', '') : sayi(info.v)}</div>
            {radarKatmani && nokta && <MiniSeri seri={nokta.seri} />}
            {view.tanim.landsat && <p className="mt-1.5 text-[11.5px] leading-snug text-app-text-muted" data-testid="nokta-landsat-not">Landsat 100 m fiziksel çözünürlükte ölçer; bu pikselin değeri komşu 3×3 kareyle aynı yüzeyin ortalamasıdır.</p>}
            {info.p != null && !degisimKatmani && !radarKatmani && <p className="mt-1.5 text-[12.5px]">Bahçenin {yuzde(info.p)}’i bundan zayıf.</p>}
            {info.zone != null && !radarKatmani && <p className="mt-1 text-[12.5px]">Çok yıllık bölge: <b>{ZONE_LABEL[info.zone]}</b></p>}
            <p className="num mt-2 border-t border-app-border pt-2 text-[10.5px] text-app-text-muted">
              {kaynakSatiri([view.sahne ? gunAy(view.sahne.tarih) : null, view.sahne?.yorunge != null ? `yörünge ${view.sahne.yorunge} · ${yonAdi(view.sahne.yon ?? '')}` : null, view.tanim.kaynak, '10 m piksel', `${inceleme.lat.toFixed(5)}° K ${inceleme.lng.toFixed(5)}° D`])}
            </p>
          </>
        )}
      </div>
    </>
  )
}
