import { useEffect, useMemo, useState } from 'react'
import { useMultiyear } from '../../api/multiyearApi'
import { useSu } from '../../api/suApi'
import type { Garden } from '../../api/types'
import { useMap } from '../../map/useMap'
import { useCalismaStore } from '../calismaStore'

interface Not { id: string; lng: number; lat: number; metin: string; ad: string; sinif?: number }
const NOT_G = 232
const NOT_Y = 58

/** Çok parçalı bölgenin EN BÜYÜK parçasının ağırlık merkezi: nota bağlanan gerçek yer. */
function enBuyukParca(geom: GeoJSON.Geometry): [number, number] | null {
  const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.type === 'MultiPolygon' ? geom.coordinates : []
  let en = -1
  let nokta: [number, number] | null = null
  for (const p of polys) {
    const r = p[0]
    const alan = Math.abs(r.reduce((t, c, i) => t + c[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * c[1], 0)) / 2
    if (alan > en) {
      en = alan
      nokta = [r.reduce((t, c) => t + c[0], 0) / r.length, r.reduce((t, c) => t + c[1], 0) / r.length]
    }
  }
  return nokta
}

const virgul = (v: number, d = 1) => v.toFixed(d).replace('.', ',')

/**
 * Kartografik notlar (en fazla 2, gerçek bulgudan): haritada ilgili bölgeye ince çizgiyle bağlı kısa not. Normal yazı, küçük harf.
 * Tıklayınca harita o bölgeye 600 ms yumuşak uçar ve bölge sınırı vurgulanır. Durum/Analiz: zayıf ve güçlü kesim; Su: aynı hava hücresi.
 */
export function CartoNotlari({ garden }: { garden: Garden }) {
  const { map, styleVersion } = useMap()
  const sekme = useCalismaStore((s) => s.sekme)
  const ucus = useCalismaStore((s) => s.ucus)
  const altSayfaPx = useCalismaStore((s) => s.altSayfaPx)
  const multi = useMultiyear(sekme === 'durum' || sekme === 'analiz' ? garden.id : null).data
  const su = useSu(sekme === 'su' ? garden.id : null).data
  const [, yenile] = useState(0)
  const notlar = useMemo<Not[]>(() => {
    if ((sekme === 'durum' || sekme === 'analiz') && multi?.durum === 'hazir' && multi.bolgeler) {
      const r: Not[] = []
      for (const sinif of [1, 3] as const) {
        const oz = multi.ozet.find((o) => o.sinif === sinif)
        const f = multi.bolgeler.features.find((x) => x.properties.sinif === sinif)
        const p = f ? enBuyukParca(f.geometry) : null
        if (!oz || !p || oz.fark_yuzde === null || Math.abs(oz.fark_yuzde) < 0.1) continue
        r.push({ id: `bolge-${sinif}`, lng: p[0], lat: p[1], sinif, ad: sinif === 1 ? 'zayıf kesim' : 'güçlü kesim', metin: `${virgul(oz.alan_dekar)} da, yıllardır normalin %${virgul(Math.abs(oz.fark_yuzde))} ${oz.fark_yuzde < 0 ? 'altında' : 'üstünde'}` })
      }
      return r.slice(0, 2)
    }
    if (sekme === 'su' && su?.ayni_hucre_bahceler?.length) {
      const ring = (garden.geometry.type === 'Polygon' ? garden.geometry.coordinates[0] : garden.geometry.coordinates[0][0]) as number[][]
      return [{ id: 'hucre', lng: ring.reduce((t, c) => t + c[0], 0) / ring.length, lat: ring.reduce((t, c) => t + c[1], 0) / ring.length, ad: 'aynı hava verisi', metin: `${su.ayni_hucre_bahceler.join(', ')} ile aynı 9 km hücre` }]
    }
    return []
  }, [sekme, multi, su, garden.geometry])
  useEffect(() => {
    if (!map) return
    const f = () => yenile((n) => n + 1)
    map.on('move', f)
    map.on('resize', f)
    return () => void (map.off('move', f), map.off('resize', f))
  }, [map])
  if (!map || styleVersion === 0 || notlar.length === 0) return null
  const kap = map.getContainer()
  const W = kap.clientWidth
  const H = kap.clientHeight
  if (altSayfaPx > H * 0.6) return null // mobil alt sayfa «tam» durakta harita şeridi küçük: notlar bahçeyi örtmesin
  return (
    <div className="pointer-events-none absolute inset-0 z-[5]" data-testid="karto-notlari" aria-label="Haritadaki notlar">
      {(() => {
        const kutuG = Math.min(NOT_G, W * 0.46)
        // Engeller: sol-alt lejant, sağ-alt ölçek/yakınlaştırma, üst ray, kenarlar; önceki notlar
        const engeller = [{ x: 0, y: H - 205, w: 310, h: 205 }, { x: W - 330, y: H - 92, w: 330, h: 92 }, { x: 0, y: 0, w: W, h: 72 }]
        const yerlesen: { x: number; y: number; w: number; h: number }[] = []
        const kesisir = (a: { x: number; y: number; w: number; h: number }, c: { x: number; y: number; w: number; h: number }) => a.x < c.x + c.w && a.x + a.w > c.x && a.y < c.y + c.h && a.y + a.h > c.y
        return notlar.map((n, i) => {
          const p = map.project([n.lng, n.lat])
          const sagTercih = p.x < W * 0.5
          const adaylar = [sagTercih, !sagTercih].flatMap((sag) => [i === 0 ? -NOT_Y - 10 : 22, i === 0 ? 22 : -NOT_Y - 10, -NOT_Y / 2].map((dy) => ({ sag, dy })))
          let secim = adaylar[0]
          let kutu = { x: 0, y: 0, w: kutuG, h: NOT_Y }
          for (const c of adaylar) {
            const k = { x: Math.min(W - kutuG - 8, Math.max(8, c.sag ? p.x + 30 : p.x - 30 - kutuG)), y: Math.min(H - NOT_Y - 8, Math.max(8, p.y + c.dy)), w: kutuG, h: NOT_Y }
            secim = c
            kutu = k
            if (![...engeller, ...yerlesen].some((o) => kesisir(k, o))) break
          }
          yerlesen.push(kutu)
          const bx = kutu.x
          const by = kutu.y
          const sag = secim.sag
        const ok = p.x >= 0 && p.x <= W && p.y >= 0 && p.y <= H
        if (!ok) return null
        const cx = bx + (sag ? 0 : kutuG)
        const cy = by + NOT_Y / 2
        return (
          <div key={n.id}>
            <svg className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
              <line x1={p.x} y1={p.y} x2={cx} y2={cy} stroke="white" strokeWidth={1.25} />
              <circle cx={p.x} cy={p.y} r={4} fill="white" stroke="var(--color-app-text)" strokeWidth={1.5} />
            </svg>
            <button type="button" data-testid="karto-not" data-sinif={n.sinif ?? ''} aria-label={`${n.ad}: ${n.metin}. Haritada göster`} onClick={() => ucus({ lng: n.lng, lat: n.lat, zoom: 19, sinif: n.sinif })}
              className="glass glass-golgesiz pointer-events-auto absolute text-left text-small leading-[17px] hover:bg-app-card-hover" style={{ left: bx, top: by, width: kutuG, padding: '6px 9px' }}>
              <b className="font-semibold">{n.ad}</b> · {n.metin}
            </button>
          </div>
        )
        })
      })()}
    </div>
  )
}
