import { useCallback, useMemo } from 'react'
import { useEdinimIzgara, useEdinimler, type Edinim } from '../api/edinimApi'
import { useYilGrid } from '../api/multiyearApi'
import { useNormalBantlar } from '../api/normalBantApi'
import { useLandsatEdinimler, useLandsatIzgara, type LandsatEdinim } from '../api/suApi'
import { useRadarDegisimler, useRadarEdinimler, useRadarIzgara, type RadarEdinim } from '../api/radarApi'
import { differenceGrid, median, percentileDomain, symmetricDomain, type PGrid } from '../lib/izgara'
import { useGorselEsikler } from '../api/agroApi'
import { RAMPS, type Stops } from '../lib/paletler'
import { KATMAN_ESIK_ANAHTARI, skalaKarari, type SkalaKarari } from '../lib/skala'
import { useCalismaStore } from './calismaStore'
import { GOSTERGE_ARALIK, KATMANLAR, RADAR_DEGISIM_ARALIK, RADAR_VH_ARALIK, SICAKLIK_ARALIK, type KatmanTanimi } from './katmanlar'

/** Değişim katmanında karşılaştırılan önceki net görüntü en az bu kadar gün önce olmalı (çok yakın tarih gürültü verir). */
export const DEGISIM_MIN_GUN = 10

/** Haritada gezilebilen bir net görüntü (edinim). */
export interface Sahne {
  tarih: string
  bulutOrani: number | null
  sceneId: string
  /** Radar: göreli yörünge ve geçiş yönü (inis | cikis) */
  yorunge?: number
  yon?: string
  /** Landsat platformu (L8 | L9) */
  platform?: string
}

export interface TipikBant {
  alt: number
  ust: number
  onDeger: boolean
}

export interface HaritaGorunumu {
  tanim: KatmanTanimi
  sahneler: Sahne[]
  sahne: Sahne | null
  onceki: Sahne | null
  izgara: PGrid | null
  alan: [number, number]
  ramp: Stops | null
  yukleniyor: boolean
  /** Değişim hesaplanamıyorsa nedeni */
  neden: string | null
  /** Uydu verisi alınamadı (ağ/sunucu hatası) */
  hata: boolean
  tekrarDene: () => void
  /** Skala kararı: mutlak varsayılan; gerilme yalnız eşik üstündeyse (U-06) */
  skala: SkalaKarari
  /** Hata nesnesi (ağ ↔ sunucu ayrımı için) */
  hataNesnesi: unknown
  /** Bahçedeki geçerli piksellerin ortancası (gösterilen ızgaradan) */
  ortanca: number | null
  /** Ürünün bu gösterge için tipik aralığı (ön değer); fark katmanında yok */
  tipikBant: TipikBant | null
  /** Soluk çizilen aralık (radar değişiminde anlamlı eşiğin altı) */
  soluk: [number, number] | null
}

/** Gerilme kapalıysa kısa gerekçe (haritanın üstünde): fiziksel gürültünün altındaki fark büyütülmez */
const skalaNotu = (k: SkalaKarari): string | null => (k.kapali && k.aralik !== null ? 'Anlamlı fark yok: bahçe içi aralık gürültü eşiğinin altında; gerilmiş skala kapalı.' : null)

const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000)
const toSahne = (e: Edinim): Sahne => ({ tarih: e.tarih, bulutOrani: e.bulut_orani, sceneId: e.scene_id })
const landsatSahne = (e: LandsatEdinim): Sahne => ({ tarih: e.tarih, bulutOrani: e.bulut_orani, sceneId: e.scene_id, platform: e.platform ?? undefined })
const radarSahne = (e: RadarEdinim): Sahne => ({ tarih: e.tarih, bulutOrani: null, sceneId: e.scene_id, yorunge: e.yorunge, yon: e.gecis_yonu })

