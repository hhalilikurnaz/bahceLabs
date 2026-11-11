import { useEffect, useMemo, useRef } from 'react'
import type { GeoJSONSource, Map as MapLibreMap, Marker } from 'maplibre-gl'
import { reducedMotion } from '@/lib/motion'
import { camSusun } from '@/lib/cam'
import { loadMapLibre } from '../../../map/maplibre'
import { HARITA } from '../../../map/haritaRenkleri'
import { useMap } from '../../../map/useMap'
import type { PanelYaniti, SimulasyonYaniti } from '../../../api/sulamaPanelApi'
import { geometryBounds } from '../../../lib/geo'
import { hedefBearing, gostergeSinifi, tacRengi, vanaGunu, type Bantlar, type VanaGunu } from '../../../lib/sulamaHarita'
import { sinirKutusu } from '../../../lib/geometri'
import { haritaModeli, type HaritaModeli } from './sulamaGeo'
import { useSulamaHaritaStore } from './sulamaHaritaStore'
import { useCalismaStore } from '../../calismaStore'
import { useDarEkran } from '../../../hooks/useDarEkran'
import { MOBIL_BAR_PX } from './oynatma'
import { uzunEksenYonu, duzlem, halkaMerkezi } from '../../../lib/geometri'

const AY = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']
const gunAy = (iso: string) => `${Number(iso.slice(8, 10))} ${AY[Number(iso.slice(5, 7)) - 1]}`
const MPP0 = 78271.517 // zoom 0, ekvator, 512 px döşeme: metre/piksel
/** Damla şeridinin tam genişliği (m) — ÖN DEĞER/varsayım: ekranda «varsayım» etiketiyle gösterilir (kartın alt notu). */
export const SERIT_GENISLIK_M = 1.0
/** Taç çapı (m) — yalnız çizim büyüklüğü; ölçüm değildir (varsayım). */
const TAC_CAP_M = 3.0

const metrePx = (m: number, enlem: number): unknown => {
  const f = (z: number) => m / ((MPP0 * Math.cos((enlem * Math.PI) / 180)) / 2 ** z)
  return ['interpolate', ['exponential', 2], ['zoom'], 14, f(14), 22, f(22)]
}
const tr = (ms: number) => ({ duration: reducedMotion() ? 0 : ms, delay: 0 })
const IDS = (n: number) => Array.from({ length: n }, (_, i) => i)

