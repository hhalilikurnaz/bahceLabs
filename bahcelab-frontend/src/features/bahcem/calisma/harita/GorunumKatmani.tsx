import { useEffect, useMemo, useRef } from 'react'
import { camSusun } from '@/lib/cam'
import { reducedMotion } from '@/lib/motion'
import type { CanvasSource } from 'maplibre-gl'
import type { Garden } from '../../api/types'
import { contourStep, paintGrid } from '../../lib/izgara'
import { useMap } from '../../map/useMap'
import { useCalismaStore } from '../calismaStore'
import type { HaritaGorunumu } from '../useHaritaGorunumu'
import { sinirlarUste } from './haritaYardim'

const SLOT = ['kg-raster-0', 'kg-raster-1'] as const
const CAPRAZ_MS = 200 // katman değişiminde çapraz geçiş
/** Tuval büyütmesi: net piksel en yakın komşuyla; sınır kırpması ve kontur çizgisi pürüzsüz olsun diye piksel başına çok sayıda tuval pikseli.
 *  Büyük bahçede tuval kenarı sınırı aşmasın. */
const OLCEK = { piksel: 16, kontur: 12 } as const
const TUVAL_KENAR_MAKS = 4096
const olcek = (cols: number, rows: number, kontur: boolean) => Math.max(2, Math.min(kontur ? OLCEK.kontur : OLCEK.piksel, Math.floor(TUVAL_KENAR_MAKS / Math.max(cols, rows))))

/** Seçili katmanın ızgarasını net piksel olarak çizer (kontur, opaklık, histogram vurgusu dahil). Bölgeler katmanında gizli. */
export function GorunumKatmani({ garden, view }: { garden: Garden; view: HaritaGorunumu }) {
  const { map, styleVersion } = useMap()
  const kontur = useCalismaStore((s) => s.kontur)
  const opaklik = useCalismaStore((s) => s.opaklik)
  const vurgu = useCalismaStore((s) => s.vurgu)
  const sade = useCalismaStore((s) => s.sade)
  const yuva = useRef(0)
  const anahtar = useRef<string | null>(null)
  const sonDegisim = useRef(0)
  const ring = useMemo(() => (garden.geometry.type === 'Polygon' ? garden.geometry.coordinates[0] : garden.geometry.coordinates[0][0]) as number[][], [garden])

  useEffect(() => {
    if (!map || styleVersion === 0) return
    // Gerilme kapalı = fark gürültü düzeyinde: harita nötr kalır (uydu görüntüsü), «anlamlı fark yok» notu gösterilir (U-06)
    if (!view.izgara || !view.ramp || view.skala.kapali || sade) {
      SLOT.forEach((id) => map.getLayer(id) && map.setLayoutProperty(id, 'visibility', 'none'))
      anahtar.current = null
      return
    }
    camSusun() // katman değişimi sırasında cam bulanıklığı kapalı (performans)
    const started = performance.now()
    const konturAcik = kontur && view.tanim.fark !== true && view.tanim.gorunum === 'rampa'
    const canvas = paintGrid(view.izgara, {
      ramp: view.ramp,
      domain: view.alan,
      scale: olcek(view.izgara.cols, view.izgara.rows, konturAcik),
      contour: konturAcik ? contourStep(view.alan) : null,
      gorunum: view.tanim.gorunum,
      clip: ring,
      highlight: vurgu,
      soluk: view.soluk,
      izgaraAdimi: view.tanim.landsat ? 10 : null,
    })
    // Aynı katman/görüntüde (vurgu, kontur) yerinde yenilenir; katman ya da görüntü DEĞİŞİNCE yeni tuval 200 ms çapraz geçişle gelir, eskisi söner.
    const yeniAnahtar = `${view.tanim.id}|${view.sahne?.tarih ?? ''}|${view.izgara.rows}x${view.izgara.cols}`
    // Hızlı art arda değişimde (< 600 ms) geçiş yok: anında; kullanıcı gezinirken yarım kalmış geçişler birikmez, katman ilk karede boyanır
    const simdi = performance.now()
    const capraz = anahtar.current !== null && anahtar.current !== yeniAnahtar && !reducedMotion() && simdi - sonDegisim.current > 600
    if (anahtar.current !== yeniAnahtar) sonDegisim.current = simdi
    anahtar.current = yeniAnahtar
    const eski = SLOT[yuva.current]
    const id = capraz ? SLOT[1 - yuva.current] : eski
    if (capraz) yuva.current = 1 - yuva.current
    if (map.getLayer(id)) map.removeLayer(id)
    if (map.getSource(id)) map.removeSource(id)
    map.addSource(id, { type: 'canvas', canvas, coordinates: view.izgara.corners as never, animate: false })
    // Yeni katman tam opaklıkta ve ESKİNİN ALTINA eklenir (ilk karede boyanır); geçiş yalnız eskinin opaklığını 0'a indirir: raster bir kez hazırlanır
    map.addLayer({ id, type: 'raster', source: id, paint: { 'raster-resampling': 'nearest', 'raster-opacity': opaklik, 'raster-fade-duration': 0 } }, capraz && map.getLayer(eski) ? eski : undefined)
    if (capraz) {
      requestAnimationFrame(() => {
        if (map.getLayer(id)) {
          if (map.getLayer(eski)) {
          map.setPaintProperty(eski, 'raster-opacity-transition', { duration: CAPRAZ_MS, delay: 0 })
          map.setPaintProperty(eski, 'raster-opacity', 0)
          window.setTimeout(() => {
            if (map.getLayer(eski) && eski !== SLOT[yuva.current]) {
              map.removeLayer(eski)
              if (map.getSource(eski)) map.removeSource(eski)
            }
          }, CAPRAZ_MS + 40)
          }
        }
      })
    }
    sinirlarUste(map)
    const src = map.getSource(id) as CanvasSource
    src.play()
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        src.pause()
        // Performans ölçümü (e2e/performans.spec.ts okur): katman değişiminin ilk karede görünür olduğu an
        performance.mark('katman-boyandi', { detail: { katman: view.tanim.id, boyamaMs: Math.round(performance.now() - started) } })
      }),
    )
    if (import.meta.env.DEV) console.debug(`[harita] katman çizimi ${Math.round(performance.now() - started)} ms`)
  }, [map, styleVersion, view.izgara, view.ramp, view.alan, view.soluk, view.skala.kapali, sade, view.tanim.id, kontur, vurgu, ring]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!map) return
    const aktif = SLOT[yuva.current]
    if (map.getLayer(aktif)) map.setPaintProperty(aktif, 'raster-opacity', opaklik)
  }, [map, opaklik])

  return null
}