/** Seçili katman, tarih ve skala için haritada gösterilecek ızgara — harita, histogram ve nokta incelemesi aynı kaynağı kullanır (tek veri hattı: edinimler). */
export function useHaritaGorunumu(gardenId: string | null): HaritaGorunumu {
  const katman = useCalismaStore((s) => s.katman)
  const tarih = useCalismaStore((s) => s.tarih)
  const yil = useCalismaStore((s) => s.yil)
  const skalaIstegi = useCalismaStore((s) => s.skala)
  const esikler = useGorselEsikler().data
  const tanim = KATMANLAR[katman]
  const gosterge = tanim.gosterge
  const radarTuru = tanim.radar ?? null
  const landsat = tanim.landsat === true
  const edinimSorgu = useEdinimler(gardenId)
  const radarSorgu = useRadarEdinimler(radarTuru ? gardenId : null)
  const landsatSorgu = useLandsatEdinimler(landsat ? gardenId : null)
  const radarOlaylari = useRadarDegisimler(radarTuru === 'degisim' ? gardenId : null).data
  const { refetch } = edinimSorgu
  const { refetch: radarYenile } = radarSorgu
  const { refetch: landsatYenile } = landsatSorgu
  const tekrarDene = useCallback(() => void (landsat ? landsatYenile() : radarTuru ? radarYenile() : refetch()), [refetch, radarYenile, landsatYenile, radarTuru, landsat])
  const hataNesnesi = landsat ? landsatSorgu.error : radarTuru ? radarSorgu.error : edinimSorgu.error
  const hata = landsat ? landsatSorgu.isError && !landsatSorgu.data : radarTuru ? radarSorgu.isError && !radarSorgu.data : edinimSorgu.isError && !edinimSorgu.data
  const radarListe = useMemo(() => (radarSorgu.data?.edinimler ?? []).filter((e) => e.birincil && e.izgara), [radarSorgu.data])
  const sahneler = useMemo(() => {
    if (landsat) return (landsatSorgu.data?.edinimler ?? []).map(landsatSahne)
    if (radarTuru === 'vh') return radarListe.map(radarSahne)
    if (radarTuru === 'degisim') return radarListe.slice(3).map(radarSahne) // ani değişim için aynı yörüngede önceki 3 sahne gerekir
    return (edinimSorgu.data?.edinimler ?? []).filter((e) => gosterge !== null && e.gostergeler[gosterge]).map(toSahne)
  }, [edinimSorgu.data, gosterge, radarTuru, radarListe, landsat, landsatSorgu.data])
  const sahne = (tarih ? sahneler.find((s) => s.tarih === tarih) : null) ?? sahneler[sahneler.length - 1] ?? null
  const onceki = useMemo(() => {
    if (katman !== 'degisim' || !sahne) return null
    return [...sahneler].reverse().find((s) => s.tarih < sahne.tarih && daysBetween(s.tarih, sahne.tarih) >= DEGISIM_MIN_GUN) ?? null
  }, [katman, sahne, sahneler])
  const izgaraBilgisi = landsat ? landsatSorgu.data?.izgara : radarTuru ? radarSorgu.data?.izgara : edinimSorgu.data?.izgara
  const optikGrid = useEdinimIzgara(gardenId, radarTuru || landsat ? null : (sahne?.tarih ?? null), gosterge, izgaraBilgisi).data
  const landsatGrid = useLandsatIzgara(gardenId, landsat ? (sahne?.tarih ?? null) : null, izgaraBilgisi)
  const radarGrid = useRadarIzgara(gardenId, radarTuru ? (sahne?.tarih ?? null) : null, radarTuru === 'degisim' ? 'degisim' : 'vh_db', izgaraBilgisi)
  const grid = landsat ? landsatGrid.data : radarTuru ? radarGrid.data : optikGrid
  const prevGrid = useEdinimIzgara(gardenId, radarTuru || landsat ? null : (onceki?.tarih ?? null), gosterge, izgaraBilgisi).data
  const yilSorgu = useYilGrid(gardenId, katman === 'canlilik' ? yil : null)
  const bantlar = useNormalBantlar(gardenId).data
  const tipik = gosterge ? bantlar?.tipik_bantlar[gosterge] : undefined
  const tipikBant = useMemo<TipikBant | null>(() => (tipik && katman !== 'degisim' ? { alt: tipik.alt, ust: tipik.ust, onDeger: tipik.durum !== 'muhendis_onayli' } : null), [tipik, katman])
  const yukleniyor = landsat ? landsatSorgu.isLoading : radarTuru ? radarSorgu.isLoading : edinimSorgu.isLoading
  return useMemo(() => {
    const yilSahnesi: Sahne | null = yilSorgu.data ? { tarih: `${yilSorgu.data.yil}-07-15`, bulutOrani: null, sceneId: `yaz-${yilSorgu.data.yil}`, platform: undefined } : null
    const ramp = tanim.ramp ? RAMPS[tanim.ramp] : null
    const asP = (g: typeof grid): PGrid | null => (g ? { values: g.values, rows: g.rows, cols: g.cols, corners: g.corners as unknown as [number, number][] } : null)
    const aralik = gosterge ? GOSTERGE_ARALIK[gosterge] : null
    const anahtar = KATMAN_ESIK_ANAHTARI[katman]
    const esik = anahtar ? (esikler?.gerilmeMinAralik[anahtar] ?? null) : null
    const karar = (mutlak: [number, number], gerilmisAlan: [number, number] | null, fark: boolean) => skalaKarari({ istek: skalaIstegi, mutlak, gerilmisAlan, esik, fark })
    if (landsat) {
      const izgara = asP(grid)
      const skala = karar(SICAKLIK_ARALIK, izgara ? percentileDomain([izgara]) : null, false)
      const alan = skala.alan
      return { tanim, sahneler, sahne, onceki: null, izgara, alan, ramp, yukleniyor: yukleniyor || (Boolean(sahne) && !izgara), neden: skalaNotu(skala), hata, hataNesnesi, skala, tekrarDene, ortanca: izgara ? median(izgara) : null, tipikBant: null, soluk: null }
    }
    if (radarTuru) {
      const izgara = asP(grid)
      const esik = radarOlaylari?.esikler.anlamli_degisim_db ?? 2
      const neden = radarTuru === 'degisim' && radarGrid.isError ? 'Aynı yörüngede yeterli önceki geçiş yok; radar değişimi hesaplanamıyor.' : null
      const fark = tanim.fark === true
      const mutlak: [number, number] = fark ? [-RADAR_DEGISIM_ARALIK, RADAR_DEGISIM_ARALIK] : RADAR_VH_ARALIK
      const skala = karar(mutlak, izgara ? (fark ? symmetricDomain(izgara) : percentileDomain([izgara])) : null, fark)
      const alan = skala.alan
      return {
        tanim, sahneler, sahne, onceki: null, izgara, alan, ramp, yukleniyor: yukleniyor || (Boolean(sahne) && !izgara && !neden && !radarGrid.isError), neden: neden ?? skalaNotu(skala), hata, hataNesnesi, skala, tekrarDene,
        ortanca: izgara ? median(izgara) : null, tipikBant: null, soluk: fark ? [-esik, esik] : null,
      }
    }
    if (katman === 'degisim') {
      const a = asP(grid)
      const b = asP(prevGrid)
      const diff = a && b ? differenceGrid(a, b) : null
      const neden = !onceki ? `Karşılaştırılacak, en az ${DEGISIM_MIN_GUN} gün önceki net görüntü yok.` : a && b && !diff ? 'İki görüntünün ızgarası farklı; fark gösterilmiyor.' : null
      const skala = karar([-(aralik?.fark ?? 0.25), aralik?.fark ?? 0.25], diff ? symmetricDomain(diff) : null, true)
      const alan = diff ? skala.alan : ([-0.1, 0.1] as [number, number])
      return { tanim, sahneler, sahne, onceki, izgara: diff, alan, ramp, yukleniyor: yukleniyor || (Boolean(onceki) && !diff && !neden), neden: neden ?? skalaNotu(skala), hata, hataNesnesi, skala, tekrarDene, ortanca: diff ? median(diff) : null, tipikBant: null, soluk: null }
    }
    if (katman === 'canlilik' && yil !== null) {
      const izgara = yilSorgu.data ? { values: yilSorgu.data.values, rows: yilSorgu.data.rows, cols: yilSorgu.data.cols, corners: yilSorgu.data.corners } : null
      const skala = karar([GOSTERGE_ARALIK.ndvi.min, GOSTERGE_ARALIK.ndvi.max], izgara ? percentileDomain([izgara]) : null, false)
      const alan = izgara ? skala.alan : ([0, 1] as [number, number])
      const neden = yilSorgu.isError ? `${yil} yazı için görüntü yok.` : null
      return { tanim, sahneler, sahne: yilSahnesi ?? sahne, onceki: null, izgara, alan, ramp, yukleniyor: yilSorgu.isLoading, neden: neden ?? skalaNotu(skala), hata: false, hataNesnesi: null, skala, tekrarDene, ortanca: izgara ? median(izgara) : null, tipikBant, soluk: null }
    }
    const izgara = asP(grid)
    const skala = karar(aralik ? [aralik.min, aralik.max] : [0, 1], izgara && aralik ? percentileDomain([izgara]) : null, false)
    const alan = izgara && aralik ? skala.alan : ([0, 1] as [number, number])
    return { tanim, sahneler, sahne, onceki, izgara, alan, ramp, yukleniyor: yukleniyor || (Boolean(gosterge && sahne) && !izgara), neden: skalaNotu(skala), hata, hataNesnesi, skala, tekrarDene, ortanca: izgara ? median(izgara) : null, tipikBant, soluk: null }
  }, [tanim, katman, yil, yilSorgu.data, yilSorgu.isError, yilSorgu.isLoading, gosterge, radarTuru, landsat, radarOlaylari, radarGrid.isError, sahneler, sahne, onceki, grid, prevGrid, skalaIstegi, esikler, yukleniyor, hata, hataNesnesi, tekrarDene, tipikBant])
}
