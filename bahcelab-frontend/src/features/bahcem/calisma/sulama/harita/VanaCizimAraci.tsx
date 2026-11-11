import { useEffect, useMemo, useRef, useState } from 'react'
import type { Marker } from 'maplibre-gl'
import { Button } from '@/components/ui'
import { HARITA } from '../../../map/haritaRenkleri'
import { loadMapLibre } from '../../../map/maplibre'
import { useMap } from '../../../map/useMap'
import { acikHalka, alanM2, duzlem, halkaMerkezi, katla180, noktaPolygonUzakligi, parcaliBol, yonDerece, type LngLat, type Xy } from '../../../lib/geometri'
import { useSulamaSektorKaydet, useSulamaSektorleri, type PanelYaniti, type SektorGirdisi } from '../../../api/sulamaPanelApi'
import { useSulamaHaritaStore } from './sulamaHaritaStore'

type Adim = 'bol' | 'pompa' | 'boru' | 'yon'
interface Parca {
  ad: string
  xy: Xy[]
  debi: string
  agac_sayisi?: number | null
  sira_aralik_m?: number | null
  agac_aralik_m?: number | null
}
const ADIM_AD: Record<Adim, string> = { bol: 'Bölme çizgileri', pompa: 'Pompa (isteğe bağlı)', boru: 'Ana boru (isteğe bağlı)', yon: 'Sıra yönü' }
const IPUCU: Record<Adim, string> = {
  bol: 'Haritada iki nokta tıklayarak bir bölme çizgisi çizin; çizgi parseli iki vanaya ayırır. İstediğiniz kadar çizin. Çizmezseniz bahçe tek vana sayılır.',
  pompa: 'Pompanın yerine bir kez tıklayın. Çizmezseniz haritada pompa gösterilmez.',
  boru: 'Ana borunun güzergâhına noktalar tıklayın. Çizmezseniz haritada boru gösterilmez.',
  yon: 'Bir ağaç sırası boyunca iki nokta tıklayın ya da derece yazın. Varsayılan: parselin uzun ekseni.',
}
const HEPSI = ['sc-kesim', 'sc-parca', 'sc-boru', 'sc-pompa', 'sc-yon', 'sc-bekleyen']