export interface MotorGirdisi {
  panel: PanelYaniti
  sim: SimulasyonYaniti
  gunIdx: number
}
/** Sulama simülatörü katmanları (MapLibre paint güncellemesi; React yeniden çizimi YOK): vana dolguları, ağaç sıraları/taçları, ıslanan şerit, boru/pompa (yalnız çizildiyse), HTML etiketler. */
export function SulamaKatmani({ panel, sim, gunIdx, hazirDurum }: MotorGirdisi & { hazirDurum?: (m: HaritaModeli | null) => void }) {
  const { map, styleVersion } = useMap()
  const model = useMemo(() => haritaModeli(panel.sektorler, panel.parsel, panel.ag), [panel.sektorler, panel.parsel, panel.ag])
  const veri = useRef({ panel, sim, gunIdx, model })
  veri.current = { panel, sim, gunIdx, model }
  const markerlar = useRef<{ el: HTMLElement; baslik: HTMLElement; alt: HTMLElement; marker: Marker }[]>([])
  const yapiKimligi = useRef('')
  const bantlar: Bantlar = useMemo(() => ({ stres: panel.stres_pct, yakin: panel.yakin_pct, yeterli: panel.yeterli_pct }), [panel.stres_pct, panel.yakin_pct, panel.yeterli_pct])
  useEffect(() => hazirDurum?.(model), [model, hazirDurum])

  // ------------------------------------------------------------ yapı (kaynaklar + katmanlar + etiketler)
  useEffect(() => {
    if (!map || styleVersion === 0 || !model) return
    let iptal = false
    const n = model.vanalar.length
    const enlem = model.vanalar[0]!.merkez[1]
    const kaldir = () => {
      for (const i of IDS(n + 8)) for (const k of ['fill', 'serit', 'agac', 'cizgi', 'sec']) if (map.getLayer(`sl-${k}-${i}`)) map.removeLayer(`sl-${k}-${i}`)
      for (const id of ['sl-sira', 'sl-boru', 'sl-boru-akis', 'sl-pompa', 'sl-pompa-halka']) if (map.getLayer(id)) map.removeLayer(id)
      for (const id of ['sl-poly', 'sl-sira', 'sl-agac', 'sl-boru', 'sl-pompa']) if (map.getSource(id)) map.removeSource(id)
      markerlar.current.forEach((m) => m.marker.remove())
      markerlar.current = []
    }
    kaldir()
    const poly: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: model.vanalar.map((v, i) => ({ type: 'Feature', properties: { v: i, ad: v.ad }, geometry: { type: 'Polygon', coordinates: [[...v.ring, v.ring[0]!]] } })) }
    const sira: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: model.vanalar.map((v, i) => ({ type: 'Feature', properties: { v: i }, geometry: { type: 'MultiLineString', coordinates: v.siralar } })) }
    const agac: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: model.vanalar.flatMap((v, i) => v.agaclar.map((c) => ({ type: 'Feature' as const, properties: { v: i }, geometry: { type: 'Point' as const, coordinates: c } }))) }
    map.addSource('sl-poly', { type: 'geojson', data: poly })
    map.addSource('sl-sira', { type: 'geojson', data: sira })
    map.addSource('sl-agac', { type: 'geojson', data: agac })
    const sag = !model.siraYok
    for (const i of IDS(n)) map.addLayer({ id: `sl-fill-${i}`, type: 'fill', source: 'sl-poly', filter: ['==', ['get', 'v'], i], paint: { 'fill-color': HARITA.rcccccc, 'fill-opacity': 0.34, 'fill-color-transition': tr(200), 'fill-opacity-transition': tr(200) } })
    if (sag) map.addLayer({ id: 'sl-sira', type: 'line', source: 'sl-sira', paint: { 'line-color': HARITA.rffffff, 'line-opacity': 0.28, 'line-width': 0.8 } })
    for (const i of IDS(n)) {
      if (sag) map.addLayer({ id: `sl-serit-${i}`, type: 'line', source: 'sl-sira', filter: ['==', ['get', 'v'], i], layout: { 'line-cap': 'butt' }, paint: { 'line-color': HARITA.r2a78d6, 'line-opacity': 0, 'line-width': metrePx(SERIT_GENISLIK_M, enlem) as number, 'line-opacity-transition': tr(200) } })
      if (sag) map.addLayer({ id: `sl-agac-${i}`, type: 'circle', source: 'sl-agac', filter: ['==', ['get', 'v'], i], paint: { 'circle-color': HARITA.r357a43, 'circle-radius': metrePx(TAC_CAP_M / 2, enlem) as number, 'circle-opacity': 0.88, 'circle-stroke-width': 0, 'circle-color-transition': tr(250) } })
    }
    for (const i of IDS(n)) {
      map.addLayer({ id: `sl-cizgi-${i}`, type: 'line', source: 'sl-poly', filter: ['==', ['get', 'v'], i], layout: { 'line-join': 'round' }, paint: { 'line-color': HARITA.rffffff, 'line-width': 1.6, 'line-opacity': 0.95 } })
      map.addLayer({ id: `sl-sec-${i}`, type: 'line', source: 'sl-poly', filter: ['==', ['get', 'v'], i], layout: { 'line-join': 'round' }, paint: { 'line-color': HARITA.r17201b, 'line-width': 3.2, 'line-opacity': 0 } })
    }
    // Pompa ve ana boru YALNIZ kullanıcı vana çizim aracında çizdiyse vardır
    const ag = veri.current.panel.ag
    if (ag.ana_boru) {
      map.addSource('sl-boru', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: ag.ana_boru } })
      map.addLayer({ id: 'sl-boru', type: 'line', source: 'sl-boru', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': HARITA.r17201b, 'line-width': 4.5, 'line-opacity': 0.9 } })
      map.addLayer({ id: 'sl-boru-akis', type: 'line', source: 'sl-boru', layout: { 'line-cap': 'butt' }, paint: { 'line-color': HARITA.r2a78d6, 'line-width': 2.2, 'line-opacity': 0, 'line-dasharray': [0, 4, 3] } })
    }
    if (ag.pompa) {
      map.addSource('sl-pompa', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: ag.pompa } })
      map.addLayer({ id: 'sl-pompa-halka', type: 'circle', source: 'sl-pompa', paint: { 'circle-radius': 11, 'circle-color': HARITA.rffffff, 'circle-opacity': 0.95, 'circle-stroke-color': HARITA.r17201b, 'circle-stroke-width': 1.5 } })
      map.addLayer({ id: 'sl-pompa', type: 'circle', source: 'sl-pompa', paint: { 'circle-radius': 5, 'circle-color': HARITA.r2a78d6 } })
    }
    // Etiketler: HTML, harita dönse de DİK kalır (rotationAlignment: viewport)
    void loadMapLibre().then((ml) => {
      if (iptal) return
      model.vanalar.forEach((v, i) => {
        const el = document.createElement('button')
        el.type = 'button'
        el.className = 'sl-etiket glass glass-golgesiz'
        el.dataset.testid = 'harita-vana-etiketi'
        el.dataset.vana = v.ad
        el.setAttribute('aria-label', `${v.ad} vanasını seç`)
        const baslik = document.createElement('b')
        baslik.dataset.testid = 'harita-vana-baslik'
        const alt = document.createElement('span')
        alt.dataset.testid = 'harita-vana-alt'
        el.append(baslik, alt)
        el.addEventListener('click', (e) => { e.stopPropagation(); useSulamaHaritaStore.getState().setSecili(v.ad) })
        const marker = new ml.Marker({ element: el, rotationAlignment: 'viewport', pitchAlignment: 'viewport' }).setLngLat(v.merkez).addTo(map)
        markerlar.current[i] = { el, baslik, alt, marker }
      })
      yapiKimligi.current = `${Date.now()}`
      uygula()
    })
    const tikla = (e: { features?: GeoJSON.Feature[] }) => {
      const ad = e.features?.[0]?.properties?.ad as string | undefined
      if (ad && !useSulamaHaritaStore.getState().cizim) useSulamaHaritaStore.getState().setSecili(ad)
    }
    const girdi = () => { map.getCanvas().style.cursor = 'pointer' }
    const cikti = () => { map.getCanvas().style.cursor = '' }
    for (const i of IDS(n)) {
      map.on('click', `sl-fill-${i}`, tikla)
      map.on('mouseenter', `sl-fill-${i}`, girdi)
      map.on('mouseleave', `sl-fill-${i}`, cikti)
    }
    return () => {
      iptal = true
      for (const i of IDS(n)) {
        map.off('click', `sl-fill-${i}`, tikla)
        map.off('mouseenter', `sl-fill-${i}`, girdi)
        map.off('mouseleave', `sl-fill-${i}`, cikti)
      }
      if (map.getStyle()) kaldir()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, styleVersion, model, panel.ag])

  // ------------------------------------------------------------ gün durumu (paint güncellemesi)
  const uygulaRef = useRef<() => void>(() => undefined)
  function uygula() { uygulaRef.current() }
  uygulaRef.current = () => {
    const { panel: p, sim: s, gunIdx: i, model: m } = veri.current
    if (!map || !m) return
    const st = useSulamaHaritaStore.getState()
    const n = m.vanalar.length
    // Vana eşlemesi AD ile (simülasyon ve panel sırası aynı olmak zorunda değil); tek sektörlü bahçede tek satır
    const si = (k: number) => { const j = s.sektorler.findIndex((x) => x.ad === m.vanalar[k]!.ad); return j >= 0 ? j : Math.min(k, s.sektorler.length - 1) }
    const gunler: VanaGunu[] = m.vanalar.map((_, k) => vanaGunu(s, si(k), i, bantlar))
    const onceki = (k: number) => (i > 0 ? s.sektorler[si(k)]!.doluluk_pct[i - 1] ?? null : null)
    gunler.forEach((v, k) => {
      const sinif = gostergeSinifi(st.gosterge, v)
      if (map.getLayer(`sl-fill-${k}`)) {
        map.setPaintProperty(`sl-fill-${k}`, 'fill-color', sinif.renk)
        map.setPaintProperty(`sl-fill-${k}`, 'fill-opacity', v.sulaniyor ? 0.5 : 0.34)
      }
      if (map.getLayer(`sl-agac-${k}`)) map.setPaintProperty(`sl-agac-${k}`, 'circle-color', tacRengi(v))
      if (map.getLayer(`sl-serit-${k}`)) {
        const damla = (st.sim.sistem ?? 'damla') === 'damla'
        const goster = v.sulaniyor && st.katman.serit && damla
        map.setPaintProperty(`sl-serit-${k}`, 'line-opacity', goster ? 0.6 : 0)
        const enlem = m.vanalar[0]!.merkez[1]
        const oran = reducedMotion() ? 1 : Math.max(0.15, st.dilim)
        map.setPaintProperty(`sl-serit-${k}`, 'line-width', metrePx(SERIT_GENISLIK_M * oran, enlem) as number)
      }
      if (map.getLayer(`sl-sec-${k}`)) map.setPaintProperty(`sl-sec-${k}`, 'line-opacity', st.secili === v.ad ? 1 : 0)
      const mk = markerlar.current[k]
      if (mk) {
        const gelecek = (() => { const sek = s.sektorler[si(k)]!; for (let j = i + 1; j < sek.brut_mm.length; j++) if ((sek.brut_mm[j] ?? 0) > 0) return gunAy(s.gunler[j]!.tarih); return null })()
        const pct = v.pct === null ? '—' : `%${Math.round(v.pct)}`
        if (v.sulaniyor) {
          const once = onceki(k)
          const aradaki = once !== null && v.pct !== null ? once + (v.pct - once) * Math.min(1, st.dilim) : v.pct
          mk.baslik.textContent = `${v.ad} · ${once === null ? pct : `%${Math.round(once)}`}`
          // zaman bağlamı: oynatılırken «sulanıyor», geçmiş gün «sulandı», bugün/gelecek (oynatılmadan) «sulanacak»
          const kelime = st.dilim > 0 ? 'sulanıyor' : s.bugun_idx !== null && i >= s.bugun_idx ? 'sulanacak' : 'sulandı'
          mk.alt.textContent = `${kelime} · ${aradaki === null ? '—' : `%${Math.round(st.dilim > 0 ? aradaki : v.pct ?? aradaki)}`}`
        } else {
          const e = gostergeSinifi(st.gosterge, v)
          mk.baslik.textContent = st.gosterge === 'toprak' ? `${v.ad} · ${pct}` : `${v.ad} · ${e.metin}`
          mk.alt.textContent = `${e.metin === 'veri yok' ? 'veri yok' : st.gosterge === 'toprak' ? e.metin : (v.etiket ? { stres: 'stres', yakin: 'yakın', yeterli: 'yeterli', dolu: 'dolu' }[v.etiket] : 'veri yok')} · ${gelecek ? `sonraki ${gelecek}` : 'sulama gerekmiyor'}`
        }
        mk.el.dataset.sulaniyor = String(v.sulaniyor)
        mk.el.dataset.secili = String(st.secili === v.ad)
        mk.el.setAttribute('aria-label', `${v.ad}: ${mk.baslik.textContent}, ${mk.alt.textContent}`)
      }
    })
    // boru akışı yalnız bir vana sulanırken
    const akis = gunler.some((v) => v.sulaniyor) && st.katman.hat
    if (map.getLayer('sl-boru-akis')) map.setPaintProperty('sl-boru-akis', 'line-opacity', akis ? 0.95 : 0)
    // katman görünürlükleri
    for (let k = 0; k < n; k++) {
      if (map.getLayer(`sl-agac-${k}`)) map.setLayoutProperty(`sl-agac-${k}`, 'visibility', st.katman.tac ? 'visible' : 'none')
    }
    for (const id of ['sl-boru', 'sl-boru-akis', 'sl-pompa', 'sl-pompa-halka']) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', st.katman.hat ? 'visible' : 'none')
    void p
  }
  useEffect(() => {
    uygula()
    return useSulamaHaritaStore.subscribe(uygula)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, styleVersion, model, sim, gunIdx, bantlar])

  // ------------------------------------------------------------ boru akışı (yalnız sulama gününde, hareketi azalt kapalıyken)
  useEffect(() => {
    if (!map || reducedMotion() || !panel.ag.ana_boru) return
    const adimlar: number[][] = [[0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5], [2, 4, 1], [2.5, 4, 0.5], [3, 4, 0], [0, 0.5, 3, 3.5], [0, 1, 3, 3], [0, 1.5, 3, 2.5], [0, 2, 3, 2], [0, 2.5, 3, 1.5], [0, 3, 3, 1], [0, 3.5, 3, 0.5]]
    let k = 0
    const t = window.setInterval(() => {
      if (!map.getLayer('sl-boru-akis') || document.hidden) return
      if (Number(map.getPaintProperty('sl-boru-akis', 'line-opacity')) === 0) return
      k = (k + 1) % adimlar.length
      map.setPaintProperty('sl-boru-akis', 'line-dasharray', adimlar[k]!)
    }, 90)
    return () => window.clearInterval(t)
  }, [map, panel.ag.ana_boru, styleVersion])

  // ------------------------------------------------------------ bearing: parsel uzun eksenine (250 ms), çıkışta 0
  const ilkBearing = useRef(false)
  const altSayfaPx = useCalismaStore((x) => x.altSayfaPx)
  const dar = useDarEkran(899)
  useEffect(() => {
    if (!map || !model || styleVersion === 0) return
    const w = map.getContainer().clientWidth
    const h = map.getContainer().clientHeight
    const hedef = hedefBearing(model.uzunEksen, w >= h)
    const sinir = sinirKutusu(model.parsel)
    ilkBearing.current = true
    camSusun(600)
    map.fitBounds([[sinir[0], sinir[1]], [sinir[2], sinir[3]]], { bearing: hedef, padding: { top: w < 760 ? 120 : 70, bottom: (dar ? MOBIL_BAR_PX + altSayfaPx : 176) + 24, left: w < 760 ? 20 : 60, right: w < 760 ? 20 : 60 }, duration: reducedMotion() ? 0 : 250, maxZoom: 19.5, pitch: 0 })
    return () => {
      if (!ilkBearing.current) return
      try { map.easeTo({ bearing: 0, duration: reducedMotion() ? 0 : 250 }) } catch { /* harita kapanmış olabilir */ }
    }
  }, [map, model?.uzunEksen, styleVersion, altSayfaPx]) // eslint-disable-line react-hooks/exhaustive-deps
  // kullanılmayanlar (tür bütünlüğü)
  void uzunEksenYonu; void duzlem; void halkaMerkezi; void geometryBounds
  return null
}
export type { MapLibreMap, GeoJSONSource }
