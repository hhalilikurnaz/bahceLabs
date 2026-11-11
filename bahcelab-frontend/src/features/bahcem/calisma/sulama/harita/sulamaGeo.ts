import type { SektorDurumu, SulamaAgi } from '../../../api/sulamaPanelApi'
import { acikHalka, alanM2, duzlem, halkaMerkezi, noktaIcinde, siraUret, uzunEksenYonu, type LngLat, type Xy } from '../../../lib/geometri'

/** Panel verisinden harita modeli (saf): vana çokgenleri, ağaç sıraları (dikim aralığı + sıra yönü), etiket konumu. Veri yoksa ÇİZİLMEZ (uydurma yok). */
export interface HaritaVanasi {
  ad: string
  ring: LngLat[]
  merkez: LngLat
  siraAralik: number | null
  agacAralik: number | null
  siralar: LngLat[][]
  agaclar: LngLat[]
  kesildi: boolean
}
export interface HaritaModeli {
  vanalar: HaritaVanasi[]
  parsel: LngLat[]
  siraYonu: number
  yonKaynak: 'kullanici' | 'uzun-eksen'
  uzunEksen: number
  /** hiçbir vanada dikim aralığı yok → sıra çizilmedi */
  siraYok: boolean
  /** tüm vanalarda sıralar aynı yöndedir */
  aralikMetni: string | null
}
const ringOf = (g: GeoJSON.Polygon | GeoJSON.MultiPolygon): LngLat[] => {
  const poly = g.type === 'Polygon' ? g.coordinates : (g.coordinates.reduce((a, b) => (b[0]!.length > a[0]!.length ? b : a)) as GeoJSON.Position[][])
  return acikHalka(poly[0] as LngLat[])
}
/** Etiket noktası: ağırlık merkezi çokgen içindeyse o; değilse içeride bulunan en yakın köşe-merkez orta noktası. */
export function etiketNoktasi(xy: Xy[]): Xy {
  const n = xy.length
  const c: Xy = [xy.reduce((s, p) => s + p[0], 0) / n, xy.reduce((s, p) => s + p[1], 0) / n]
  if (noktaIcinde(c, xy)) return c
  for (let i = 0; i < n; i++) {
    const m: Xy = [(xy[i]![0] + c[0]) / 2, (xy[i]![1] + c[1]) / 2]
    if (noktaIcinde(m, xy)) return m
  }
  return xy[0]!
}
export function haritaModeli(sektorler: SektorDurumu[], parsel: GeoJSON.Polygon | GeoJSON.MultiPolygon | null, ag: SulamaAgi | undefined): HaritaModeli | null {
  const parselRing = parsel ? ringOf(parsel) : null
  const ilk = sektorler.find((s) => s.geometry)
  const tanimli = sektorler.filter((s) => s.geometry)
  const kaynakRing = parselRing ?? (ilk?.geometry ? ringOf(ilk.geometry) : null)
  if (!kaynakRing) return null
  const d = duzlem(halkaMerkezi(kaynakRing))
  const parselXy = kaynakRing.map(d.ileri)
  const uzun = uzunEksenYonu(parselXy)
  const kullanici = ag?.sira_yonu_derece ?? null
  const yon = kullanici ?? uzun
  const liste = tanimli.length > 0 ? tanimli.map((s) => ({ ad: s.ad, ring: ringOf(s.geometry!), sa: s.sira_aralik_m, aa: s.agac_aralik_m })) : [{ ad: sektorler[0]?.ad ?? 'Bahçe', ring: kaynakRing, sa: sektorler[0]?.sira_aralik_m ?? null, aa: sektorler[0]?.agac_aralik_m ?? null }]
  const vanalar = liste.map((v): HaritaVanasi => {
    const xy = v.ring.map(d.ileri)
    const sa = v.sa ?? ag?.varsayilan_sira_aralik_m ?? null
    const aa = v.aa ?? ag?.varsayilan_agac_aralik_m ?? null
    const sonuc = sa && aa && alanM2(xy) > 1 ? siraUret(xy, yon, sa, aa) : null
    const e = etiketNoktasi(xy)
    return {
      ad: v.ad,
      ring: v.ring,
      merkez: d.geri(e),
      siraAralik: sa,
      agacAralik: aa,
      siralar: sonuc ? sonuc.siralar.map(([a, b]) => [d.geri(a), d.geri(b)]) : [],
      agaclar: sonuc ? sonuc.agaclar.map(d.geri) : [],
      kesildi: sonuc?.kesildi ?? false,
    }
  })
  const aralik = vanalar.find((v) => v.siraAralik && v.agacAralik)
  const ayni = vanalar.every((v) => v.siraAralik === aralik?.siraAralik && v.agacAralik === aralik?.agacAralik)
  const f = (x: number) => String(Math.round(x * 100) / 100).replace('.', ',')
  return {
    vanalar,
    parsel: kaynakRing,
    siraYonu: yon,
    yonKaynak: kullanici !== null ? 'kullanici' : 'uzun-eksen',
    uzunEksen: uzun,
    siraYok: !aralik,
    aralikMetni: aralik ? `${f(aralik.siraAralik!)} × ${f(aralik.agacAralik!)} m${ayni ? '' : ' (vanaya göre değişir)'}` : null,
  }
}