/** Vana çizim aracı: bölme çizgileri → vanalar (ad + debi), isteğe bağlı pompa noktası + ana boru çizgisi, sıra yönü. Doğrulama sunucuyla aynı kurallar (bahçe içi, birbirine binmez, adlar tekil, pompa/boru ≤ 300 m). */
export function VanaCizimAraci({ gardenId, panel }: { gardenId: string; panel: PanelYaniti }) {
  const { map, styleVersion } = useMap()
  const kaydet = useSulamaSektorKaydet(gardenId)
  const mevcut = useSulamaSektorleri(gardenId).data
  const setCizim = useSulamaHaritaStore((s) => s.setCizim)
  const parsel = useMemo<LngLat[] | null>(() => {
    const g = panel.parsel
    if (!g) return null
    const poly = g.type === 'Polygon' ? g.coordinates : g.coordinates.reduce((a, b) => (b[0]!.length > a[0]!.length ? b : a))
    return acikHalka(poly[0] as LngLat[])
  }, [panel.parsel])
  const d = useMemo(() => (parsel ? duzlem(halkaMerkezi(parsel)) : null), [parsel])
  const parselXy = useMemo(() => (parsel && d ? parsel.map(d.ileri) : []), [parsel, d])
  const [adim, setAdim] = useState<Adim>('bol')
  const [kesimler, setKesimler] = useState<[Xy, Xy][]>([])
  const [bekleyen, setBekleyen] = useState<Xy | null>(null)
  // Kayıtlı pompa/boru ilk açılışta düzleme alınır (efekt yerine tembel başlangıç)
  const [pompa, setPompa] = useState<Xy | null>(() => (d && panel.ag.pompa ? d.ileri(panel.ag.pompa.coordinates as LngLat) : null))
  const [boru, setBoru] = useState<Xy[]>(() => (d && panel.ag.ana_boru ? (panel.ag.ana_boru.coordinates as LngLat[]).map(d.ileri) : []))
  const [yon, setYon] = useState<number | null>(panel.ag.sira_yonu_derece)
  const [yonNokta, setYonNokta] = useState<Xy | null>(null)
  const [yenidenBol, setYenidenBol] = useState(!panel.sektor_tanimli)
  const [adlar, setAdlar] = useState<Record<number, string>>({})
  const [debiler, setDebiler] = useState<Record<number, string>>({})
  const [hata, setHata] = useState<string | null>(null)
  const markerlar = useRef<Marker[]>([])

  const parcalar = useMemo<Parca[]>(() => {
    if (!d || parselXy.length < 3) return []
    let ham: { xy: Xy[]; kayit?: (typeof panel.sektorler)[number] }[]
    if (!yenidenBol && panel.sektor_tanimli) {
      ham = panel.sektorler.filter((s) => s.geometry).map((s) => ({ xy: acikHalka(s.geometry!.coordinates[0] as LngLat[]).map(d.ileri), kayit: s }))
    } else {
      const p = parcaliBol(parselXy, kesimler)
      // yerleşim sırası: batıdan doğuya, sonra kuzeyden güneye (kararlı adlandırma)
      ham = p.map((xy) => ({ xy })).sort((a, b) => Math.min(...a.xy.map((q) => q[0])) - Math.min(...b.xy.map((q) => q[0])) || Math.max(...b.xy.map((q) => q[1])) - Math.max(...a.xy.map((q) => q[1])))
      if (ham.length === 1) ham = [] // bölünmedi: tek vana (bahçe)
    }
    return ham.map((h, i) => {
      const k = mevcut?.sektorler.find((m) => m.ad === h.kayit?.ad)
      return {
        ad: adlar[i] ?? h.kayit?.ad ?? `V${i + 1}`,
        xy: h.xy,
        debi: debiler[i] ?? (k?.vana_debi_m3h != null ? String(k.vana_debi_m3h).replace('.', ',') : ''),
        agac_sayisi: k?.agac_sayisi ?? null,
        sira_aralik_m: k?.sira_aralik_m ?? null,
        agac_aralik_m: k?.agac_aralik_m ?? null,
      }
    })
  }, [d, parselXy, kesimler, yenidenBol, panel.sektor_tanimli, panel.sektorler, mevcut, adlar, debiler])

  // ------------------------------------------------------------ doğrulama (sunucu kurallarının ön kontrolü)
  const uyarilar = useMemo(() => {
    const u: string[] = []
    const ad = parcalar.map((p) => p.ad.trim())
    if (ad.some((a) => a === '')) u.push('Vana adı boş olamaz.')
    if (new Set(ad).size !== ad.length) u.push('Vana adları tekrar etmemeli.')
    parcalar.forEach((p) => { if (alanM2(p.xy) < 100) u.push(`${p.ad}: çok küçük (${Math.round(alanM2(p.xy))} m²).`); const n = Number(p.debi.replace(',', '.')); if (p.debi.trim() !== '' && !(n > 0)) u.push(`${p.ad}: debi pozitif sayı olmalı (m³/sa).`) })
    if (pompa && noktaPolygonUzakligi(pompa, parselXy) > 300) u.push('Pompa bahçeden 300 m’den uzakta.')
    if (boru.some((q) => noktaPolygonUzakligi(q, parselXy) > 300)) u.push('Ana boru bahçeden 300 m’den uzakta.')
    if (boru.length === 1) u.push('Ana boru için en az iki nokta gerekir.')
    return u
  }, [parcalar, pompa, boru, parselXy])

  // ------------------------------------------------------------ haritada önizleme
  useEffect(() => {
    if (!map || styleVersion === 0 || !d) return
    const ll = (p: Xy): LngLat => d.geri(p)
    const kap = (xy: Xy[]) => [...xy, xy[0]!].map(ll)
    const fc = (f: GeoJSON.Feature[]): GeoJSON.FeatureCollection => ({ type: 'FeatureCollection', features: f })
    const veri: Record<string, GeoJSON.FeatureCollection> = {
      'sc-kesim': fc(kesimler.map(([a, b]) => {
        const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1
        return { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [ll([a[0] - (dx / L) * 400, a[1] - (dy / L) * 400]), ll([b[0] + (dx / L) * 400, b[1] + (dy / L) * 400])] } }
      })),
      'sc-parca': fc(parcalar.map((p, i) => ({ type: 'Feature', properties: { i }, geometry: { type: 'Polygon', coordinates: [kap(p.xy)] } }))),
      'sc-boru': fc(boru.length >= 2 ? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: boru.map(ll) } }] : []),
      'sc-pompa': fc(pompa ? [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: ll(pompa) } }] : []),
      'sc-bekleyen': fc([bekleyen, yonNokta, ...(adim === 'boru' ? boru : [])].filter((q): q is Xy => !!q).map((q) => ({ type: 'Feature' as const, properties: {}, geometry: { type: 'Point' as const, coordinates: ll(q) } }))),
      'sc-yon': fc(yon !== null && parselXy.length ? [(() => { const c = halkaMerkezi(parsel!); const r = (yon * Math.PI) / 180; const m = d.ileri(c); const L = 40; return { type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates: [d.geri([m[0] - Math.sin(r) * L, m[1] - Math.cos(r) * L]), d.geri([m[0] + Math.sin(r) * L, m[1] + Math.cos(r) * L])] } } })()] : []),
    }
    for (const id of HEPSI) {
      const src = map.getSource(id) as { setData?: (x: GeoJSON.GeoJSON) => void } | undefined
      if (src?.setData) src.setData(veri[id]!)
      else map.addSource(id, { type: 'geojson', data: veri[id]! })
    }
    const ekle = (l: Parameters<typeof map.addLayer>[0]) => { if (!map.getLayer(l.id)) map.addLayer(l) }
    ekle({ id: 'sc-parca', type: 'fill', source: 'sc-parca', paint: { 'fill-color': HARITA.ra24f1b, 'fill-opacity': 0.22 } })
    ekle({ id: 'sc-parca-cizgi', type: 'line', source: 'sc-parca', paint: { 'line-color': HARITA.ra24f1b, 'line-width': 2.2 } })
    ekle({ id: 'sc-kesim', type: 'line', source: 'sc-kesim', paint: { 'line-color': HARITA.rffffff, 'line-width': 2.5, 'line-dasharray': [3, 2] } })
    ekle({ id: 'sc-boru', type: 'line', source: 'sc-boru', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': HARITA.r2a78d6, 'line-width': 4 } })
    ekle({ id: 'sc-yon', type: 'line', source: 'sc-yon', paint: { 'line-color': HARITA.rf2c94c, 'line-width': 2.5, 'line-dasharray': [1, 2] } })
    ekle({ id: 'sc-pompa', type: 'circle', source: 'sc-pompa', paint: { 'circle-radius': 8, 'circle-color': HARITA.r2a78d6, 'circle-stroke-color': HARITA.rffffff, 'circle-stroke-width': 2 } })
    ekle({ id: 'sc-bekleyen', type: 'circle', source: 'sc-bekleyen', paint: { 'circle-radius': 5, 'circle-color': HARITA.rffffff, 'circle-stroke-color': HARITA.r17201b, 'circle-stroke-width': 2 } })
    // parça adları (HTML)
    markerlar.current.forEach((m) => m.remove())
    markerlar.current = []
    void loadMapLibre().then((ml) => {
      markerlar.current.forEach((m) => m.remove())
      markerlar.current = parcalar.map((p) => {
        const el = document.createElement('div')
        el.className = 'glass glass-golgesiz px-2 py-0.5 text-small font-semibold'
        el.textContent = `${p.ad} · ${(alanM2(p.xy) / 1000).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} dekar`
        const c = p.xy.reduce<Xy>((a, q) => [a[0] + q[0] / p.xy.length, a[1] + q[1] / p.xy.length], [0, 0])
        return new ml.Marker({ element: el, rotationAlignment: 'viewport' }).setLngLat(ll(c)).addTo(map)
      })
    })
  }, [map, styleVersion, d, kesimler, parcalar, boru, pompa, bekleyen, yonNokta, yon, adim, parsel, parselXy.length])

  // ------------------------------------------------------------ tıklamalar
  useEffect(() => {
    if (!map || !d) return
    const tikla = (e: { lngLat: { lng: number; lat: number } }) => {
      const p = d.ileri([e.lngLat.lng, e.lngLat.lat])
      setHata(null)
      if (adim === 'bol') {
        if (!yenidenBol) return
        if (bekleyen) { setKesimler((k) => [...k, [bekleyen, p]]); setBekleyen(null) } else setBekleyen(p)
      } else if (adim === 'pompa') setPompa(p)
      else if (adim === 'boru') setBoru((b) => [...b, p])
      else if (adim === 'yon') {
        if (yonNokta) { setYon(Math.round(katla180(yonDerece(p[0] - yonNokta[0], p[1] - yonNokta[1])) * 10) / 10); setYonNokta(null) } else setYonNokta(p)
      }
    }
    map.on('click', tikla)
    map.getCanvas().style.cursor = 'crosshair'
    return () => { map.off('click', tikla); map.getCanvas().style.cursor = '' }
  }, [map, d, adim, bekleyen, yonNokta, yenidenBol])

  // kapanınca önizlemeyi temizle
  useEffect(() => () => {
    markerlar.current.forEach((m) => m.remove())
    if (!map || !map.getStyle()) return
    for (const l of ['sc-parca', 'sc-parca-cizgi', 'sc-kesim', 'sc-boru', 'sc-yon', 'sc-pompa', 'sc-bekleyen']) if (map.getLayer(l)) map.removeLayer(l)
    for (const s of HEPSI) if (map.getSource(s)) map.removeSource(s)
  }, [map])

  if (!d || !parsel) return <div role="alert" className="glass absolute bottom-[176px] right-3.5 z-30 px-3 py-2 text-small">Bahçe sınırı yok, vana çizilemez.</div>
  const kaydetTikla = () => {
    if (uyarilar.length) { setHata(uyarilar[0]!); return }
    const ll = (xy: Xy[]): GeoJSON.Polygon => ({ type: 'Polygon', coordinates: [[...xy, xy[0]!].map(d.geri)] })
    const sektorler: SektorGirdisi[] = parcalar.map((p) => {
      const n = Number(p.debi.replace(',', '.'))
      return { ad: p.ad.trim(), geometry: ll(p.xy), agac_sayisi: p.agac_sayisi ?? null, sira_aralik_m: p.sira_aralik_m ?? null, agac_aralik_m: p.agac_aralik_m ?? null, vana_debi_m3h: p.debi.trim() !== '' && n > 0 ? n : null }
    })
    kaydet.mutate(
      { sektorler, pompa: pompa ? { type: 'Point', coordinates: d.geri(pompa) } : null, ana_boru: boru.length >= 2 ? { type: 'LineString', coordinates: boru.map(d.geri) } : null, sira_yonu_derece: yon },
      { onSuccess: () => setCizim(false), onError: (e) => setHata(e instanceof Error ? e.message : 'Kaydedilemedi.') },
    )
  }
  const geriAl = () => {
    if (adim === 'bol') { if (bekleyen) setBekleyen(null); else setKesimler((k) => k.slice(0, -1)) }
    else if (adim === 'pompa') setPompa(null)
    else if (adim === 'boru') setBoru((b) => b.slice(0, -1))
    else { setYon(null); setYonNokta(null) }
  }
  return (
    <section className="glass absolute bottom-[176px] right-3.5 z-30 flex max-h-[calc(100%-320px)] w-[min(360px,calc(100%-28px))] flex-col gap-2 overflow-y-auto px-3 py-3 @max-[759px]:bottom-[96px] @max-[759px]:max-h-[48%]" aria-label="Vana çizim aracı" data-testid="vana-cizim-araci">
      <div className="flex items-center justify-between gap-2"><h3 className="text-lead font-semibold">Vana çizimi</h3><button type="button" className="min-h-11 min-w-11 text-small font-semibold underline" onClick={() => setCizim(false)} data-testid="vana-cizim-kapat">Kapat</button></div>
      <div role="tablist" aria-label="Çizim adımı" className="flex flex-wrap gap-1">
        {(Object.keys(ADIM_AD) as Adim[]).map((a) => <button key={a} role="tab" type="button" aria-selected={adim === a} onClick={() => { setAdim(a); setBekleyen(null); setYonNokta(null) }} data-testid={`cizim-adim-${a}`} className={`min-h-11 rounded-md border px-2 text-small font-semibold ${adim === a ? 'border-app-text bg-app-text text-app-canvas' : 'border-app-border-strong'}`}>{ADIM_AD[a]}</button>)}
      </div>
      <p className="text-small" data-testid="cizim-ipucu">{IPUCU[adim]}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={geriAl} data-testid="cizim-geri">Geri al</Button>
        {adim === 'bol' && panel.sektor_tanimli && !yenidenBol && <Button variant="secondary" onClick={() => setYenidenBol(true)} data-testid="cizim-yeniden-bol">Yeniden böl</Button>}
        {adim === 'yon' && (
          <label className="flex items-center gap-1 text-small font-semibold">Derece<input inputMode="decimal" aria-label="Sıra yönü (derece, kuzeyden saat yönünde)" value={yon ?? ''} placeholder="uzun eksen" onChange={(e) => { const n = Number(e.target.value.replace(',', '.')); setYon(e.target.value.trim() === '' ? null : Number.isFinite(n) ? Math.max(0, Math.min(359.9, n)) : yon) }} className="min-h-11 w-24 rounded-md border border-app-border-strong bg-app-card px-2 text-body" data-testid="cizim-yon-derece" /></label>
        )}
      </div>
      {parcalar.length > 0 ? (
        <ul className="grid gap-1.5" data-testid="cizim-vanalar">
          {parcalar.map((p, i) => (
            <li key={i} className="grid grid-cols-[1fr_90px] items-end gap-2">
              <label className="text-caption">Vana adı<input value={p.ad} onChange={(e) => setAdlar((a) => ({ ...a, [i]: e.target.value }))} aria-label={`${i + 1}. vana adı`} className="mt-0.5 min-h-11 w-full rounded-md border border-app-border-strong bg-app-card px-2 text-body" data-testid="cizim-vana-ad" /></label>
              <label className="text-caption">Debi (m³/sa)<input inputMode="decimal" value={p.debi} onChange={(e) => setDebiler((a) => ({ ...a, [i]: e.target.value }))} aria-label={`${p.ad} debisi`} placeholder="isteğe bağlı" className="mt-0.5 min-h-11 w-full rounded-md border border-app-border-strong bg-app-card px-2 text-body" data-testid="cizim-vana-debi" /></label>
            </li>
          ))}
        </ul>
      ) : <p className="text-small text-app-text-muted">Henüz bölme yok: bahçe tek vana olarak kalır.</p>}
      {(hata || uyarilar.length > 0) && <ul role="alert" className="list-disc pl-5 text-small text-app-danger" data-testid="cizim-uyari">{(hata ? [hata] : uyarilar).map((u) => <li key={u}>{u}</li>)}</ul>}
      <div className="flex gap-2"><Button onClick={kaydetTikla} disabled={kaydet.isPending} data-testid="cizim-kaydet">{kaydet.isPending ? 'Kaydediliyor…' : 'Kaydet'}</Button></div>
    </section>
  )
}
